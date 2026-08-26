-- =====================================================================================
--  M3 — offer response  (BR-04 expiry, ownership, capacity)
-- =====================================================================================
--  respond_to_offer is SECURITY DEFINER and therefore bypasses RLS. Its ownership
--  assertion against auth.uid() IS the security boundary (D-11).
-- =====================================================================================
do $test$
declare
  v_a uuid := gen_random_uuid(); v_b uuid := gen_random_uuid();
  v_course uuid; v_cohort uuid; v_app uuid; v_err text; v_stage text := 'setup';
begin
  insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
  values (v_a,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t02a@probe.invalid',null,now(),now(),now()),
         (v_b,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t02b@probe.invalid',null,now(),now(),now());

  insert into public.courses (code,title_ar,title_en,track,level,status)
  values ('T02-C','دورة','Probe','AI','BEGINNER','PUBLISHED') returning id into v_course;
  insert into public.cohorts (course_id,code,capacity,status)
  values (v_course,'T02-CH',5,'OPEN') returning id into v_cohort;
  insert into public.applications (cohort_id,applicant_user_id,status,offer_expires_at)
  values (v_cohort, v_a, 'OFFERED', now() + interval '2 days') returning id into v_app;

  v_stage := 'cross_user_acceptance';
  perform set_config('request.jwt.claims', json_build_object('sub', v_b::text)::text, true);
  begin
    perform public.respond_to_offer(v_app, true);
    raise exception 'BREACH: user B accepted user A''s offer';
  exception when insufficient_privilege then null;
  end;

  v_stage := 'owner_accepts';
  perform set_config('request.jwt.claims', json_build_object('sub', v_a::text)::text, true);
  if public.respond_to_offer(v_app, true) <> 'ENROLLED' then
    raise exception 'BREACH: the rightful owner could not accept';
  end if;
  if not exists (select 1 from public.enrollments where application_id = v_app) then
    raise exception 'BREACH: acceptance did not create an enrollment';
  end if;

  -- BR-04 is evaluated lazily here as well as by the scheduler, so a missed cron run
  -- can never let a stale offer through.
  v_stage := 'expired_offer';
  insert into public.applications (cohort_id,applicant_user_id,status,offer_expires_at)
  values (v_cohort, v_b, 'OFFERED', now() - interval '1 hour') returning id into v_app;
  perform set_config('request.jwt.claims', json_build_object('sub', v_b::text)::text, true);
  if public.respond_to_offer(v_app, true) <> 'EXPIRED' then
    raise exception 'BREACH: an elapsed offer was accepted (BR-04)';
  end if;

  raise exception 'ALL_M3_OFFERS_PASSED';
exception when others then
  get stacked diagnostics v_err = message_text;
  if v_err = 'ALL_M3_OFFERS_PASSED' then raise exception 'ALL_M3_OFFERS_PASSED';
  else raise exception 'FAILED [%]: %', v_stage, v_err; end if;
end $test$;
