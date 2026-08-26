-- =====================================================================================
--  BR-05 — attendance and completion  (see claude.md D-12)
-- =====================================================================================
--  BR-05 has two halves of different nature: attendance is COMPUTED, evaluations are an
--  A2 ATTESTATION (the frozen model has no evaluations entity). Both are asserted here.
-- =====================================================================================
do $test$
declare
  v_admin uuid; v_u uuid := gen_random_uuid(); v_u2 uuid := gen_random_uuid();
  v_course uuid; v_cohort uuid; v_other uuid; v_s1 uuid; v_s2 uuid; v_s3 uuid; v_sx uuid;
  v_app uuid; v_enr uuid; v_enr2 uuid; v_r jsonb; v_err text; v_stage text := 'setup';
begin
  select id into v_admin from public.users
   where id in (select ur.user_id from public.user_roles ur
                  join public.roles r on r.id = ur.role_id
                 where r.code='ADMIN' and ur.revoked_at is null) limit 1;
  if v_admin is null then raise exception 'PRECONDITION: no ADMIN user exists'; end if;

  insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
  values (v_u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t06a@probe.invalid',null,now(),now(),now()),
         (v_u2,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t06b@probe.invalid',null,now(),now(),now());

  insert into public.courses (code,title_ar,title_en,track,level,status)
  values ('T06-C','دورة','Probe','ARDUINO','BEGINNER','PUBLISHED') returning id into v_course;
  insert into public.cohorts (course_id,code,capacity,min_attendance_pct,status)
  values (v_course,'T06-CH',10,75,'RUNNING') returning id into v_cohort;
  insert into public.cohorts (course_id,code,capacity,status)
  values (v_course,'T06-OTHER',10,'RUNNING') returning id into v_other;

  -- 3 HELD + 1 CANCELLED. A cancelled session must never penalise a student.
  insert into public.cohort_sessions (cohort_id,session_no,scheduled_at,duration_minutes,status)
  values (v_cohort,1,now()-interval '3 days',90,'HELD') returning id into v_s1;
  insert into public.cohort_sessions (cohort_id,session_no,scheduled_at,duration_minutes,status)
  values (v_cohort,2,now()-interval '2 days',90,'HELD') returning id into v_s2;
  insert into public.cohort_sessions (cohort_id,session_no,scheduled_at,duration_minutes,status)
  values (v_cohort,3,now()-interval '1 days',90,'HELD') returning id into v_s3;
  insert into public.cohort_sessions (cohort_id,session_no,scheduled_at,duration_minutes,status)
  values (v_cohort,4,now(),90,'CANCELLED');
  insert into public.cohort_sessions (cohort_id,session_no,scheduled_at,duration_minutes,status)
  values (v_other,1,now(),90,'HELD') returning id into v_sx;

  insert into public.applications (cohort_id,applicant_user_id,status)
  values (v_cohort,v_u,'ENROLLED') returning id into v_app;
  insert into public.enrollments (application_id,cohort_id,student_user_id,status)
  values (v_app,v_cohort,v_u,'ACTIVE') returning id into v_enr;
  insert into public.applications (cohort_id,applicant_user_id,status)
  values (v_cohort,v_u2,'ENROLLED') returning id into v_app;
  insert into public.enrollments (application_id,cohort_id,student_user_id,status)
  values (v_app,v_cohort,v_u2,'ACTIVE') returning id into v_enr2;

  v_stage := 'student_marks_own_attendance';
  perform set_config('request.jwt.claims', json_build_object('sub', v_u::text)::text, true);
  begin
    perform public.record_attendance(v_enr, v_s1, 'PRESENT');
    raise exception 'BREACH: a student recorded their own attendance';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);

  v_stage := 'cross_cohort_session';
  begin
    perform public.record_attendance(v_enr, v_sx, 'PRESENT');
    raise exception 'BREACH: attendance was recorded against another cohort''s session';
  exception when others then
    if sqlerrm not like '%SESSION_COHORT_MISMATCH%' then raise; end if;
  end;

  v_stage := 'unjustified_amendment';
  perform public.record_attendance(v_enr, v_s1, 'ABSENT');
  begin
    perform public.record_attendance(v_enr, v_s1, 'PRESENT');
    raise exception 'BREACH: a recorded mark was changed with no justification (BR-09)';
  exception when others then
    if sqlerrm not like '%AMENDMENT_REASON_REQUIRED%' then raise; end if;
  end;
  perform public.record_attendance(v_enr, v_s1, 'PRESENT', null, 'Sign-in sheet corrected.');
  if (select amendment_reason from public.attendance_records
       where enrollment_id=v_enr and cohort_session_id=v_s1) is null then
    raise exception 'BREACH: the amendment reason was not persisted';
  end if;

  v_stage := 'attendance_arithmetic';
  perform public.record_attendance(v_enr, v_s2, 'LATE');      -- counts as attended
  perform public.record_attendance(v_enr, v_s3, 'EXCUSED');   -- counts as attended
  v_r := public.evaluate_completion_readiness(v_enr);
  if (v_r->>'sessions_held')::int <> 3 then
    raise exception 'BREACH: a CANCELLED session was counted (held=%)', v_r->>'sessions_held'; end if;
  if (v_r->>'attendance_pct')::numeric <> 100 then
    raise exception 'BREACH: expected 100 percent, got %', v_r->>'attendance_pct'; end if;

  perform public.record_attendance(v_enr2, v_s1, 'PRESENT');
  perform public.record_attendance(v_enr2, v_s2, 'ABSENT');
  perform public.record_attendance(v_enr2, v_s3, 'ABSENT');
  v_r := public.evaluate_completion_readiness(v_enr2);
  if (v_r->>'meets_attendance')::boolean then
    raise exception 'BREACH: 33 percent attendance satisfied a 75 percent minimum'; end if;

  -- BR-05 needs BOTH halves; each is asserted independently.
  v_stage := 'br05_attendance_half';
  begin
    perform public.mark_enrollment_completed(v_enr2, true, null);
    raise exception 'BREACH: completed with attendance below the minimum';
  exception when others then
    if sqlerrm not like '%BR05_NOT_SATISFIED%' then raise; end if;
  end;

  v_stage := 'br05_attestation_half';
  begin
    perform public.mark_enrollment_completed(v_enr, false, null);
    raise exception 'BREACH: completed without attesting that evaluations passed (D-12)';
  exception when others then
    if sqlerrm not like '%BR05_NOT_SATISFIED%' then raise; end if;
  end;

  v_stage := 'br05_satisfied';
  v_r := public.mark_enrollment_completed(v_enr, true, null);
  if v_r->>'status' <> 'COMPLETED' then
    raise exception 'BREACH: expected COMPLETED, got %', v_r->>'status'; end if;

  v_stage := 'a7_override';
  v_r := public.mark_enrollment_completed(v_enr2, false, 'Medical exemption approved.');
  if v_r->>'status' <> 'COMPLETED_BY_OVERRIDE' then
    raise exception 'BREACH: the override did not set COMPLETED_BY_OVERRIDE'; end if;
  if (select count(*) from public.audit_logs
       where entity_id=v_enr2 and action='MARK_ENROLLMENT_COMPLETED' and is_override) <> 1 then
    raise exception 'BREACH: the override was not written to the audit log (BR-09)'; end if;

  v_stage := 'm6_handoff';
  if (select count(*) from public.clearance_records
       where enrollment_id in (v_enr, v_enr2) and status = 'EVALUATING') <> 2 then
    raise exception 'BREACH: completion did not open the clearance pipeline in EVALUATING';
  end if;

  raise exception 'ALL_LMS_PASSED';
exception when others then
  get stacked diagnostics v_err = message_text;
  if v_err = 'ALL_LMS_PASSED' then raise exception 'ALL_LMS_PASSED';
  else raise exception 'FAILED [%]: %', v_stage, v_err; end if;
end $test$;
