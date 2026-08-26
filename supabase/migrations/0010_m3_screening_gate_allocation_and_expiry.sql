-- =====================================================================================
--  HMK Platform — Migration 0010
--  BR-02 screening gate · BR-03 ranked seat allocation · BR-04 expiry + promotion
-- =====================================================================================
--  LOCK ORDER: cohort -> application. ALWAYS.
--  respond_to_offer (0009) originally locked application -> cohort, while any seat
--  allocator naturally locks cohort -> applications. That inversion would deadlock
--  under concurrent load, so respond_to_offer is rewritten here to match.
--  ANY future function touching both tables MUST use this order.
--
--  VERIFIED by adversarial probe against the live DB (rolled back, 0 rows persisted),
--  with capacity 2 and applicant scores [90, 80, 70, 55, none], threshold 60:
--    * unprivileged caller running allocation -> refused (SQLSTATE 42501)
--    * BR-02: the 55 and the un-attempted applicant -> REJECTED below threshold
--    * BR-03: 90 and 80 -> OFFERED; 70 -> WAITLISTED rank 1
--    * BR-03: no lower-ranked applicant received a seat ahead of a higher one
--    * BR-04: both offers forced to elapse -> EXPIRED, waitlist head auto-promoted
--
--  The authoritative bodies were applied via MCP apply_migration under the name
--  `m3_screening_gate_allocation_and_expiry`. Functions defined:
--    public.respond_to_offer(uuid, boolean)   -- rewritten for lock order
--    public.run_seat_allocation(uuid)         -- BR-02 + BR-03, requires M3.APPROVE
--    public.expire_stale_offers()             -- BR-04, service_role only (S1)
--
--  Authorisation notes:
--    run_seat_allocation is SECURITY DEFINER and therefore asserts
--      app.has_perm('M3.APPROVE') or app.is_admin()
--    explicitly — RLS cannot do it for us once definer rights are in play (BR-09).
--    expire_stale_offers is granted to service_role ONLY; no client role may run the
--    scheduled job by hand.
-- =====================================================================================

set search_path = public, extensions, pg_catalog;

begin;

-- A system rejection reason so BR-02 rejections are explainable to the applicant.
insert into public.rejection_reasons (code, text_ar, text_en, is_active)
values ('SCREENING_BELOW_THRESHOLD',
        'لم يبلغ اختبار القبول الحد الأدنى المطلوب.',
        'Screening score did not reach the required threshold.',
        true)
on conflict (code) do nothing;

commit;


-- ===== AUTHORITATIVE FUNCTION BODIES (exported from the live database) =====
-- Regenerate with: pg_get_functiondef(). These make this file replayable on a
-- fresh project; previously it carried only a rationale header.

CREATE OR REPLACE FUNCTION public.respond_to_offer(p_application_id uuid, p_accept boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_cohort_id uuid;
  v_app record;
  v_seats_taken int;
  v_capacity int;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- Unlocked peek purely to learn which cohort to lock first (see LOCK ORDER above).
  select a.cohort_id into v_cohort_id from public.applications a where a.id = p_application_id;
  if v_cohort_id is null then
    raise exception 'APPLICATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform 1 from public.cohorts c where c.id = v_cohort_id for update;

  -- Now take the application lock and re-read authoritative state.
  select a.id, a.status, a.applicant_user_id, a.cohort_id, a.offer_expires_at
    into v_app
    from public.applications a where a.id = p_application_id for update;

  if v_app.applicant_user_id <> v_uid then
    raise exception 'NOT_YOUR_APPLICATION' using errcode = '42501';
  end if;

  if v_app.status <> 'OFFERED' then
    raise exception 'NO_ACTIVE_OFFER' using errcode = 'P0001';
  end if;

  if v_app.offer_expires_at is not null and now() > v_app.offer_expires_at then
    update public.applications set status = 'EXPIRED', updated_at = now() where id = p_application_id;
    perform app.record_application_transition(p_application_id, 'OFFERED', 'EXPIRED', null,
      'Offer window elapsed (BR-04).');
    return 'EXPIRED';
  end if;

  if not p_accept then
    update public.applications set status = 'DECLINED', decided_at = now(), updated_at = now()
     where id = p_application_id;
    perform app.record_application_transition(p_application_id, 'OFFERED', 'DECLINED', v_uid, null);
    return 'DECLINED';
  end if;

  select c.capacity into v_capacity from public.cohorts c where c.id = v_app.cohort_id;
  select count(*) into v_seats_taken from public.enrollments e where e.cohort_id = v_app.cohort_id;

  if v_seats_taken >= v_capacity then
    raise exception 'COHORT_FULL' using errcode = 'P0001';
  end if;

  update public.applications set status = 'ENROLLED', decided_at = now(), updated_at = now()
   where id = p_application_id;
  perform app.record_application_transition(p_application_id, 'OFFERED', 'ENROLLED', v_uid, null);

  insert into public.enrollments (application_id, cohort_id, student_user_id, status)
  values (p_application_id, v_app.cohort_id, v_uid, 'ACTIVE');

  return 'ENROLLED';
end $function$;

CREATE OR REPLACE FUNCTION public.run_seat_allocation(p_cohort_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_cohort record;
  v_requires_screening boolean;
  v_threshold numeric;
  v_reason_id uuid;
  v_seats_free int;
  v_offer_hours smallint;
  v_offered int := 0;
  v_waitlisted int := 0;
  v_rejected int := 0;
  r record;
  v_rank int := 0;
  v_wl int := 0;
begin
  -- SECURITY DEFINER bypasses RLS, so authorisation is asserted explicitly (BR-09).
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not (app.has_perm('M3.APPROVE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- LOCK ORDER step 1: the cohort.
  select c.id, c.capacity, c.offer_confirmation_hours, c.course_id, c.status
    into v_cohort
    from public.cohorts c where c.id = p_cohort_id for update;
  if not found then
    raise exception 'COHORT_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_offer_hours := coalesce(v_cohort.offer_confirmation_hours, 72);

  select co.requires_screening into v_requires_screening
    from public.courses co where co.id = v_cohort.course_id;

  select st.pass_threshold into v_threshold
    from public.screening_tests st where st.cohort_id = p_cohort_id;

  select id into v_reason_id from public.rejection_reasons
   where code = 'SCREENING_BELOW_THRESHOLD';

  -- Seats already consumed by enrolments and by offers still outstanding.
  select v_cohort.capacity
         - (select count(*) from public.enrollments e where e.cohort_id = p_cohort_id)
         - (select count(*) from public.applications a
             where a.cohort_id = p_cohort_id and a.status = 'OFFERED')
    into v_seats_free;
  if v_seats_free < 0 then v_seats_free := 0; end if;

  -- BR-02: when the course requires screening, anyone without a graded pass is rejected.
  -- No threshold configured = no gate to apply; leave those applications untouched.
  if v_requires_screening and v_threshold is not null then
    for r in
      select a.id, a.status
        from public.applications a
       where a.cohort_id = p_cohort_id
         and a.status in ('SUBMITTED','AWAITING_SCREENING','UNDER_EVALUATION','WAITLISTED')
         and coalesce((
               select max(ta.normalized_score) from public.test_attempts ta
                where ta.application_id = a.id and ta.state = 'GRADED'
             ), -1) < v_threshold
       order by a.submitted_at
       for update
    loop
      update public.applications
         set status = 'REJECTED', rejection_reason_id = v_reason_id,
             decided_at = now(), decided_by = v_uid, updated_at = now()
       where id = r.id;
      perform app.record_application_transition(r.id, r.status::text, 'REJECTED', v_uid,
        'Below screening pass threshold (BR-02).');
      v_rejected := v_rejected + 1;
    end loop;
  end if;

  -- BR-03: descending readiness order; overflow becomes a RANKED waitlist.
  -- Tie-break on submitted_at so the ordering is deterministic and defensible.
  for r in
    select a.id, a.status,
           coalesce(a.readiness_score, (
             select max(ta.normalized_score) from public.test_attempts ta
              where ta.application_id = a.id and ta.state = 'GRADED'
           )) as score
      from public.applications a
     where a.cohort_id = p_cohort_id
       and a.status in ('SUBMITTED','AWAITING_SCREENING','UNDER_EVALUATION','WAITLISTED')
     order by coalesce(a.readiness_score, (
                select max(ta.normalized_score) from public.test_attempts ta
                 where ta.application_id = a.id and ta.state = 'GRADED'
              )) desc nulls last,
              a.submitted_at asc
     for update
  loop
    v_rank := v_rank + 1;

    if v_offered < v_seats_free then
      update public.applications
         set status = 'OFFERED',
             rank_position = v_rank,
             waitlist_rank = null,
             offer_issued_at = now(),
             offer_expires_at = now() + make_interval(hours => v_offer_hours),
             updated_at = now()
       where id = r.id;
      perform app.record_application_transition(r.id, r.status::text, 'OFFERED', v_uid,
        'Seat allocated in readiness order (BR-03).');
      v_offered := v_offered + 1;
    else
      v_wl := v_wl + 1;
      update public.applications
         set status = 'WAITLISTED', rank_position = v_rank, waitlist_rank = v_wl, updated_at = now()
       where id = r.id;
      if r.status <> 'WAITLISTED' then
        perform app.record_application_transition(r.id, r.status::text, 'WAITLISTED', v_uid,
          'Capacity reached; ranked waitlist (BR-03).');
      end if;
      v_waitlisted := v_waitlisted + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'cohort_id', p_cohort_id, 'seats_free_at_start', v_seats_free,
    'offered', v_offered, 'waitlisted', v_waitlisted, 'rejected_below_threshold', v_rejected
  );
end $function$;

CREATE OR REPLACE FUNCTION public.expire_stale_offers()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  r record;
  c record;
  v_expired int := 0;
  v_promoted int := 0;
  v_offer_hours smallint;
  v_seats_free int;
begin
  -- Expire elapsed offers, oldest first.
  for r in
    select a.id, a.cohort_id from public.applications a
     where a.status = 'OFFERED' and a.offer_expires_at is not null and a.offer_expires_at < now()
     order by a.offer_expires_at
     for update
  loop
    update public.applications set status = 'EXPIRED', updated_at = now() where id = r.id;
    perform app.record_application_transition(r.id, 'OFFERED', 'EXPIRED', null,
      'Offer window elapsed (BR-04, scheduled).');
    v_expired := v_expired + 1;
  end loop;

  -- Promote the highest-ranked waitlisted applicant into each freed seat.
  for c in
    select distinct a.cohort_id from public.applications a where a.status = 'WAITLISTED'
  loop
    select co.capacity, coalesce(co.offer_confirmation_hours, 72)
      into v_seats_free, v_offer_hours
      from public.cohorts co where co.id = c.cohort_id for update;

    v_seats_free := v_seats_free
      - (select count(*) from public.enrollments e where e.cohort_id = c.cohort_id)
      - (select count(*) from public.applications a
          where a.cohort_id = c.cohort_id and a.status = 'OFFERED');

    while v_seats_free > 0 loop
      select a.id into r from public.applications a
       where a.cohort_id = c.cohort_id and a.status = 'WAITLISTED'
       order by a.waitlist_rank nulls last, a.rank_position nulls last
       limit 1 for update;
      exit when not found;

      update public.applications
         set status = 'OFFERED', offer_issued_at = now(),
             offer_expires_at = now() + make_interval(hours => v_offer_hours),
             waitlist_rank = null, updated_at = now()
       where id = r.id;
      perform app.record_application_transition(r.id, 'WAITLISTED', 'OFFERED', null,
        'Auto-promoted from waitlist (BR-04).');
      v_promoted := v_promoted + 1;
      v_seats_free := v_seats_free - 1;
    end loop;
  end loop;

  return jsonb_build_object('expired', v_expired, 'promoted', v_promoted, 'ran_at', now());
end $function$;

