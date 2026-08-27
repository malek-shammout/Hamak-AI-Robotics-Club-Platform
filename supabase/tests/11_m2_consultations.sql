-- =====================================================================================
--  M2 — Consultations & Graduation Project Gateway (BR-08, D-06, AD-7)
-- =====================================================================================
--  REGRESSION GUARD. Two flaws covered here were real and proven against the live DB:
--
--  (1) MESSAGE INJECTION. `participants_send_messages` checked only
--      `sender_user_id = auth.uid()` and never the thread, so ANY signed-in user could
--      post into ANY consultation. A stranger injected "please send the project fee to
--      this account number" into a private thread. The READ policy was correctly scoped,
--      which is precisely why the write policy looked safe sitting next to it.
--
--  (2) DEAD POLICY BRANCH. A policy expression that subqueries another table is itself
--      subject to that table's RLS. consultation_assignments had no self-read policy, so
--      the expert branch of consultation_requests.self_consultations returned false for
--      everyone — the policy read as if it granted expert access and granted none.
--
--  `set local role authenticated` is load-bearing throughout. Without it these run as
--  the owner, RLS is bypassed, and every negative assertion passes vacuously.
-- =====================================================================================
do $test$
declare
  v_admin uuid; v_student uuid := gen_random_uuid(); v_stranger uuid := gen_random_uuid();
  v_expert uuid := gen_random_uuid(); v_expert2 uuid := gen_random_uuid();
  v_dom1 uuid; v_dom2 uuid; v_me uuid; v_me2 uuid;
  v_req uuid; v_req2 uuid; v_assign uuid;
  v_state text; v_count int; v_res jsonb; v_avail boolean; v_name text;
  v_err text; v_stage text := 'setup';
begin
  select id into v_admin from public.users
   where id in (select ur.user_id from public.user_roles ur
                  join public.roles r on r.id = ur.role_id
                 where r.code = 'ADMIN' and ur.revoked_at is null) limit 1;
  if v_admin is null then raise exception 'PRECONDITION: no ADMIN user exists'; end if;

  insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
  values (v_student,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t11stu@probe.invalid',null,now(),now(),now()),
         (v_stranger,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t11str@probe.invalid',null,now(),now(),now()),
         (v_expert,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t11exp@probe.invalid',null,now(),now(),now()),
         (v_expert2,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t11exp2@probe.invalid',null,now(),now(),now());
  update public.users set user_type='MEMBER', status='ACTIVE' where id in (v_expert, v_expert2);
  -- The display-name assertions below need a name to resolve; the auth bridge does not
  -- invent one.
  update public.users set full_name_ar='الخبير', full_name_en='The Expert' where id = v_expert;

  insert into public.expertise_domains (code,name_ar,name_en) values ('T11-EMB','مدمج','Embedded') returning id into v_dom1;
  insert into public.expertise_domains (code,name_ar,name_en) values ('T11-ML','تعلم آلة','ML') returning id into v_dom2;

  -- D-06: curated by A4, with a member-editable availability flag and a load cap.
  insert into public.member_expertise (member_user_id, expertise_domain_id, proficiency,
                                       is_available, max_concurrent_load, curated_by)
  values (v_expert, v_dom1, 'EXPERT', true, 1, v_admin) returning id into v_me;
  insert into public.member_expertise (member_user_id, expertise_domain_id, proficiency,
                                       is_available, max_concurrent_load, curated_by)
  values (v_expert2, v_dom1, 'PROFICIENT', false, 3, v_admin) returning id into v_me2;

  ------------------------------------------------------------------ A1 submits
  v_stage := 'submit';
  perform set_config('request.jwt.claims', json_build_object('sub', v_student::text)::text, true);
  v_req := public.submit_consultation_request(
    'Solar tracking graduation project', 'Need advice on the control loop.',
    'TECHNICAL_ADVICE', array[v_dom1]);
  if (select status from public.consultation_requests where id = v_req) <> 'NEW' then
    raise exception 'BREACH: a new request did not start NEW'; end if;
  -- BR-08: the SLA clock must start at submission.
  if (select sla_due_at from public.consultation_requests where id = v_req) is null then
    raise exception 'BR-08 BREACH: sla_due_at was not set at submission'; end if;

  v_stage := 'duplicate_guard';
  begin
    perform public.submit_consultation_request(
      'Solar tracking graduation project', 'Same thing again.', 'TECHNICAL_ADVICE', array[v_dom1]);
    raise exception 'BREACH: a duplicate open request was accepted (AD-7)';
  exception when others then
    if sqlerrm not like '%DUPLICATE_OPEN_REQUEST%' then raise; end if;
  end;

  ------------------------------------------------------------------ REGRESSION GUARD (1)
  v_stage := 'message_injection';
  perform set_config('request.jwt.claims', json_build_object('sub', v_stranger::text)::text, true);
  set local role authenticated;
  begin
    insert into public.consultation_messages (consultation_request_id, sender_user_id, body)
    values (v_req, v_stranger, 'Please send the project fee to this account number.');
  exception when others then null;   -- a hard refusal is the expected outcome
  end;
  reset role;
  select count(*) into v_count from public.consultation_messages
   where consultation_request_id = v_req and sender_user_id = v_stranger;
  if v_count > 0 then
    raise exception 'BREACH: a stranger injected a message into a private consultation thread';
  end if;

  v_stage := 'stranger_cannot_read_thread';
  set local role authenticated;
  select count(*) into v_count from public.consultation_requests where id = v_req;
  reset role;
  if v_count > 0 then raise exception 'BREACH: a stranger read a private consultation'; end if;

  ------------------------------------------------------------------ triage authz
  v_stage := 'student_cannot_triage';
  perform set_config('request.jwt.claims', json_build_object('sub', v_student::text)::text, true);
  begin
    perform public.triage_consultation(v_req, 'HIGH', 'MEDIUM');
    raise exception 'BREACH: a student triaged their own request';
  exception when insufficient_privilege then null;
  end;

  v_stage := 'triage';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
  perform public.triage_consultation(v_req, 'HIGH', 'MEDIUM', array[v_dom1]);
  if (select status from public.consultation_requests where id = v_req) <> 'TRIAGED' then
    raise exception 'BREACH: triage did not move the request to TRIAGED'; end if;

  ------------------------------------------------------------------ D-06 matching
  v_stage := 'suggest_excludes_unavailable';
  if exists (select 1 from public.suggest_experts(v_req) s where s.expert_user_id = v_expert2) then
    raise exception 'D-06 BREACH: an unavailable member was suggested'; end if;
  if not exists (select 1 from public.suggest_experts(v_req) s where s.expert_user_id = v_expert) then
    raise exception 'BREACH: the available matching expert was not suggested'; end if;

  v_stage := 'assign_refuses_unavailable';
  begin
    perform public.assign_consultation_expert(v_req, v_expert2);
    raise exception 'D-06 BREACH: an unavailable member was assigned';
  exception when others then
    if sqlerrm not like '%EXPERT_UNAVAILABLE%' then raise; end if;
  end;

  v_stage := 'assign';
  v_assign := public.assign_consultation_expert(v_req, v_expert);
  if (select status from public.consultation_requests where id = v_req) <> 'ASSIGNED' then
    raise exception 'BREACH: assignment did not move the request to ASSIGNED'; end if;

  ------------------------------------------------------------------ REGRESSION GUARD (2)
  v_stage := 'expert_sees_own_assignment';
  perform set_config('request.jwt.claims', json_build_object('sub', v_expert::text)::text, true);
  set local role authenticated;
  select count(*) into v_count from public.consultation_assignments where id = v_assign;
  reset role;
  if v_count <> 1 then raise exception 'BREACH: an expert cannot see their own assignment queue'; end if;

  v_stage := 'stranger_cannot_see_assignment';
  perform set_config('request.jwt.claims', json_build_object('sub', v_stranger::text)::text, true);
  set local role authenticated;
  select count(*) into v_count from public.consultation_assignments where id = v_assign;
  reset role;
  if v_count > 0 then raise exception 'BREACH: a stranger read someone elses assignment'; end if;

  ------------------------------------------------------------------ load cap
  v_stage := 'capacity_cap';
  perform set_config('request.jwt.claims', json_build_object('sub', v_student::text)::text, true);
  v_req2 := public.submit_consultation_request('Second project', 'Another one.', 'CODE_REVIEW', array[v_dom1]);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
  perform public.triage_consultation(v_req2, 'NORMAL', 'LOW', array[v_dom1]);
  begin
    -- max_concurrent_load is 1 and one assignment is already outstanding.
    perform public.assign_consultation_expert(v_req2, v_expert);
    raise exception 'BREACH: an expert was assigned beyond max_concurrent_load';
  exception when others then
    if sqlerrm not like '%EXPERT_AT_CAPACITY%' then raise; end if;
  end;

  ------------------------------------------------------------------ assignment response
  v_stage := 'stranger_cannot_answer_assignment';
  perform set_config('request.jwt.claims', json_build_object('sub', v_stranger::text)::text, true);
  begin
    perform public.respond_to_assignment(v_assign, true);
    raise exception 'BREACH: a stranger accepted someone elses assignment';
  exception when insufficient_privilege then null;
  end;

  v_stage := 'expert_accepts';
  perform set_config('request.jwt.claims', json_build_object('sub', v_expert::text)::text, true);
  if public.respond_to_assignment(v_assign, true) <> 'ACCEPTED' then
    raise exception 'BREACH: the named expert could not accept'; end if;
  if (select status from public.consultation_requests where id = v_req) <> 'IN_PROGRESS' then
    raise exception 'BREACH: acceptance did not open the thread (IN_PROGRESS)'; end if;

  ------------------------------------------------------------------ participants may post
  v_stage := 'participants_can_post';
  set local role authenticated;
  insert into public.consultation_messages (consultation_request_id, sender_user_id, body)
  values (v_req, v_expert, 'Happy to help.');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_student::text)::text, true);
  set local role authenticated;
  insert into public.consultation_messages (consultation_request_id, sender_user_id, body)
  values (v_req, v_student, 'Thank you.');
  reset role;
  select count(*) into v_count from public.consultation_messages where consultation_request_id = v_req;
  if v_count <> 2 then
    raise exception 'BREACH: legitimate participants could not post (got % message(s))', v_count; end if;

  v_stage := 'participants_can_read_thread';
  set local role authenticated;
  select count(*) into v_count from public.consultation_messages where consultation_request_id = v_req;
  reset role;
  if v_count <> 2 then raise exception 'BREACH: the requester could not read their own thread'; end if;

  v_stage := 'stranger_cannot_read_messages';
  perform set_config('request.jwt.claims', json_build_object('sub', v_stranger::text)::text, true);
  set local role authenticated;
  select count(*) into v_count from public.consultation_messages where consultation_request_id = v_req;
  reset role;
  if v_count > 0 then raise exception 'BREACH: a stranger read a private thread'; end if;

  ------------------------------------------------------------------ display names
  -- PROVEN GAP (fixed by 0024): users.self_read_profile scopes reads to the caller's
  -- own row, so a join from the thread to `users` returned NULL and every counterpart
  -- message rendered unattributed. Names come from a narrow SECURITY DEFINER function
  -- instead of a row policy, which would have exposed the whole user row.
  v_stage := 'participants_resolve_counterpart_names';
  perform set_config('request.jwt.claims', json_build_object('sub', v_student::text)::text, true);
  set local role authenticated;
  select p.full_name_en into v_name from public.get_consultation_participants(v_req) p
   where p.user_id = v_expert;
  reset role;
  if v_name is null or v_name = '' then
    raise exception 'BREACH: the requester cannot resolve the experts display name';
  end if;

  v_stage := 'stranger_cannot_resolve_names';
  perform set_config('request.jwt.claims', json_build_object('sub', v_stranger::text)::text, true);
  set local role authenticated;
  begin
    perform count(*) from public.get_consultation_participants(v_req);
    reset role;
    raise exception 'BREACH: a stranger read the participant names of a private thread';
  exception when insufficient_privilege then null;
  end;
  reset role;

  ------------------------------------------------------------------ D-06 availability
  v_stage := 'availability_is_member_editable';
  perform set_config('request.jwt.claims', json_build_object('sub', v_expert::text)::text, true);
  perform public.set_expertise_availability(v_me, false);
  select is_available into v_avail from public.member_expertise where id = v_me;
  if v_avail then raise exception 'D-06 BREACH: the member could not toggle their own availability'; end if;

  v_stage := 'availability_is_not_someone_elses';
  begin
    perform public.set_expertise_availability(v_me2, true);
    raise exception 'BREACH: a member toggled ANOTHER members availability';
  exception when insufficient_privilege then null;
  end;

  v_stage := 'proficiency_is_not_self_awarded';
  set local role authenticated;
  begin
    update public.member_expertise set proficiency = 'EXPERT', curated_by = v_expert where id = v_me2;
  exception when others then null;
  end;
  reset role;
  if (select proficiency from public.member_expertise where id = v_me2) = 'EXPERT' then
    raise exception 'D-06 BREACH: a member self-awarded proficiency'; end if;

  ------------------------------------------------------------------ resolution
  v_stage := 'outcome_is_mandatory';
  perform set_config('request.jwt.claims', json_build_object('sub', v_expert::text)::text, true);
  begin
    perform public.resolve_consultation(v_req, 'ADVICE_GIVEN', '');
    raise exception 'BREACH: a case was closed with no summary (AD-7)';
  exception when others then
    if sqlerrm not like '%OUTCOME_AND_SUMMARY_REQUIRED%' then raise; end if;
  end;

  v_stage := 'stranger_cannot_resolve';
  perform set_config('request.jwt.claims', json_build_object('sub', v_stranger::text)::text, true);
  begin
    perform public.resolve_consultation(v_req, 'ADVICE_GIVEN', 'Closing this.');
    raise exception 'BREACH: a stranger closed someone elses consultation';
  exception when insufficient_privilege then null;
  end;

  v_stage := 'resolve';
  perform set_config('request.jwt.claims', json_build_object('sub', v_expert::text)::text, true);
  perform public.resolve_consultation(v_req, 'ADVICE_GIVEN', 'Reviewed the loop.');
  if (select status from public.consultation_requests where id = v_req) <> 'RESOLVED' then
    raise exception 'BREACH: the request was not resolved'; end if;

  v_stage := 'closed_thread_rejects_messages';
  perform set_config('request.jwt.claims', json_build_object('sub', v_student::text)::text, true);
  set local role authenticated;
  begin
    insert into public.consultation_messages (consultation_request_id, sender_user_id, body)
    values (v_req, v_student, 'One more question.');
  exception when others then null;
  end;
  reset role;
  select count(*) into v_count from public.consultation_messages where consultation_request_id = v_req;
  if v_count <> 2 then raise exception 'BREACH: a resolved thread still accepted messages'; end if;

  ------------------------------------------------------------------ BR-08 escalation
  v_stage := 'br08_escalation';
  update public.consultation_requests
     set status = 'NEW', sla_due_at = now() - interval '1 hour', sla_breached = false
   where id = v_req2;
  v_res := public.escalate_sla_breaches();
  if (v_res->>'escalated')::int < 1 then
    raise exception 'BR-08 BREACH: an overdue request was not escalated'; end if;
  select status::text into v_state from public.consultation_requests where id = v_req2;
  if v_state <> 'ESCALATED' then
    raise exception 'BR-08 BREACH: expected ESCALATED, got %', v_state; end if;
  if not (select sla_breached from public.consultation_requests where id = v_req2) then
    raise exception 'BR-08 BREACH: sla_breached was not flagged'; end if;

  raise exception 'ALL_M2_CONSULTATIONS_PASSED';
exception when others then
  get stacked diagnostics v_err = message_text;
  if v_err = 'ALL_M2_CONSULTATIONS_PASSED' then raise exception 'ALL_M2_CONSULTATIONS_PASSED';
  else raise exception 'FAILED [%]: %', v_stage, v_err; end if;
end $test$;
