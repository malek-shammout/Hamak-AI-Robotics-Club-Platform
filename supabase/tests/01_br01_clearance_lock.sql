-- =====================================================================================
--  BR-01 — Logistical Clearance Lock  (the load-bearing rule of the whole system)
-- =====================================================================================
--  A certificate must not exist without an APPROVED clearance for THAT enrollment.
--  Enforced declaratively by D-09: a composite FK to clearance_records(id, status)
--  plus a CHECK restricting the mirrored status to approved states.
-- =====================================================================================
do $test$
declare
  v_u uuid := gen_random_uuid(); v_course uuid; v_cohort uuid;
  v_app uuid; v_enr uuid; v_clr uuid; v_err text; v_stage text := 'setup';
begin
  -- public.users is created by the trg_on_auth_user_created bridge (migration 0002).
  -- Do NOT insert it manually here: that collides with the trigger on users_pkey.
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values (v_u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
          't01@probe.invalid', null, now(), now(), now());

  insert into public.courses (code,title_ar,title_en,track,level,status)
  values ('T01-C','دورة','Probe','AI','BEGINNER','PUBLISHED') returning id into v_course;
  insert into public.cohorts (course_id, code, capacity) values (v_course,'T01-CH',10)
    returning id into v_cohort;
  insert into public.applications (cohort_id, applicant_user_id, status)
  values (v_cohort, v_u, 'ENROLLED') returning id into v_app;
  insert into public.enrollments (application_id, cohort_id, student_user_id, status)
  values (v_app, v_cohort, v_u, 'COMPLETED') returning id into v_enr;

  -- clearance deliberately left NOT approved
  insert into public.clearance_records (enrollment_id, status)
  values (v_enr, 'EVALUATING') returning id into v_clr;

  v_stage := 'attack1_non_approved';
  begin
    insert into public.certificates (enrollment_id, clearance_record_id, clearance_status, serial_no)
    values (v_enr, v_clr, 'EVALUATING', 'T01-001');
    raise exception 'BREACH: certificate created against an EVALUATING clearance';
  exception when check_violation or foreign_key_violation then null;
  end;

  -- The attack a plain FK would miss: claim APPROVED while the row says otherwise.
  v_stage := 'attack2_forged_status';
  begin
    insert into public.certificates (enrollment_id, clearance_record_id, clearance_status, serial_no)
    values (v_enr, v_clr, 'APPROVED', 'T01-002');
    raise exception 'BREACH: composite FK did not catch a forged clearance_status';
  exception when foreign_key_violation then null;
  end;

  v_stage := 'legitimate';
  update public.clearance_records set status='APPROVED' where id=v_clr;
  insert into public.certificates (enrollment_id, clearance_record_id, clearance_status, serial_no)
  values (v_enr, v_clr, 'APPROVED', 'T01-003');

  v_stage := 'attack3_revoke_under_certificate';
  begin
    update public.clearance_records set status='REVOKED' where id=v_clr;
    raise exception 'BREACH: clearance left the approved state while a certificate referenced it';
  exception when foreign_key_violation then null;
  end;

  raise exception 'ALL_BR01_PASSED';
exception when others then
  get stacked diagnostics v_err = message_text;
  if v_err = 'ALL_BR01_PASSED' then raise exception 'ALL_BR01_PASSED';
  else raise exception 'FAILED [%]: %', v_stage, v_err; end if;
end $test$;
