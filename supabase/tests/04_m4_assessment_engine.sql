-- =====================================================================================
--  M4 — assessment engine
-- =====================================================================================
--  REGRESSION GUARD. The self-grading assertion below covers a flaw that was real and
--  exploitable: policy `self_answer_test` on attempt_answers was FOR ALL, scoping rows
--  but not COLUMNS, so a student could PATCH their own awarded_score (proven: 999.00).
--  Because BR-02 gates admission on that score, it was a route to fraudulent admission.
--  If this test ever fails, that hole is back. See claude.md D-13.
-- =====================================================================================
do $test$
declare
  v_a uuid := gen_random_uuid(); v_b uuid := gen_random_uuid();
  v_course uuid; v_cohort uuid; v_test uuid; v_q1 uuid; v_q2 uuid;
  v_o1ok uuid; v_o2bad uuid; v_app uuid; v_att uuid; v_ans uuid;
  v_paper jsonb; v_res jsonb; v_after numeric; v_err text; v_stage text := 'setup';
begin
  insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
  values (v_a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t04a@probe.invalid',null,now(),now(),now()),
         (v_b,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t04b@probe.invalid',null,now(),now(),now());

  insert into public.courses (code,title_ar,title_en,track,level,requires_screening,status)
  values ('T04-C','دورة','Probe','AI','BEGINNER',true,'PUBLISHED') returning id into v_course;
  insert into public.cohorts (course_id,code,capacity,status)
  values (v_course,'T04-CH',10,'OPEN') returning id into v_cohort;
  insert into public.screening_tests (cohort_id,title,duration_minutes,attempt_limit,max_score,
                                      pass_threshold,shuffle_questions,shuffle_options,status)
  values (v_cohort,'Probe',60,1,100,60,false,false,'ACTIVE') returning id into v_test;

  insert into public.questions (type,stem,max_score,auto_gradable)
  values ('SINGLE_CHOICE','Q1?',60,true) returning id into v_q1;
  insert into public.question_options (question_id,order_index,option_text,is_correct)
  values (v_q1,0,'CORRECT',true) returning id into v_o1ok;
  insert into public.question_options (question_id,order_index,option_text,is_correct)
  values (v_q1,1,'WRONG',false);
  insert into public.questions (type,stem,max_score,auto_gradable)
  values ('SINGLE_CHOICE','Q2?',40,true) returning id into v_q2;
  insert into public.question_options (question_id,order_index,option_text,is_correct)
  values (v_q2,0,'CORRECT',true);
  insert into public.question_options (question_id,order_index,option_text,is_correct)
  values (v_q2,1,'WRONG',false) returning id into v_o2bad;
  insert into public.test_questions (screening_test_id,question_id,question_version,order_index,weight)
  values (v_test,v_q1,1,0,60),(v_test,v_q2,1,1,40);

  insert into public.applications (cohort_id,applicant_user_id,status)
  values (v_cohort,v_a,'AWAITING_SCREENING') returning id into v_app;

  perform set_config('request.jwt.claims', json_build_object('sub', v_a::text)::text, true);
  v_stage := 'start';
  v_att := public.start_test_attempt(v_app);

  -- The answer key must never reach the client, by any route.
  v_stage := 'answer_key_leak';
  select jsonb_agg(to_jsonb(p)) into v_paper from public.get_attempt_paper(v_att) p;
  if v_paper::text ilike '%is_correct%' then
    raise exception 'BREACH: get_attempt_paper exposed is_correct';
  end if;

  v_stage := 'cross_user_save';
  perform set_config('request.jwt.claims', json_build_object('sub', v_b::text)::text, true);
  begin
    perform public.save_attempt_answer(v_att, v_q1, v_o1ok, null);
    raise exception 'BREACH: user B saved an answer on user A''s attempt';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_a::text)::text, true);
  perform public.save_attempt_answer(v_att, v_q1, v_o1ok, null);   -- correct   -> 60
  perform public.save_attempt_answer(v_att, v_q2, v_o2bad, null);  -- incorrect -> 0
  select id into v_ans from public.attempt_answers where test_attempt_id=v_att and question_id=v_q2;

  -- THE REGRESSION GUARD. `set local role authenticated` is essential: without it we run
  -- as the owner, RLS is bypassed, and this would pass vacuously.
  v_stage := 'self_grading';
  set local role authenticated;
  begin
    update public.attempt_answers set awarded_score = 999 where id = v_ans;
  exception when others then null;   -- a hard refusal is fine too
  end;
  select awarded_score into v_after from public.attempt_answers where id = v_ans;
  reset role;
  if v_after = 999 then
    raise exception 'BREACH: a student self-graded their own answer to 999 (D-13 regression)';
  end if;

  v_stage := 'auto_grading';
  v_res := public.submit_test_attempt(v_att);
  if (v_res->>'raw_score')::numeric <> 60 then
    raise exception 'BREACH: expected raw 60, got %', v_res->>'raw_score'; end if;
  if (v_res->>'normalized_score')::numeric <> 60 then
    raise exception 'BREACH: expected normalized 60, got %', v_res->>'normalized_score'; end if;

  v_stage := 'post_deadline_save';
  update public.test_attempts set state='IN_PROGRESS', deadline_at = now() - interval '1 minute'
   where id=v_att;
  begin
    perform public.save_attempt_answer(v_att, v_q1, v_o1ok, null);
    raise exception 'BREACH: an answer was saved after the deadline';
  exception when others then
    if sqlerrm not like '%ATTEMPT_EXPIRED%' then raise; end if;
  end;

  raise exception 'ALL_M4_ASSESSMENT_PASSED';
exception when others then
  get stacked diagnostics v_err = message_text;
  if v_err = 'ALL_M4_ASSESSMENT_PASSED' then raise exception 'ALL_M4_ASSESSMENT_PASSED';
  else raise exception 'FAILED [%]: %', v_stage, v_err; end if;
end $test$;
