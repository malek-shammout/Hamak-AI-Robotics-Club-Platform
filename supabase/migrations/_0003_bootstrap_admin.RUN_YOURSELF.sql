-- =====================================================================================
--  HMK Platform — Migration 0003 (RUN THIS YOURSELF)
--  First-ADMIN bootstrap
-- =====================================================================================
--  This file is separated deliberately. It creates an authentication identity, which is
--  account creation — that must be performed by a human, not by tooling.
--
--  HOW TO RUN
--    Supabase Dashboard -> SQL Editor -> paste this file -> Run.
--
--  NO PASSWORD IS SET BY THIS SCRIPT.
--  After running it: Dashboard -> Authentication -> Users -> the admin row -> "Send
--  password recovery", or use the app's "Forgot password" flow. You choose the password;
--  it is never written by, shown to, or known by any tool.
--
--  Change v_email below if the admin should be a club address rather than a personal one.
--  Depends on: 0001 (schema.sql) and 0002 (auth bridge) already applied.
-- =====================================================================================

set search_path = public, extensions, pg_catalog;

begin;

do $bootstrap$
declare
  v_email    text := 'malek.shammout@gmail.com';
  v_uid      uuid;
  v_admin_dept uuid;
  v_admin_role uuid;
begin
  select id into v_admin_dept from public.departments where code = 'ADMIN';
  select id into v_admin_role from public.roles       where code = 'ADMIN';
  if v_admin_dept is null or v_admin_role is null then
    raise exception 'Bootstrap aborted: ADMIN department/role missing. Was schema.sql seeded?';
  end if;

  select id into v_uid from auth.users where email = v_email;

  if v_uid is null then
    v_uid := gen_random_uuid();
    -- NO PASSWORD IS SET. encrypted_password stays null; the human uses password reset.
    insert into auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email,
      null, now(),
      jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
      jsonb_build_object('full_name_ar','مدير النظام','full_name_en','System Administrator',
                         'user_type','MEMBER','locale','ar'),
      now(), now()
    );
    raise notice 'Created auth identity for % (no password set)', v_email;
  else
    raise notice 'auth identity for % already exists — reusing', v_email;
  end if;

  -- The bridge trigger inserts public.users; force MEMBER/ACTIVE for the admin.
  insert into public.users (id, email, full_name_ar, full_name_en, user_type, status, locale,
                            email_verified_at)
  values (v_uid, v_email, 'مدير النظام', 'System Administrator', 'MEMBER', 'ACTIVE', 'ar', now())
  on conflict (id) do update
    set user_type = 'MEMBER', status = 'ACTIVE',
        full_name_ar = excluded.full_name_ar, full_name_en = excluded.full_name_en;

  insert into public.member_profiles (user_id, primary_department_id, joined_on, membership_status)
  values (v_uid, v_admin_dept, current_date, 'ACTIVE')
  on conflict (user_id) do update set primary_department_id = excluded.primary_department_id;

  -- The grant that cannot be made through the normal path (BR-09 chicken-and-egg).
  if not exists (
    select 1 from public.user_roles
     where user_id = v_uid and role_id = v_admin_role and revoked_at is null
  ) then
    insert into public.user_roles (user_id, role_id, department_id, assigned_by)
    values (v_uid, v_admin_role, v_admin_dept, v_uid);
    raise notice 'Granted ADMIN to %', v_email;
  end if;

  -- BR-09: the bootstrap itself is an auditable event.
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id,
                                 after_state, is_override, justification)
  values (v_uid, 'BOOTSTRAP_ADMIN', 'user_roles', v_uid,
          jsonb_build_object('email', v_email, 'role', 'ADMIN'),
          true,
          'First-admin bootstrap. RLS on user_roles requires an existing ADMIN to grant '
          'any role, so the initial grant is necessarily made with elevated rights.');
end $bootstrap$;

commit;

-- Verify afterwards:
--   select u.email, r.code, ur.assigned_at
--     from user_roles ur
--     join users u on u.id = ur.user_id
--     join roles r on r.id = ur.role_id
--    where r.code = 'ADMIN' and ur.revoked_at is null;
