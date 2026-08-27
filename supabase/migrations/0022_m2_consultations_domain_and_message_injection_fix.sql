set search_path = public, extensions, pg_catalog;

-- =====================================================================================
--  Migration 0022 — M2 Consultations. PART 1 IS A SECURITY FIX.
-- =====================================================================================
--  THE FLAW (introduced in schema.sql; CONFIRMED EXPLOITABLE by live probe):
--    `participants_send_messages` on consultation_messages had
--        WITH CHECK (sender_user_id = app.uid())
--    That validates WHO is sending but never WHICH THREAD. Any authenticated user could
--    INSERT into any consultation by supplying an arbitrary consultation_request_id.
--
--    PROVEN: an unrelated signed-in user posted "please send the project fee to this
--    account number" into a stranger's private consultation. They could not read the
--    thread back — the SELECT policy is correctly scoped — but the requester and the
--    assigned expert would read the injected message inside a trusted channel.
--
--    Note the asymmetry that hid it: READ was scoped to participants, WRITE was not.
--    A correct read policy sitting next to a broken write policy reads as safe.
--
--  This is the same family as D-13: a check that validates a COLUMN rather than the
--  row's RELATIONSHIP. Recorded as the fifth instance.
--
--  NOTE: the message and attachment policies below are superseded by 0023, which
--  replaces the table-subquery predicate with app.is_consultation_participant().
--  They are kept here verbatim so the migration history replays truthfully.
-- =====================================================================================

drop policy if exists "participants_send_messages" on public.consultation_messages;

create policy "participants_send_messages" on public.consultation_messages
  for insert to authenticated
  with check (
    sender_user_id = auth.uid()
    and exists (
      select 1 from public.consultation_requests cr
       where cr.id = consultation_messages.consultation_request_id
         -- the sender must actually belong to THIS thread
         and (
           cr.requester_user_id = auth.uid()
           or exists (
             select 1 from public.consultation_assignments ca
              where ca.consultation_request_id = cr.id
                and ca.expert_user_id = auth.uid()
                and ca.state in ('PENDING_ACCEPTANCE','ACCEPTED')
           )
           or app.has_perm('M2.UPDATE')
         )
         -- and a closed case does not accept new messages
         and cr.status not in ('RESOLVED','REJECTED')
    )
  );

comment on policy "participants_send_messages" on public.consultation_messages is
  'Scopes the insert to the THREAD, not just the sender. The previous version checked '
  'only sender_user_id = auth.uid(), which let any signed-in user inject messages into '
  'any consultation. Never reduce this to a column check again.';

-- Attachments had ONLY admin_full_access, so participants could not read their own
-- thread's files. Scope them to the parent message's thread.
create policy "participants_read_attachments" on public.consultation_attachments
  for select to authenticated
  using (exists (
    select 1 from public.consultation_messages cm
      join public.consultation_requests cr on cr.id = cm.consultation_request_id
     where cm.id = consultation_attachments.consultation_message_id
       and (
         cr.requester_user_id = auth.uid()
         or exists (select 1 from public.consultation_assignments ca
                     where ca.consultation_request_id = cr.id and ca.expert_user_id = auth.uid())
         or app.has_perm('M2.READ')
       )
  ));

create policy "participants_add_attachments" on public.consultation_attachments
  for insert to authenticated
  with check (exists (
    select 1 from public.consultation_messages cm
     where cm.id = consultation_attachments.consultation_message_id
       and cm.sender_user_id = auth.uid()
  ));

-- D-06: expertise is CURATED by A4 but availability is MEMBER-editable. Members could
-- not see their own row at all, let alone toggle it. Read is opened to the owner;
-- writing stays closed so proficiency and curation cannot be self-awarded — the toggle
-- goes through set_expertise_availability() below.
create policy "self_read_own_expertise" on public.member_expertise
  for select to authenticated
  using (member_user_id = auth.uid());

-- =====================================================================================
--  PART 2 — consultation domain
-- =====================================================================================

-- ---------------------------------------------------------------- D-06 availability
create or replace function public.set_expertise_availability(
  p_expertise_id uuid, p_is_available boolean
) returns void
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare v_owner uuid;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;

  select member_user_id into v_owner from public.member_expertise where id = p_expertise_id;
  if v_owner is null then raise exception 'EXPERTISE_NOT_FOUND' using errcode='P0002'; end if;
  if v_owner <> auth.uid() and not app.is_admin() then
    raise exception 'NOT_YOUR_EXPERTISE' using errcode='42501';
  end if;

  -- ONLY is_available. proficiency, evidence and curated_by are A4's to set (D-06);
  -- no column here lets a member promote themselves.
  update public.member_expertise
     set is_available = coalesce(p_is_available, false)
   where id = p_expertise_id;
end $fn$;

-- ---------------------------------------------------------------- A1 submits
create or replace function public.submit_consultation_request(
  p_title text,
  p_abstract text,
  p_support_type consultation_support_type,
  p_domain_ids uuid[] default '{}',
  p_university_id uuid default null,
  p_supervisor_name text default null,
  p_project_deadline_on date default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare
  v_uid uuid := auth.uid();
  v_req uuid; v_no text; v_sla int; v_domain uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception 'TITLE_REQUIRED' using errcode='P0001';
  end if;

  -- AD-7: warn on a duplicate open request. The workflow says warn, not block, so this
  -- refuses only an exact repeat of a still-open title by the same person.
  if exists (
    select 1 from public.consultation_requests cr
     where cr.requester_user_id = v_uid
       and lower(btrim(cr.title)) = lower(btrim(p_title))
       and cr.status not in ('RESOLVED','REJECTED')
  ) then
    raise exception 'DUPLICATE_OPEN_REQUEST' using errcode='P0001';
  end if;

  -- BR-08: the SLA clock starts at submission and its length is club-configurable.
  select coalesce((value #>> '{}')::int, 48) into v_sla
    from public.system_policies where key = 'consultations.sla_hours';
  v_sla := coalesce(v_sla, 48);

  v_no := 'CN-' || to_char(now(),'YYYYMMDD') || '-' || upper(encode(extensions.gen_random_bytes(3),'hex'));

  insert into public.consultation_requests (
    reference_no, requester_user_id, title, abstract, university_id, supervisor_name,
    project_deadline_on, support_type, status, priority, sla_due_at
  ) values (
    v_no, v_uid, btrim(p_title), p_abstract, p_university_id, p_supervisor_name,
    p_project_deadline_on, coalesce(p_support_type,'TECHNICAL_ADVICE'), 'NEW', 'NORMAL',
    now() + make_interval(hours => v_sla)
  ) returning id into v_req;

  foreach v_domain in array coalesce(p_domain_ids, '{}')
  loop
    insert into public.consultation_request_domains (consultation_request_id, expertise_domain_id)
    values (v_req, v_domain) on conflict do nothing;
  end loop;

  return v_req;
end $fn$;

-- ---------------------------------------------------------------- A4 triages
create or replace function public.triage_consultation(
  p_request_id uuid,
  p_priority consultation_priority,
  p_complexity consultation_complexity,
  p_domain_ids uuid[] default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare v_uid uuid := auth.uid(); v_req record; v_domain uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not (app.has_perm('M2.UPDATE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select cr.* into v_req from public.consultation_requests cr
   where cr.id = p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND' using errcode='P0002'; end if;
  if v_req.status not in ('NEW','ESCALATED') then
    raise exception 'NOT_TRIAGEABLE' using errcode='P0001';
  end if;

  if p_domain_ids is not null then
    delete from public.consultation_request_domains where consultation_request_id = p_request_id;
    foreach v_domain in array p_domain_ids loop
      insert into public.consultation_request_domains (consultation_request_id, expertise_domain_id)
      values (p_request_id, v_domain) on conflict do nothing;
    end loop;
  end if;

  update public.consultation_requests
     set status = 'TRIAGED', priority = coalesce(p_priority, priority),
         complexity = coalesce(p_complexity, complexity),
         triaged_by = v_uid, triaged_at = now()
   where id = p_request_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, before_state, after_state)
  values (v_uid, 'TRIAGE_CONSULTATION', 'consultation_requests', p_request_id,
          jsonb_build_object('status', v_req.status),
          jsonb_build_object('status','TRIAGED','priority',p_priority,'complexity',p_complexity));
end $fn$;

-- ---------------------------------------------------------------- expert matching
-- AD-7 ranks candidates by domain overlap, evidence and current load. Read-only:
-- suggesting is not assigning.
create or replace function public.suggest_experts(p_request_id uuid)
returns table (
  expert_user_id uuid, full_name_ar varchar, full_name_en varchar,
  domain_overlap int, has_evidence boolean, current_load bigint,
  max_concurrent_load smallint, is_available boolean
)
language sql stable security definer set search_path = public, pg_temp as $fn$
  select u.id, u.full_name_ar, u.full_name_en,
         count(distinct me.expertise_domain_id)::int as domain_overlap,
         bool_or(me.evidence_project_id is not null) as has_evidence,
         coalesce(max(l.current_load), 0) as current_load,
         max(me.max_concurrent_load) as max_concurrent_load,
         bool_and(me.is_available) as is_available
    from public.member_expertise me
    join public.users u on u.id = me.member_user_id
    join public.consultation_request_domains crd
      on crd.expertise_domain_id = me.expertise_domain_id
     and crd.consultation_request_id = p_request_id
    left join public.v_expert_current_load l on l.member_user_id = me.member_user_id
   where me.is_available
   group by u.id, u.full_name_ar, u.full_name_en
  having coalesce(max(l.current_load), 0) < max(me.max_concurrent_load)
   order by count(distinct me.expertise_domain_id) desc,
            bool_or(me.evidence_project_id is not null) desc,
            coalesce(max(l.current_load), 0) asc;
$fn$;

-- ---------------------------------------------------------------- A4 assigns
create or replace function public.assign_consultation_expert(
  p_request_id uuid, p_expert_user_id uuid, p_response_hours int default 48
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare
  v_uid uuid := auth.uid(); v_req record; v_load bigint; v_max smallint; v_assign uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not (app.has_perm('M2.APPROVE') or app.has_perm('M2.UPDATE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select cr.* into v_req from public.consultation_requests cr
   where cr.id = p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND' using errcode='P0002'; end if;
  if v_req.status not in ('TRIAGED','ESCALATED') then
    raise exception 'NOT_ASSIGNABLE' using errcode='P0001';
  end if;

  -- D-06: an unavailable member is not assignable, and max_concurrent_load is a cap,
  -- not a suggestion. Both are re-checked here because suggest_experts is only advice.
  select coalesce(max(me.max_concurrent_load), 0) into v_max
    from public.member_expertise me
   where me.member_user_id = p_expert_user_id and me.is_available;
  if v_max = 0 then
    raise exception 'EXPERT_UNAVAILABLE' using errcode='P0001';
  end if;

  select coalesce(count(*), 0) into v_load
    from public.consultation_assignments ca
   where ca.expert_user_id = p_expert_user_id
     and ca.state in ('PENDING_ACCEPTANCE','ACCEPTED');
  if v_load >= v_max then
    raise exception 'EXPERT_AT_CAPACITY' using errcode='P0001';
  end if;

  insert into public.consultation_assignments (consultation_request_id, expert_user_id,
                                               assigned_by, response_due_at, state)
  values (p_request_id, p_expert_user_id, v_uid,
          now() + make_interval(hours => greatest(1, p_response_hours)), 'PENDING_ACCEPTANCE')
  returning id into v_assign;

  update public.consultation_requests set status = 'ASSIGNED' where id = p_request_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, after_state)
  values (v_uid, 'ASSIGN_CONSULTATION', 'consultation_assignments', v_assign,
          jsonb_build_object('request', p_request_id, 'expert', p_expert_user_id));

  return v_assign;
end $fn$;

-- ---------------------------------------------------------------- expert responds
create or replace function public.respond_to_assignment(
  p_assignment_id uuid, p_accept boolean, p_decline_reason text default null
) returns text
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare v_uid uuid := auth.uid(); v_a record;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;

  select ca.* into v_a from public.consultation_assignments ca
   where ca.id = p_assignment_id for update;
  if not found then raise exception 'ASSIGNMENT_NOT_FOUND' using errcode='P0002'; end if;
  -- Only the named expert may answer for themselves.
  if v_a.expert_user_id <> v_uid then
    raise exception 'NOT_YOUR_ASSIGNMENT' using errcode='42501';
  end if;
  if v_a.state <> 'PENDING_ACCEPTANCE' then
    raise exception 'ASSIGNMENT_NOT_PENDING' using errcode='P0001';
  end if;

  if p_accept then
    update public.consultation_assignments set state = 'ACCEPTED' where id = p_assignment_id;
    update public.consultation_requests set status = 'IN_PROGRESS'
     where id = v_a.consultation_request_id;
    return 'ACCEPTED';
  end if;

  if p_decline_reason is null or btrim(p_decline_reason) = '' then
    raise exception 'DECLINE_REASON_REQUIRED' using errcode='P0001';
  end if;

  update public.consultation_assignments
     set state = 'DECLINED', decline_reason = p_decline_reason, released_at = now()
   where id = p_assignment_id;

  -- AD-7: a decline returns the request to the triage queue rather than stranding it.
  update public.consultation_requests set status = 'TRIAGED'
   where id = v_a.consultation_request_id;

  return 'DECLINED';
end $fn$;

-- ---------------------------------------------------------------- resolve
create or replace function public.resolve_consultation(
  p_request_id uuid, p_outcome consultation_outcome, p_summary text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare v_uid uuid := auth.uid(); v_req record; v_is_expert boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;

  select cr.* into v_req from public.consultation_requests cr
   where cr.id = p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND' using errcode='P0002'; end if;
  if v_req.status = 'RESOLVED' then
    raise exception 'ALREADY_RESOLVED' using errcode='P0001';
  end if;

  select exists (
    select 1 from public.consultation_assignments ca
     where ca.consultation_request_id = p_request_id
       and ca.expert_user_id = v_uid and ca.state = 'ACCEPTED'
  ) into v_is_expert;

  if not (v_is_expert or app.has_perm('M2.APPROVE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  -- AD-7 makes both mandatory: a case closed with no outcome teaches nobody anything.
  if p_outcome is null or p_summary is null or btrim(p_summary) = '' then
    raise exception 'OUTCOME_AND_SUMMARY_REQUIRED' using errcode='P0001';
  end if;

  update public.consultation_requests
     set status = 'RESOLVED', outcome_category = p_outcome,
         outcome_summary = p_summary, closed_at = now()
   where id = p_request_id;

  update public.consultation_assignments set state = 'RELEASED', released_at = now()
   where consultation_request_id = p_request_id and state = 'ACCEPTED';

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, after_state)
  values (v_uid, 'RESOLVE_CONSULTATION', 'consultation_requests', p_request_id,
          jsonb_build_object('outcome', p_outcome));
end $fn$;

-- ---------------------------------------------------------------- BR-08 (S1)
create or replace function public.escalate_sla_breaches()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $fn$
declare v_n int;
begin
  with breached as (
    update public.consultation_requests
       set sla_breached = true, status = 'ESCALATED'
     where status = 'NEW' and sla_due_at is not null and sla_due_at < now()
       and sla_breached = false
    returning id
  )
  select count(*) into v_n from breached;

  return jsonb_build_object('escalated', v_n, 'ran_at', now());
end $fn$;

revoke all on function public.set_expertise_availability(uuid, boolean) from public, anon;
revoke all on function public.submit_consultation_request(text, text, consultation_support_type, uuid[], uuid, text, date) from public, anon;
revoke all on function public.triage_consultation(uuid, consultation_priority, consultation_complexity, uuid[]) from public, anon;
revoke all on function public.suggest_experts(uuid) from public, anon;
revoke all on function public.assign_consultation_expert(uuid, uuid, int) from public, anon;
revoke all on function public.respond_to_assignment(uuid, boolean, text) from public, anon;
revoke all on function public.resolve_consultation(uuid, consultation_outcome, text) from public, anon;
revoke all on function public.escalate_sla_breaches() from public, anon, authenticated;

grant execute on function public.set_expertise_availability(uuid, boolean) to authenticated;
grant execute on function public.submit_consultation_request(text, text, consultation_support_type, uuid[], uuid, text, date) to authenticated;
grant execute on function public.triage_consultation(uuid, consultation_priority, consultation_complexity, uuid[]) to authenticated;
grant execute on function public.suggest_experts(uuid) to authenticated;
grant execute on function public.assign_consultation_expert(uuid, uuid, int) to authenticated;
grant execute on function public.respond_to_assignment(uuid, boolean, text) to authenticated;
grant execute on function public.resolve_consultation(uuid, consultation_outcome, text) to authenticated;
grant execute on function public.escalate_sla_breaches() to service_role;

select cron.schedule('hmk-br08-escalate-sla', '*/20 * * * *',
                     $job$ select public.escalate_sla_breaches(); $job$);
