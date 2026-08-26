-- =====================================================================================
--  M5 — custody (BR-07, BR-12, BR-13) and liability (BR-06)
-- =====================================================================================
--  REGRESSION GUARD. The waiver assertions below cover a gap that was real and proven:
--  `ck_liability_waiver_actor` only requires that SOMEONE is named, and `staff_update`
--  granted UPDATE to anyone holding M5.UPDATE. A LOGISTICS member waived a 250 SYP
--  liability naming themselves, while claude.md §4 documents the rule as A7-only.
--  Custody and liability are now RPC-write-only. If this test fails, that hole is back.
-- =====================================================================================
do $test$
declare
  v_admin uuid; v_log uuid := gen_random_uuid(); v_stu uuid := gen_random_uuid();
  v_deptL uuid; v_roleL uuid;
  v_cat uuid; v_type uuid; v_bulk_type uuid; v_unit uuid; v_unit2 uuid;
  v_course uuid; v_cohort uuid; v_app uuid; v_enr uuid;
  v_co uuid; v_co2 uuid; v_line uuid; v_liab uuid; v_res jsonb;
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
  values (v_log,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t07log@probe.invalid',null,now(),now(),now()),
         (v_stu,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t07stu@probe.invalid',null,now(),now(),now());
  update public.users set user_type = 'MEMBER', status = 'ACTIVE' where id = v_log;
  insert into public.user_roles (user_id, role_id, department_id) values (v_log, v_roleL, v_deptL);

  insert into public.asset_categories (code,name_ar,name_en) values ('T07-CAT','ف','Cat') returning id into v_cat;
  insert into public.asset_types (asset_category_id,name,manufacturer,model,tracking_mode,unit_cost,currency)
  values (v_cat,'Kit','Acme','T07-A','SERIALIZED',250,'SYP') returning id into v_type;
  insert into public.asset_types (asset_category_id,name,manufacturer,model,tracking_mode,is_consumable,unit_cost,currency)
  values (v_cat,'Wire','Acme','T07-B','BULK',true,5,'SYP') returning id into v_bulk_type;
  insert into public.asset_units (asset_type_id,asset_tag) values (v_type,'T07-TAG-1') returning id into v_unit;
  insert into public.asset_units (asset_type_id,asset_tag) values (v_type,'T07-TAG-2') returning id into v_unit2;

  insert into public.courses (code,title_ar,title_en,track,level,status)
  values ('T07-C','د','P','ARDUINO','BEGINNER','PUBLISHED') returning id into v_course;
  insert into public.cohorts (course_id,code,capacity,status)
  values (v_course,'T07-CH',5,'RUNNING') returning id into v_cohort;
  insert into public.applications (cohort_id,applicant_user_id,status)
  values (v_cohort,v_stu,'ENROLLED') returning id into v_app;
  insert into public.enrollments (application_id,cohort_id,student_user_id,status)
  values (v_app,v_cohort,v_stu,'ACTIVE') returning id into v_enr;

  ------------------------------------------------------------------ authorisation
  v_stage := 'student_issues_checkout';
  perform set_config('request.jwt.claims', json_build_object('sub', v_stu::text)::text, true);
  begin
    perform public.issue_checkout(
      p_custody_type => 'STUDENT', p_holder_user_id => v_stu,
      p_due_at => now() + interval '7 days',
      p_lines => jsonb_build_array(jsonb_build_object('asset_type_id', v_type, 'asset_unit_id', v_unit)),
      p_enrollment_id => v_enr);
    raise exception 'BREACH: a student issued custody to themselves';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_log::text)::text, true);

  ------------------------------------------------------------------ BR-12
  v_stage := 'br12_student_without_enrollment';
  begin
    perform public.issue_checkout(
      p_custody_type => 'STUDENT', p_holder_user_id => v_stu,
      p_due_at => now() + interval '7 days',
      p_lines => jsonb_build_array(jsonb_build_object('asset_type_id', v_type, 'asset_unit_id', v_unit)));
    raise exception 'BREACH: student custody issued with no enrollment (BR-12)';
  exception when others then
    if sqlerrm not like '%ENROLLMENT_REQUIRED%' then raise; end if;
  end;

  v_stage := 'br12_team_without_approved_requisition';
  begin
    perform public.issue_checkout(
      p_custody_type => 'PROJECT_TEAM', p_holder_user_id => v_stu,
      p_due_at => now() + interval '7 days',
      p_lines => jsonb_build_array(jsonb_build_object('asset_type_id', v_type, 'asset_unit_id', v_unit)),
      p_requisition_id => gen_random_uuid());
    raise exception 'BREACH: team custody issued without an approved requisition (BR-12)';
  exception when others then
    if sqlerrm not like '%REQUISITION_NOT_APPROVED%' then raise; end if;
  end;

  v_stage := 'due_date_in_past';
  begin
    perform public.issue_checkout(
      p_custody_type => 'STUDENT', p_holder_user_id => v_stu,
      p_due_at => now() - interval '1 day',
      p_lines => jsonb_build_array(jsonb_build_object('asset_type_id', v_type, 'asset_unit_id', v_unit)),
      p_enrollment_id => v_enr);
    raise exception 'BREACH: custody issued with a due date in the past';
  exception when others then
    if sqlerrm not like '%DUE_DATE_IN_PAST%' then raise; end if;
  end;

  ------------------------------------------------------------------ legitimate issue
  v_stage := 'issue';
  v_co := public.issue_checkout(
    p_custody_type => 'STUDENT', p_holder_user_id => v_stu,
    p_due_at => now() + interval '7 days',
    p_lines => jsonb_build_array(
      jsonb_build_object('asset_type_id', v_type, 'asset_unit_id', v_unit),
      jsonb_build_object('asset_type_id', v_bulk_type, 'quantity', 3)),
    p_enrollment_id => v_enr);
  if (select status from public.asset_units where id = v_unit) <> 'CHECKED_OUT' then
    raise exception 'BREACH: the serialized unit was not marked CHECKED_OUT';
  end if;

  ------------------------------------------------------------------ BR-07
  v_stage := 'br07_double_custody';
  begin
    perform public.issue_checkout(
      p_custody_type => 'STUDENT', p_holder_user_id => v_stu,
      p_due_at => now() + interval '7 days',
      p_lines => jsonb_build_array(jsonb_build_object('asset_type_id', v_type, 'asset_unit_id', v_unit)),
      p_enrollment_id => v_enr);
    raise exception 'BREACH: the same serialized unit was issued twice (BR-07)';
  exception when others then
    if sqlerrm not like '%UNIT_ALREADY_CHECKED_OUT%' and sqlerrm not like '%UNIT_NOT_AVAILABLE%' then raise; end if;
  end;

  ------------------------------------------------------------------ CK_RETURN_INSPECTED
  select cl.id into v_line from public.checkout_lines cl
   where cl.checkout_id = v_co and cl.asset_unit_id = v_unit;

  v_stage := 'inspection_required';
  begin
    perform public.check_in_line(v_line, null);
    raise exception 'BREACH: a line was checked in with no recorded condition';
  exception when others then
    if sqlerrm not like '%CONDITION_REQUIRED%' then raise; end if;
  end;

  ------------------------------------------------------------------ BR-06
  v_stage := 'br06_damage_opens_liability';
  v_res := public.check_in_line(v_line, 'DAMAGED', 'Cracked casing.');
  if (v_res->>'liability_id') is null then
    raise exception 'BREACH: a DAMAGED return did not open a liability (BR-06)';
  end if;
  v_liab := (v_res->>'liability_id')::uuid;
  if (select assessed_value from public.liability_records where id = v_liab) <> 250 then
    raise exception 'BREACH: the liability was not valued from the asset type unit cost';
  end if;
  if (select status from public.asset_units where id = v_unit) <> 'UNDER_REPAIR' then
    raise exception 'BREACH: a damaged unit was returned straight to AVAILABLE';
  end if;

  ------------------------------------------------------------------ BR-13
  v_stage := 'br13_blocks_new_custody';
  begin
    perform public.issue_checkout(
      p_custody_type => 'STUDENT', p_holder_user_id => v_stu,
      p_due_at => now() + interval '7 days',
      p_lines => jsonb_build_array(jsonb_build_object('asset_type_id', v_type, 'asset_unit_id', v_unit2)),
      p_enrollment_id => v_enr);
    raise exception 'BREACH: new custody issued while a liability was unresolved (BR-13)';
  exception when others then
    if sqlerrm not like '%HOLDER_HAS_OPEN_LIABILITY%' then raise; end if;
  end;

  v_stage := 'br13_override_requires_admin';
  begin
    perform public.issue_checkout(
      p_custody_type => 'STUDENT', p_holder_user_id => v_stu,
      p_due_at => now() + interval '7 days',
      p_lines => jsonb_build_array(jsonb_build_object('asset_type_id', v_type, 'asset_unit_id', v_unit2)),
      p_enrollment_id => v_enr,
      p_override_justification => 'Logistics wants to override.');
    raise exception 'BREACH: a non-admin overrode the BR-13 custody block';
  exception when insufficient_privilege then null;
  end;

  ------------------------------------------------------------------ THE REGRESSION GUARD
  -- `set local role authenticated` is essential: without it we run as the owner, RLS is
  -- bypassed, and this assertion would pass vacuously.
  v_stage := 'direct_write_blocked';
  set local role authenticated;
  begin
    update public.liability_records
       set status = 'RESOLVED_WAIVED', waived_by = v_log, waiver_justification = 'Direct write.'
     where id = v_liab;
  exception when others then null;
  end;
  reset role;
  if (select status from public.liability_records where id = v_liab) = 'RESOLVED_WAIVED' then
    raise exception 'BREACH: liability waived by DIRECT WRITE, bypassing resolve_liability (D-13 regression)';
  end if;

  v_stage := 'br06_waiver_requires_admin';
  begin
    perform public.resolve_liability(v_liab, 'RESOLVED_WAIVED', 'Logistics waiving.');
    raise exception 'BREACH: a LOGISTICS member waived a liability. BR-06 says A7-only.';
  exception when insufficient_privilege then null;
  end;

  v_stage := 'non_waiver_resolution_allowed';
  perform public.resolve_liability(v_liab, 'RESOLVED_REPAIRED', 'Casing replaced in-house.');
  if (select status from public.liability_records where id = v_liab) <> 'RESOLVED_REPAIRED' then
    raise exception 'BREACH: Logistics could not record a legitimate repair resolution';
  end if;

  v_stage := 'br13_clears_after_resolution';
  v_co2 := public.issue_checkout(
    p_custody_type => 'STUDENT', p_holder_user_id => v_stu,
    p_due_at => now() + interval '7 days',
    p_lines => jsonb_build_array(jsonb_build_object('asset_type_id', v_type, 'asset_unit_id', v_unit2)),
    p_enrollment_id => v_enr);
  if v_co2 is null then
    raise exception 'BREACH: custody still blocked after the liability was resolved';
  end if;

  raise exception 'ALL_M5_CUSTODY_PASSED';
exception when others then
  get stacked diagnostics v_err = message_text;
  if v_err = 'ALL_M5_CUSTODY_PASSED' then raise exception 'ALL_M5_CUSTODY_PASSED';
  else raise exception 'FAILED [%]: %', v_stage, v_err; end if;
end $test$;
