-- =====================================================================================
--  M2 — expertise curation (D-06)
-- =====================================================================================
--  D-06 splits ownership: A4 curates WHO can advise and at what level, the member owns
--  WHETHER they are taking work right now. Both halves have to hold for matching to be
--  correct, and the failure modes are opposite — if curation leaks, members can promote
--  themselves into the expert pool; if the availability half is ignored, members get
--  assigned work they never agreed to take.
--
--  The last assertions are the ones that matter most: they prove curation actually FEEDS
--  the matcher. A curated-but-unavailable member must not surface as a candidate, and
--  must surface the moment they opt in.
-- =====================================================================================
do $test$
declare
  v_admin uuid; v_staff uuid := gen_random_uuid(); v_member uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_deptP uuid; v_roleP uuid; v_dom uuid; v_me uuid; v_req uuid;
  v_count int; v_err text; v_stage text := 'setup';
begin
  select ur.user_id into v_admin from public.user_roles ur
    join public.roles r on r.id = ur.role_id
   where r.code = 'ADMIN' and ur.revoked_at is null limit 1;
  if v_admin is null then raise exception 'PRECONDITION: no ADMIN user exists'; end if;

  select id into v_deptP from public.departments where code = 'PROJECTS';
  select id into v_roleP from public.roles       where code = 'PROJECTS';

  insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
  values (v_staff,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t12staff@probe.invalid',null,now(),now(),now()),
         (v_member,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t12mem@probe.invalid',null,now(),now(),now()),
         (v_outsider,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t12out@probe.invalid',null,now(),now(),now());
  update public.users set user_type='MEMBER', status='ACTIVE',
         full_name_ar='عضو', full_name_en='A Member' where id = v_member;
  update public.users set user_type='MEMBER', status='ACTIVE' where id = v_staff;

  -- A4 is the PROJECTS role, deliberately NOT an admin: the point is that ordinary A4
  -- rights are enough to curate, so the screen does not need elevation.
  insert into public.user_roles (user_id, role_id, department_id, assigned_by)
  values (v_staff, v_roleP, v_deptP, v_admin);

  ------------------------------------------------------------------ A4 may curate
  -- `set local role authenticated` is load-bearing: as the owner, RLS is bypassed and
  -- every assertion below would pass without proving anything.
  v_stage := 'a4_creates_domain';
  perform set_config('request.jwt.claims', json_build_object('sub', v_staff::text)::text, true);
  set local role authenticated;
  insert into public.expertise_domains (code,name_ar,name_en)
  values ('T12-DOM','مجال','Field') returning id into v_dom;
  reset role;
  if v_dom is null then raise exception 'BREACH: A4 could not create an expertise domain'; end if;

  v_stage := 'a4_curates_expertise';
  set local role authenticated;
  insert into public.member_expertise (member_user_id, expertise_domain_id, proficiency,
                                       max_concurrent_load, curated_by, is_available)
  values (v_member, v_dom, 'EXPERT', 3, v_staff, false) returning id into v_me;

  v_stage := 'a4_can_list_members';
  -- The curation screen needs a member picker; that needs M10.READ, which PROJECTS holds.
  select count(*) into v_count from public.users
   where user_type = 'MEMBER' and status = 'ACTIVE' and id = v_member;
  reset role;
  if v_count <> 1 then
    raise exception 'BREACH: A4 cannot see members, so expertise cannot be curated';
  end if;

  ------------------------------------------------------------------ nobody else may
  v_stage := 'outsider_cannot_curate';
  perform set_config('request.jwt.claims', json_build_object('sub', v_outsider::text)::text, true);
  set local role authenticated;
  begin
    insert into public.expertise_domains (code,name_ar,name_en) values ('T12-EVIL','شر','Evil');
  exception when others then null;
  end;
  reset role;
  select count(*) into v_count from public.expertise_domains where code = 'T12-EVIL';
  if v_count > 0 then
    raise exception 'BREACH: a user with no M2 rights created an expertise domain';
  end if;

  v_stage := 'member_cannot_self_promote';
  perform set_config('request.jwt.claims', json_build_object('sub', v_member::text)::text, true);
  set local role authenticated;
  begin
    insert into public.member_expertise (member_user_id, expertise_domain_id, proficiency,
                                         max_concurrent_load, curated_by, is_available)
    values (v_member, v_dom, 'EXPERT', 99, v_member, true);
  exception when others then null;
  end;
  reset role;
  select count(*) into v_count from public.member_expertise where member_user_id = v_member;
  if v_count <> 1 then
    raise exception 'D-06 BREACH: a member curated their own expertise into existence';
  end if;

  ------------------------------------------------------------------ curation feeds matching
  v_stage := 'unavailable_is_not_a_candidate';
  perform set_config('request.jwt.claims', json_build_object('sub', v_member::text)::text, true);
  v_req := public.submit_consultation_request('T12 probe','abstract','TECHNICAL_ADVICE', array[v_dom]);
  perform set_config('request.jwt.claims', json_build_object('sub', v_staff::text)::text, true);
  perform public.triage_consultation(v_req, 'NORMAL', 'LOW');
  select count(*) into v_count from public.suggest_experts(v_req);
  if v_count <> 0 then
    raise exception 'D-06 BREACH: a curated but unavailable member was offered as a candidate';
  end if;

  v_stage := 'opting_in_makes_a_candidate';
  perform set_config('request.jwt.claims', json_build_object('sub', v_member::text)::text, true);
  perform public.set_expertise_availability(v_me, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_staff::text)::text, true);
  select count(*) into v_count from public.suggest_experts(v_req) s where s.expert_user_id = v_member;
  if v_count <> 1 then
    raise exception 'BREACH: an opted-in curated member is still not matchable';
  end if;

  v_stage := 'retiring_a_domain_is_not_a_delete';
  -- No soft delete in this schema, and live consultations reference the domain, so
  -- retirement is a flag rather than a row removal.
  set local role authenticated;
  update public.expertise_domains set is_active = false where id = v_dom;
  reset role;
  select count(*) into v_count from public.consultation_request_domains
   where consultation_request_id = v_req;
  if v_count <> 1 then
    raise exception 'BREACH: retiring a domain destroyed an existing consultations link';
  end if;

  raise exception 'ALL_M2_CURATION_PASSED';
exception when others then
  get stacked diagnostics v_err = message_text;
  if v_err = 'ALL_M2_CURATION_PASSED' then raise exception 'ALL_M2_CURATION_PASSED';
  else raise exception 'FAILED [%]: %', v_stage, v_err; end if;
end $test$;
