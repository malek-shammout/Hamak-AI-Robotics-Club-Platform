-- =====================================================================================
--  BR-12 / D-23 — project team membership is manager-only
-- =====================================================================================
--  REGRESSION GUARD for a proven gap, closed by migration 0026 on a club ruling.
--
--  Project membership is not merely descriptive: `raise_requisition` treats it as the
--  authorisation to raise hardware requisitions against that project (BR-12). Before
--  0026, `project_members` carried the ordinary staff write policies, so a user holding
--  only M7.UPDATE could add anyone — silently converting an editing permission into a
--  custody-adjacent one. Proven: a generic editor added a member and it persisted.
--
--  The club's ruling: ADMIN, the manager role, or that project's own LEAD. Never a
--  generic UPDATE holder.
--
--  `set local role authenticated` is load-bearing throughout. As the owner, RLS is
--  bypassed and every negative assertion below passes vacuously.
-- =====================================================================================
do $test$
declare
  v_admin uuid;
  v_editor uuid := gen_random_uuid(); v_lead uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid(); v_stranger uuid := gen_random_uuid();
  v_role uuid; v_dept uuid; v_perm uuid; v_projA uuid; v_projB uuid;
  v_count int; v_err text; v_stage text := 'setup';
begin
  select ur.user_id into v_admin from public.user_roles ur
    join public.roles r on r.id = ur.role_id
   where r.code = 'ADMIN' and ur.revoked_at is null limit 1;
  if v_admin is null then raise exception 'PRECONDITION: no ADMIN user exists'; end if;

  select id into v_dept from public.departments where code = 'PROJECTS';

  insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
  select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
         id::text || '@probe.invalid', null, now(), now(), now()
    from (values (v_editor),(v_lead),(v_member),(v_stranger)) v(id);
  update public.users set user_type='MEMBER', status='ACTIVE'
   where id in (v_editor, v_lead, v_member, v_stranger);

  -- A generic editor: M7.UPDATE, but NOT admin, NOT M7.APPROVE, NOT a project lead.
  -- Deliberately not a seeded role — every seeded role holding UPDATE also holds
  -- APPROVE, which is exactly why this gap went unnoticed.
  insert into public.roles (code, name_ar, name_en, is_system)
  values ('T14_EDITOR','محرر','Editor', false) returning id into v_role;
  for v_perm in select id from public.permissions where code in ('M7.READ','M7.CREATE','M7.UPDATE')
  loop insert into public.role_permissions (role_id, permission_id) values (v_role, v_perm); end loop;
  insert into public.user_roles (user_id, role_id, department_id, assigned_by)
  values (v_editor, v_role, v_dept, v_admin);

  insert into public.projects (code, title_ar, title_en, status, publication_status)
  values ('T14-A','أ','Project A','IN_PROGRESS','DRAFT') returning id into v_projA;
  insert into public.projects (code, title_ar, title_en, status, publication_status)
  values ('T14-B','ب','Project B','IN_PROGRESS','DRAFT') returning id into v_projB;

  ------------------------------------------------------------------ bootstrap
  v_stage := 'admin_seeds_the_lead';
  -- A new project has no LEAD, so only an admin or manager can seed the first member.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
  set local role authenticated;
  insert into public.project_members (project_id, user_id, role_in_project)
  values (v_projA, v_lead, 'LEAD');
  reset role;
  select count(*) into v_count from public.project_members
   where project_id = v_projA and user_id = v_lead;
  if v_count <> 1 then
    raise exception 'BREACH: an admin could not seed the first project member';
  end if;

  ------------------------------------------------------------------ the guard
  v_stage := 'generic_editor_cannot_add';
  perform set_config('request.jwt.claims', json_build_object('sub', v_editor::text)::text, true);
  set local role authenticated;
  begin
    insert into public.project_members (project_id, user_id, role_in_project)
    values (v_projA, v_member, 'HARDWARE');
  exception when others then null;
  end;
  reset role;
  select count(*) into v_count from public.project_members
   where project_id = v_projA and user_id = v_member;
  if v_count > 0 then
    raise exception 'BR-12 BREACH: a generic M7.UPDATE holder granted project membership, which carries the right to raise requisitions';
  end if;

  v_stage := 'generic_editor_cannot_remove';
  -- Removal matters as much as addition: stripping the lead would leave the project
  -- manageable only by an admin, which is a denial-of-service on the team.
  set local role authenticated;
  begin
    delete from public.project_members where project_id = v_projA and user_id = v_lead;
  exception when others then null;
  end;
  reset role;
  select count(*) into v_count from public.project_members
   where project_id = v_projA and user_id = v_lead;
  if v_count <> 1 then
    raise exception 'BR-12 BREACH: a generic M7.UPDATE holder removed a project lead';
  end if;

  v_stage := 'stranger_cannot_add';
  perform set_config('request.jwt.claims', json_build_object('sub', v_stranger::text)::text, true);
  set local role authenticated;
  begin
    insert into public.project_members (project_id, user_id, role_in_project)
    values (v_projB, v_stranger, 'LEAD');
  exception when others then null;
  end;
  reset role;
  select count(*) into v_count from public.project_members where project_id = v_projB;
  if v_count > 0 then
    raise exception 'BR-12 BREACH: a signed-in user with no M7 rights added themselves to a project';
  end if;

  ------------------------------------------------------------------ the lead may
  v_stage := 'lead_manages_own_project';
  perform set_config('request.jwt.claims', json_build_object('sub', v_lead::text)::text, true);
  set local role authenticated;
  insert into public.project_members (project_id, user_id, role_in_project)
  values (v_projA, v_member, 'HARDWARE');
  reset role;
  select count(*) into v_count from public.project_members
   where project_id = v_projA and user_id = v_member;
  if v_count <> 1 then
    raise exception 'BREACH: a project lead cannot manage their own team';
  end if;

  v_stage := 'lead_cannot_cross_projects';
  -- Being a lead somewhere is not authority everywhere.
  set local role authenticated;
  begin
    insert into public.project_members (project_id, user_id, role_in_project)
    values (v_projB, v_member, 'HARDWARE');
  exception when others then null;
  end;
  reset role;
  select count(*) into v_count from public.project_members where project_id = v_projB;
  if v_count > 0 then
    raise exception 'BR-12 BREACH: a lead of one project added members to a project they do not lead';
  end if;

  raise exception 'ALL_BR12_TEAM_MEMBERSHIP_PASSED';
exception when others then
  get stacked diagnostics v_err = message_text;
  if v_err = 'ALL_BR12_TEAM_MEMBERSHIP_PASSED' then
    raise exception 'ALL_BR12_TEAM_MEMBERSHIP_PASSED';
  else raise exception 'FAILED [%]: %', v_stage, v_err; end if;
end $test$;
