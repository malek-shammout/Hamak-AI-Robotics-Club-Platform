-- =====================================================================================
--  M4 — manual grading (BR-09 audit) and question-bank edit integrity (D-15)
-- =====================================================================================
do $test$
declare
  v_admin uuid; v_u uuid := gen_random_uuid();
  v_course uuid; v_cohort uuid; v_test uuid; v_qa uuid; v_qb uuid; v_oa uuid;
  v_app uuid; v_att uuid; v_ansB uuid; v_res jsonb; v_new uuid;
  v_orig numeric; v_norm numeric; v_err text; v_stage text := 'setup';
begin
  select id into v_admin from public.users
   where id in (select ur.user_id from public.user_roles ur
                  join public.roles r on r.id = ur.role_id
                 where r.code='ADMIN' and ur.revoked_at is null) limit 1;
  if v_admin is null then raise exception 'PRECONDITION: no ADMIN user exists to grade'; end if;

  insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
  values (v_u,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t05@probe.invalid',null,now(),now(),now());
  insert into public.courses (code,title_ar,title_en,track,level,requires_screening,status)
  values ('T05-C','دورة','Probe','AI','BEGINNER',true,'PUBLISHED') returning id into v_course;
  insert into public.cohorts (course_id,code,capacity,status)
  values (v_course,'T05-CH',5,'OPEN') returning id into v_cohort;
  -- DRAFT while authoring, ACTIVE afterwards, so the freeze can be exercised.
  insert into public.screening_tests (cohort_id,title,duration_minutes,attempt_limit,max_score,
                                      pass_threshold,shuffle_questions,shuffle_options,status)
  values (v_cohort,'Probe',60,1,100,50,false,false,'DRAFT') returning id into v_test;

  insert into public.questions (type,stem,max_score,auto_gradable)
  values ('SINGLE_CHOICE','Auto?',40,true) returning id into v_qa;
  insert into public.question_options (question_id,order_index,option_text,is_correct)
  values (v_qa,0,'CORRECT',true) returning id into v_oa;
  insert into public.question_options (question_id,order_index,option_text,is_correct)
  values (v_qa,1,'WRONG',false);
  insert into public.questions (type,stem,max_score,auto_gradable,grading_rubric)
  values ('SHORT_ANSWER','Explain PWM.',60,false,'Duty cycle + frequency.') returning id into v_qb;
  insert into public.test_questions (screening_test_id,question_id,question_version,order_index,weight)
  values (v_test,v_qa,1,0,40),(v_test,v_qb,1,1,60);
  update public.screening_tests set status='ACTIVE' where id=v_test;

  insert into public.applications (cohort_id,applicant_user_id,status)
  values (v_cohort,v_u,'AWAITING_SCREENING') returning id into v_app;

  perform set_config('request.jwt.claims', json_build_object('sub', v_u::text)::text, true);
  v_att := public.start_test_attempt(v_app);
  perform public.save_attempt_answer(v_att, v_qa, v_oa, null);
  perform public.save_attempt_answer(v_att, v_qb, null, jsonb_build_object('text','An explanation.'));
  v_res := public.submit_test_attempt(v_att);

  -- A subjective answer must park the attempt and WITHHOLD the score.
  v_stage := 'parked_for_grading';
  if v_res->>'state' <> 'GRADING' then
    raise exception 'BREACH: expected GRADING, got %', v_res->>'state'; end if;
  if v_res->>'normalized_score' is not null then
    raise exception 'BREACH: a score was published before manual grading'; end if;

  select id into v_ansB from public.attempt_answers where test_attempt_id=v_att and question_id=v_qb;

  v_stage := 'student_grading';
  begin
    perform public.grade_attempt_answer(v_ansB, 60, 'self');
    raise exception 'BREACH: a student graded their own answer';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);

  v_stage := 'score_out_of_range';
  begin
    perform public.grade_attempt_answer(v_ansB, 999, null);
    raise exception 'BREACH: a score above the question weight was accepted';
  exception when others then
    if sqlerrm not like '%SCORE_OUT_OF_RANGE%' then raise; end if;
  end;

  v_stage := 'premature_finalise';
  begin
    perform public.finalize_attempt_grading(v_att);
    raise exception 'BREACH: grading was finalised with answers still ungraded';
  exception when others then
    if sqlerrm not like '%UNGRADED_ANSWERS_REMAIN%' then raise; end if;
  end;

  v_stage := 'unjustified_amendment';
  perform public.grade_attempt_answer(v_ansB, 45, 'Partial credit.');
  begin
    perform public.grade_attempt_answer(v_ansB, 50, null);
    raise exception 'BREACH: a recorded grade was amended with no justification (BR-09)';
  exception when others then
    if sqlerrm not like '%OVERRIDE_REASON_REQUIRED%' then raise; end if;
  end;

  v_stage := 'justified_amendment';
  perform public.grade_attempt_answer(v_ansB, 50, 'Amended after moderation.');
  select original_score into v_orig from public.attempt_answers where id=v_ansB;
  if v_orig <> 45 then raise exception 'BREACH: original_score was not preserved (got %)', v_orig; end if;

  v_stage := 'finalise';
  v_res := public.finalize_attempt_grading(v_att);
  select normalized_score into v_norm from public.test_attempts where id=v_att;
  if v_norm <> 90 then raise exception 'BREACH: expected 90 (auto 40 + manual 50), got %', v_norm; end if;

  -- D-15: a live exam must not be rewritable underneath its graded attempts.
  v_stage := 'live_question_frozen';
  begin
    update public.questions set stem='TAMPERED' where id=v_qa;
    raise exception 'BREACH: a question used by an ACTIVE test was edited';
  exception when others then
    if sqlerrm not like '%QUESTION_IS_LIVE%' then raise; end if;
  end;

  v_stage := 'answer_key_frozen';
  begin
    update public.question_options set is_correct=true where question_id=v_qa and is_correct=false;
    raise exception 'BREACH: the answer key of a live test was changed';
  exception when others then
    if sqlerrm not like '%QUESTION_IS_LIVE%' then raise; end if;
  end;

  v_stage := 'versioning';
  v_new := public.clone_question_as_new_version(v_qa);
  if (select version from public.questions where id=v_new) <> 2 then
    raise exception 'BREACH: the new version number was not incremented'; end if;
  if (select is_current from public.questions where id=v_qa) then
    raise exception 'BREACH: the superseded version is still marked current'; end if;
  if (select count(*) from public.question_options where question_id=v_new) <> 2 then
    raise exception 'BREACH: options were not cloned onto the new version'; end if;

  raise exception 'ALL_M4_GRADING_PASSED';
exception when others then
  get stacked diagnostics v_err = message_text;
  if v_err = 'ALL_M4_GRADING_PASSED' then raise exception 'ALL_M4_GRADING_PASSED';
  else raise exception 'FAILED [%]: %', v_stage, v_err; end if;
end $test$;
