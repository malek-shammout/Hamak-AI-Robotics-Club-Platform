-- =====================================================================================
--  BR-11 / D-08 — publishing is gated on APPROVE, not UPDATE
-- =====================================================================================
--  REGRESSION GUARD for a proven gap. Before migration 0025, `staff_update` on the five
--  publishable entities carried no column restriction, so anyone who could EDIT a row
--  could also flip `publication_status` and put it on the public site. A user granted
--  M7.READ/CREATE/UPDATE and explicitly NOT M7.APPROVE published a project, with no
--  error — the permission model drew the line and nothing enforced it.
--
--  The test deliberately builds a role that does NOT exist in the seed. Every seeded
--  role holding UPDATE also holds APPROVE, which is precisely why this went unnoticed:
--  the distinction was never exercised. An authoring UI invites exactly such a role
--  (a member drafts, a lead publishes), so the guard must hold before one exists.
--
--  `set local role authenticated` is load-bearing. As the owner, RLS and these checks
--  are bypassed and every negative assertion below passes vacuously.
-- =====================================================================================
do $test$
declare
  v_admin uuid; v_drafter uuid := gen_random_uuid();
  v_role uuid; v_dept uuid; v_perm uuid;
  v_proj uuid; v_event uuid; v_venue uuid;
  v_count int; v_status text; v_stamp timestamptz;
  v_fake constant timestamptz := '2001-01-01T00:00:00Z';
  v_err text; v_stage text := 'setup';
begin
  select ur.user_id into v_admin from public.user_roles ur
    join public.roles r on r.id = ur.role_id
   where r.code = 'ADMIN' and ur.revoked_at is null limit 1;
  if v_admin is null then raise exception 'PRECONDITION: no ADMIN user exists'; end if;

  select id into v_dept from public.departments where code = 'PROJECTS';

  insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
  values (v_drafter,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','t13draft@probe.invalid',null,now(),now(),now());
  update public.users set user_type='MEMBER', status='ACTIVE' where id = v_drafter;

  -- A drafting role: may write, may not publish. Deliberately not a seeded role.
  insert into public.roles (code, name_ar, name_en, is_system)
  values ('T13_DRAFTER','محرر','Drafter', false) returning id into v_role;
  for v_perm in
    select id from public.permissions
     where code in ('M7.READ','M7.CREATE','M7.UPDATE',
                    'M8.READ','M8.CREATE','M8.UPDATE',
                    'M9.READ','M9.CREATE','M9.UPDATE')
  loop
    insert into public.role_permissions (role_id, permission_id) values (v_role, v_perm);
  end loop;
  insert into public.user_roles (user_id, role_id, department_id, assigned_by)
  values (v_drafter, v_role, v_dept, v_admin);

  insert into public.projects (code, title_ar, title_en, status, publication_status)
  values ('T13-PROJ','مشروع','Project','IN_PROGRESS','DRAFT') returning id into v_proj;

  -- venues are NOT bilingual (single `name`), and the event type column is `type`.
  insert into public.venues (name, capacity) values ('Reading Hall', 40) returning id into v_venue;
  insert into public.events (code, title_ar, title_en, type, venue_id,
                             starts_at, ends_at, publication_status)
  values ('T13-EVT','فعالية','Event','WORKSHOP', v_venue,
          now() + interval '7 days', now() + interval '7 days 2 hours', 'DRAFT')
  returning id into v_event;

  ------------------------------------------------------------------ the guard itself
  v_stage := 'drafter_cannot_publish_project';
  perform set_config('request.jwt.claims', json_build_object('sub', v_drafter::text)::text, true);
  set local role authenticated;
  begin
    -- Supplying published_at by hand is what defeated ck_project_published_stamped.
    update public.projects set publication_status='PUBLISHED', published_at=now() where id=v_proj;
  exception when insufficient_privilege then null;
  end;
  reset role;
  select publication_status::text into v_status from public.projects where id=v_proj;
  if v_status <> 'DRAFT' then
    raise exception 'BR-11 BREACH: a user without M7.APPROVE published a project (status=%)', v_status;
  end if;

  v_stage := 'drafter_cannot_publish_event';
  set local role authenticated;
  begin
    update public.events set publication_status='PUBLISHED', published_at=now() where id=v_event;
  exception when insufficient_privilege then null;
  end;
  reset role;
  select publication_status::text into v_status from public.events where id=v_event;
  if v_status <> 'DRAFT' then
    raise exception 'BR-11 BREACH: a user without M8.APPROVE published an event (status=%)', v_status;
  end if;

  v_stage := 'drafter_cannot_insert_already_published';
  -- The INSERT path matters as much as UPDATE: creating a row straight into PUBLISHED
  -- would sidestep a guard that only watched transitions.
  set local role authenticated;
  begin
    insert into public.articles (translation_group_id, locale, slug, title, body,
                                 publication_status, published_at)
    values (gen_random_uuid(), 'en', 't13-article', 'T', 'B', 'PUBLISHED', now());
  exception when insufficient_privilege then null;
  end;
  reset role;
  select count(*) into v_count from public.articles where slug = 't13-article';
  if v_count > 0 then
    raise exception 'BR-11 BREACH: a user without M9.APPROVE created an already-published article';
  end if;

  ------------------------------------------------------------------ drafting still works
  -- A guard that also blocks legitimate drafting is a broken guard, not a strict one.
  v_stage := 'drafter_can_still_edit_a_draft';
  set local role authenticated;
  update public.projects set title_en='Edited draft' where id=v_proj;
  reset role;
  if (select title_en from public.projects where id=v_proj) <> 'Edited draft' then
    raise exception 'BREACH: the drafting role cannot edit a draft it owns';
  end if;

  v_stage := 'drafter_can_submit_for_review';
  set local role authenticated;
  update public.projects set publication_status='PENDING_REVIEW' where id=v_proj;
  reset role;
  if (select publication_status::text from public.projects where id=v_proj) <> 'PENDING_REVIEW' then
    raise exception 'BREACH: the drafting role cannot submit work for review';
  end if;

  v_stage := 'drafter_can_withdraw_to_draft';
  set local role authenticated;
  update public.projects set publication_status='DRAFT' where id=v_proj;
  reset role;
  if (select publication_status::text from public.projects where id=v_proj) <> 'DRAFT' then
    raise exception 'BREACH: the drafting role cannot withdraw its own submission';
  end if;

  ------------------------------------------------------------------ approver + stamp
  v_stage := 'approver_can_publish';
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
  set local role authenticated;
  -- A deliberately bogus stamp: the server must ignore it.
  update public.projects set publication_status='PUBLISHED', published_at=v_fake where id=v_proj;
  reset role;
  select publication_status::text, published_at into v_status, v_stamp
    from public.projects where id=v_proj;
  if v_status <> 'PUBLISHED' then
    raise exception 'BREACH: an approver could not publish (status=%)', v_status;
  end if;

  v_stage := 'published_at_is_server_set';
  if v_stamp <= now() - interval '1 minute' then
    raise exception 'BREACH: published_at was taken from the client (got %) — a stamp the caller dictates is not evidence', v_stamp;
  end if;

  v_stage := 'editing_a_published_row_stays_open';
  -- Only the transition is gated; a drafter fixing a typo on a live page must still work.
  perform set_config('request.jwt.claims', json_build_object('sub', v_drafter::text)::text, true);
  set local role authenticated;
  update public.projects set title_en='Typo fixed after publication' where id=v_proj;
  reset role;
  if (select title_en from public.projects where id=v_proj) <> 'Typo fixed after publication' then
    raise exception 'BREACH: the guard also blocked an ordinary edit of a published row';
  end if;

  v_stage := 'drafter_cannot_unpublish';
  set local role authenticated;
  begin
    update public.projects set publication_status='REJECTED' where id=v_proj;
  exception when insufficient_privilege then null;
  end;
  reset role;
  if (select publication_status::text from public.projects where id=v_proj) <> 'PUBLISHED' then
    raise exception 'BR-11 BREACH: a user without M7.APPROVE changed the publication state of a live row';
  end if;

  raise exception 'ALL_BR11_PUBLISH_AUTHORISATION_PASSED';
exception when others then
  get stacked diagnostics v_err = message_text;
  if v_err = 'ALL_BR11_PUBLISH_AUTHORISATION_PASSED' then
    raise exception 'ALL_BR11_PUBLISH_AUTHORISATION_PASSED';
  else raise exception 'FAILED [%]: %', v_stage, v_err; end if;
end $test$;
