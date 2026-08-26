-- =====================================================================================
--  M6 — clearance evaluation (§B.2) and certificate issuance (BR-01, BR-10)
-- =====================================================================================
--  Walks a student through the whole lifecycle and asserts the gate at every step:
--    enrol -> attend -> complete -> borrow -> damage -> liability -> resolve
--         -> inspect -> clearance -> certificate -> public verification
--
--  The load-bearing assertion is that A1 (liabilities on OTHER enrollments) is
--  ADVISORY and never blocks. D-04 Option C: custody is the lever, not certification.
--  If a future change makes A1 blocking, this test fails — which is the point.
-- =====================================================================================
do $test$
declare
  v_admin uuid; v_log uuid := gen_random_uuid(); v_stu uuid := gen_random_uuid();
  v_deptL uuid; v_roleL uuid;
  v_cat uuid; v_type uuid; v_consumable uuid; v_unit uuid; v_unitB uuid;
  v_course uuid; v_cohort uuid; v_cohortB uuid; v_s1 uuid;
  v_app uuid; v_enr uuid; v_appB uuid; v_enrB uuid;
  v_co uuid; v_line uuid; v_lineC uuid; v_liab uuid;
  v_eval jsonb; v_res jsonb; v_verify record;
  v_err text; v_stage text := 'setup';
begin
  select id into v_admin from public.users
   where id in (select ur.user_id from public.user_roles ur
                  join public.roles r on r.id = ur.role_id
                 where r.code = 'ADMIN' and ur.revoked_at is null) limit 1;
  if v_admin is null then raise exception 'PRECONDITION: no ADMIN user exists'; end if;

  select id into v_deptL from public.departments where code = 'LOGISTICS';
  select id into v_roleL from public.roles where code = 'LOGISTICS';

  insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
  values (v_log,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t08log@probe.invalid',null,now(),now(),now()),
         (v_stu,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t08stu@probe.invalid',null,now(),now(),now());
  update public.users set user_type = 'MEMBER', status = 'ACTIVE' where id = v_log;
  insert into public.user_roles (user_id, role_id, department_id) values (v_log, v_roleL, v_deptL);

  insert into public.asset_categories (code,name_ar,name_en) values ('T08-CAT','ف','Cat') returning id into v_cat;
  insert into public.asset_types (asset_category_id,name,manufacturer,model,tracking_mode,unit_cost,currency)
  values (v_cat,'Kit','Acme','T08-A','SERIALIZED',300,'SYP') returning id into v_type;
  -- RR-3: a consumable must never hold up a clearance.
  insert into public.asset_types (asset_category_id,name,manufacturer,model,tracking_mode,is_consumable,unit_cost,currency)
  values (v_cat,'Filament','Acme','T08-B','BULK',true,20,'SYP') returning id into v_consumable;
  insert into public.asset_units (asset_type_id,asset_tag) values (v_type,'T08-TAG-1') returning id into v_unit;
  insert into public.asset_units (asset_type_id,asset_tag) values (v_type,'T08-TAG-2') returning id into v_unitB;

  insert into public.courses (code,title_ar,title_en,track,level,status)
  values ('T08-C','دورة','Probe Course','ARDUINO','BEGINNER','PUBLISHED') returning id into v_course;
  insert into public.cohorts (course_id,code,capacity,min_attendance_pct,status)
  values (v_course,'T08-CH',5,50,'RUNNING') returning id into v_cohort;
  insert into public.cohorts (course_id,code,capacity,min_attendance_pct,status)
  values (v_course,'T08-CH-B',5,50,'RUNNING') returning id into v_cohortB;
  insert into public.cohort_sessions (cohort_id,session_no,scheduled_at,duration_minutes,status)
  values (v_cohort,1,now()-interval '1 day',90,'HELD') returning id into v_s1;

  insert into public.applications (cohort_id,applicant_user_id,status)
  values (v_cohort,v_stu,'ENROLLED') returning id into v_app;
  insert into public.enrollments (application_id,cohort_id,student_user_id,status)
  values (v_app,v_cohort,v_stu,'ACTIVE') returning id into v_enr;

  -- a SECOND enrollment, used to prove the A1 advisory does not block
  insert into public.applications (cohort_id,applicant_user_id,status)
  values (v_cohortB,v_stu,'ENROLLED') returning id into v_appB;
  insert into public.enrollments (application_id,cohort_id,student_user_id,status)
  values (v_appB,v_cohortB,v_stu,'ACTIVE') returning id into v_enrB;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);

  ------------------------------------------------------------------ C1
  v_stage := 'c1_not_completed';
  v_eval := public.evaluate_clearance(v_enr);
  if (v_eval->'C1_NOT_COMPLETED'->>'pass')::boolean then
    raise exception 'BREACH: C1 passed while the enrollment was still ACTIVE';
  end if;
  if (v_eval->>'approval_enabled')::boolean then
    raise exception 'BREACH: approval enabled with C1 failing';
  end if;

  v_stage := 'approve_refused_on_preconditions';
  begin
    perform public.approve_clearance(v_enr);
    raise exception 'BREACH: clearance approved with preconditions failing';
  exception when others then
    if sqlerrm not like '%PRECONDITIONS_FAILED%' then raise; end if;
  end;

  v_stage := 'certificate_refused_without_approval';
  begin
    perform public.issue_certificate(v_enr);
    raise exception 'BREACH: a certificate was issued without an approved clearance (BR-01)';
  exception when others then
    if sqlerrm not like '%CLEARANCE_NOT_APPROVED%' then raise; end if;
  end;

  ------------------------------------------------------------------ complete the course
  v_stage := 'complete';
  perform public.record_attendance(v_enr, v_s1, 'PRESENT');
  perform public.mark_enrollment_completed(v_enr, true, null);

  ------------------------------------------------------------------ C2 / RR-3
  v_stage := 'issue_hardware';
  perform set_config('request.jwt.claims', json_build_object('sub', v_log::text)::text, true);
  v_co := public.issue_checkout(
    p_custody_type => 'STUDENT', p_holder_user_id => v_stu,
    p_due_at => now() + interval '7 days',
    p_lines => jsonb_build_array(
      jsonb_build_object('asset_type_id', v_type, 'asset_unit_id', v_unit),
      jsonb_build_object('asset_type_id', v_consumable, 'quantity', 5)),
    p_enrollment_id => v_enr);

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
  v_eval := public.evaluate_clearance(v_enr);
  if (v_eval->'C2_ITEMS_OUTSTANDING'->>'pass')::boolean then
    raise exception 'BREACH: C2 passed with hardware still out';
  end if;
  if (v_eval->'C2_ITEMS_OUTSTANDING'->>'count')::int <> 1 then
    raise exception 'BREACH: RR-3 — the consumable was counted as outstanding (count=%)',
      v_eval->'C2_ITEMS_OUTSTANDING'->>'count';
  end if;

  ------------------------------------------------------------------ C4 via BR-06
  v_stage := 'damage_opens_liability';
  select cl.id into v_line from public.checkout_lines cl
   where cl.checkout_id = v_co and cl.asset_unit_id = v_unit;
  perform set_config('request.jwt.claims', json_build_object('sub', v_log::text)::text, true);
  v_res := public.check_in_line(v_line, 'DAMAGED', 'Bent pins.');
  v_liab := (v_res->>'liability_id')::uuid;

  -- the consumable line is still ACTIVE and must remain invisible to C2
  select cl.id into v_lineC from public.checkout_lines cl
   where cl.checkout_id = v_co and cl.asset_type_id = v_consumable;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
  v_eval := public.evaluate_clearance(v_enr);
  if (v_eval->'C2_ITEMS_OUTSTANDING'->>'pass')::boolean is not true then
    raise exception 'BREACH: RR-3 — the outstanding consumable blocked C2';
  end if;
  if (v_eval->'C4_LIABILITY_OPEN'->>'pass')::boolean then
    raise exception 'BREACH: C4 passed with a live liability';
  end if;

  ------------------------------------------------------------------ A1 advisory (D-04 C)
  v_stage := 'a1_advisory_is_not_blocking';
  -- Give the student a liability on the OTHER enrollment, then resolve this one.
  perform set_config('request.jwt.claims', json_build_object('sub', v_log::text)::text, true);
  declare v_coB uuid; v_lineB uuid;
  begin
    -- BR-13 blocks new custody, so this second checkout is created before resolution
    -- would be impossible; use the admin override path deliberately.
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
    v_coB := public.issue_checkout(
      p_custody_type => 'STUDENT', p_holder_user_id => v_stu,
      p_due_at => now() + interval '7 days',
      p_lines => jsonb_build_array(jsonb_build_object('asset_type_id', v_type, 'asset_unit_id', v_unitB)),
      p_enrollment_id => v_enrB,
      p_override_justification => 'Probe: seeding a liability on another enrollment.');
    select cl.id into v_lineB from public.checkout_lines cl where cl.checkout_id = v_coB;
    perform public.check_in_line(v_lineB, 'LOST', 'Probe loss on the other enrollment.');
  end;

  -- resolve only THIS enrollment's liability
  perform public.resolve_liability(v_liab, 'RESOLVED_SETTLED', 'Paid in full.');

  v_eval := public.evaluate_clearance(v_enr);
  if (v_eval->'A1_OUTSTANDING_ELSEWHERE'->>'advisory')::boolean is not true then
    raise exception 'BREACH: the A1 advisory did not fire despite a liability elsewhere';
  end if;
  if (v_eval->'A1_OUTSTANDING_ELSEWHERE'->>'blocking')::boolean then
    raise exception 'BREACH: A1 is marked blocking. D-04 Option C says advisory only.';
  end if;
  if (v_eval->'C4_LIABILITY_OPEN'->>'pass')::boolean is not true then
    raise exception 'BREACH: C4 counted a liability belonging to another enrollment';
  end if;

  ------------------------------------------------------------------ C3
  v_stage := 'c3_inspection_pending';
  -- The consumable is excluded from the obligation entirely, so returning it should
  -- not be required. C2 and C3 must already pass.
  if (v_eval->'C3_INSPECTION_PENDING'->>'pass')::boolean is not true then
    raise exception 'BREACH: C3 failed even though every non-consumable line was inspected';
  end if;

  ------------------------------------------------------------------ approval + BR-01
  v_stage := 'approve';
  if (v_eval->>'approval_enabled')::boolean is not true then
    raise exception 'BREACH: approval still disabled: %', v_eval::text;
  end if;
  v_res := public.approve_clearance(v_enr);
  if v_res->>'status' <> 'APPROVED' then
    raise exception 'BREACH: expected APPROVED, got %', v_res->>'status';
  end if;
  if (v_res->>'overridden')::boolean then
    raise exception 'BREACH: a clean approval was recorded as an override';
  end if;

  v_stage := 'issue_certificate';
  v_res := public.issue_certificate(v_enr);
  if (v_res->>'certificate_id') is null then
    raise exception 'BREACH: no certificate was issued after approval';
  end if;
  if length(v_res->>'verification_code') <> 32 then
    raise exception 'BREACH: BR-10 verification code is not 128-bit (len=%)',
      length(v_res->>'verification_code');
  end if;
  if (select status from public.enrollments where id = v_enr) <> 'CERTIFIED' then
    raise exception 'BREACH: the enrollment was not moved to CERTIFIED';
  end if;

  v_stage := 'no_double_issue';
  begin
    perform public.issue_certificate(v_enr);
    raise exception 'BREACH: a second certificate was issued for one enrollment';
  exception when others then
    if sqlerrm not like '%CERTIFICATE_ALREADY_ISSUED%' then raise; end if;
  end;

  ------------------------------------------------------------------ BR-10 public path
  v_stage := 'public_verification';
  select * into v_verify from public.verify_certificate(v_res->>'verification_code');
  if v_verify.serial_no is null then
    raise exception 'BREACH: an issued certificate did not resolve via verify_certificate';
  end if;
  if v_verify.cert_status <> 'ISSUED' then
    raise exception 'BREACH: verification reported status %', v_verify.cert_status;
  end if;

  ------------------------------------------------------------------ BR-01 structural
  v_stage := 'br01_revoke_under_certificate';
  begin
    update public.clearance_records set status = 'REVOKED' where enrollment_id = v_enr;
    raise exception 'BREACH: a clearance was revoked while a certificate referenced it (BR-01/D-09)';
  exception when foreign_key_violation then null;
  end;

  raise exception 'ALL_M6_CLEARANCE_PASSED';
exception when others then
  get stacked diagnostics v_err = message_text;
  if v_err = 'ALL_M6_CLEARANCE_PASSED' then raise exception 'ALL_M6_CLEARANCE_PASSED';
  else raise exception 'FAILED [%]: %', v_stage, v_err; end if;
end $test$;
