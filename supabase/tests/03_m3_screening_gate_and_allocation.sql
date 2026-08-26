-- =====================================================================================
--  BR-02 screening gate · BR-03 ranked allocation · BR-04 expiry + promotion
-- =====================================================================================
--  Capacity 2, applicant scores [90, 80, 70, 55, none], pass threshold 60.
--  Expected: 90 and 80 offered, 70 waitlisted, 55 and the un-attempted rejected.
-- =====================================================================================
do $test$
declare
  v_admin uuid; v_course uuid; v_cohort uuid; v_test uuid;
  v_app uuid; v_u uuid; v_scores numeric[] := array[90,80,70,55,null];
  v_res jsonb; v_err text; v_stage text := 'setup'; i int;
  v_offered int; v_waitlisted int; v_rejected int;
begin
  select id into v_admin from public.users
   where id in (select ur.user_id from public.user_roles ur
                  join public.roles r on r.id = ur.role_id
                 where r.code='ADMIN' and ur.revoked_at is null) limit 1;
  if v_admin is null then raise exception 'PRECONDITION: no ADMIN user exists to run allocation'; end if;

  insert into public.courses (code,title_ar,title_en,track,level,requires_screening,status)
  values ('T03-C','دورة','Probe','AI','BEGINNER',true,'PUBLISHED') returning id into v_course;
  insert into public.cohorts (course_id,code,capacity,offer_confirmation_hours,status)
  values (v_course,'T03-CH',2,72,'OPEN') returning id into v_cohort;
  insert into public.screening_tests (cohort_id,title,duration_minutes,attempt_limit,max_score,pass_threshold,status)
  values (v_cohort,'Probe test',60,1,100,60,'ACTIVE') returning id into v_test;

  for i in 1..5 loop
    v_u := gen_random_uuid();
    insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
    values (v_u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
            't03_'||i||'@probe.invalid',null,now(),now(),now());
    insert into public.applications (cohort_id, applicant_user_id, status, submitted_at)
    values (v_cohort, v_u, 'UNDER_EVALUATION', now() + (i || ' seconds')::interval)
    returning id into v_app;
    if v_scores[i] is not null then
      insert into public.test_attempts (screening_test_id, application_id, attempt_no, deadline_at,
                                        submitted_at, raw_score, normalized_score, state)
      values (v_test, v_app, 1, now()+interval '1 hour', now(), v_scores[i], v_scores[i], 'GRADED');
    end if;
  end loop;

  v_stage := 'unprivileged_allocation';
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid()::text)::text, true);
  begin
    perform public.run_seat_allocation(v_cohort);
    raise exception 'BREACH: an unprivileged caller ran seat allocation';
  exception when insufficient_privilege then null;
  end;

  v_stage := 'allocate';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
  v_res := public.run_seat_allocation(v_cohort);

  select count(*) into v_offered    from public.applications where cohort_id=v_cohort and status='OFFERED';
  select count(*) into v_waitlisted from public.applications where cohort_id=v_cohort and status='WAITLISTED';
  select count(*) into v_rejected   from public.applications where cohort_id=v_cohort and status='REJECTED';

  if v_rejected <> 2 then raise exception 'BR-02 BREACH: expected 2 below-threshold rejections, got %', v_rejected; end if;
  if v_offered <> 2 then raise exception 'BR-03 BREACH: expected 2 offers, got %', v_offered; end if;
  if v_waitlisted <> 1 then raise exception 'BR-03 BREACH: expected 1 waitlisted, got %', v_waitlisted; end if;

  -- Rank integrity: no lower scorer may hold a seat.
  if exists (select 1 from public.applications a
              join public.test_attempts t on t.application_id=a.id
             where a.cohort_id=v_cohort and a.status='OFFERED' and t.normalized_score < 80) then
    raise exception 'BR-03 BREACH: a lower-ranked applicant received a seat';
  end if;

  v_stage := 'expiry_and_promotion';
  update public.applications set offer_expires_at = now() - interval '1 minute'
   where cohort_id=v_cohort and status='OFFERED';
  v_res := public.expire_stale_offers();

  if (select count(*) from public.applications where cohort_id=v_cohort and status='EXPIRED') <> 2 then
    raise exception 'BR-04 BREACH: elapsed offers were not expired';
  end if;
  if (select count(*) from public.applications where cohort_id=v_cohort and status='OFFERED') <> 1 then
    raise exception 'BR-04 BREACH: the waitlist head was not promoted into the freed seat';
  end if;

  raise exception 'ALL_M3_ALLOCATION_PASSED';
exception when others then
  get stacked diagnostics v_err = message_text;
  if v_err = 'ALL_M3_ALLOCATION_PASSED' then raise exception 'ALL_M3_ALLOCATION_PASSED';
  else raise exception 'FAILED [%]: %', v_stage, v_err; end if;
end $test$;
