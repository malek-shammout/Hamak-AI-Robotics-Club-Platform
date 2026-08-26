-- =====================================================================================
--  HMK Platform — Migration 0002
--  Auth->public.users bridge and Storage buckets
-- =====================================================================================
--  Depends on: schema.sql (migration 0001), already applied.
--
--  WHY A BOOTSTRAP IS NEEDED
--    RLS on `user_roles` requires an existing ADMIN to grant any role (BR-09). The very
--    first ADMIN therefore cannot be created through the normal path — that is by design,
--    not an oversight. This migration performs that one-time grant with elevated rights.
--
--  CREDENTIALS ARE NOT SET HERE
--    The auth identity is created with NO password. The human sets their own via the
--    password-reset / magic-link flow. No credential is ever written by tooling.
-- =====================================================================================

set search_path = public, extensions, pg_catalog;

begin;

-- -------------------------------------------------------------------------------------
--  1. auth.users -> public.users bridge
--     Every Supabase Auth signup must materialise a public.users row, or the whole
--     RBAC/RLS model has nothing to hang off. D-02: one identity store.
-- -------------------------------------------------------------------------------------

create or replace function app.handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.users (id, email, full_name_ar, full_name_en, user_type, status,
                            locale, email_verified_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name_ar', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'full_name_en', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'user_type')::user_type, 'EXTERNAL_STUDENT'),
    case when new.email_confirmed_at is not null then 'ACTIVE'::user_status
         else 'PENDING_VERIFICATION'::user_status end,
    coalesce((new.raw_user_meta_data ->> 'locale')::public.locale_code, 'ar'),
    new.email_confirmed_at
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();

-- Keep verification state in sync when the user confirms their email later.
create or replace function app.handle_auth_user_confirmed() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update public.users
       set email_verified_at = new.email_confirmed_at,
           status = case when status = 'PENDING_VERIFICATION' then 'ACTIVE'::user_status
                         else status end
     where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists trg_on_auth_user_confirmed on auth.users;
create trigger trg_on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function app.handle_auth_user_confirmed();

-- -------------------------------------------------------------------------------------
--  2. (moved to 0003)
-- -------------------------------------------------------------------------------------

-- (ADMIN bootstrap moved to 0003 — it creates an auth identity, which must be run by a human.)


-- -------------------------------------------------------------------------------------
--  3. Storage buckets
--     RR-4: certificate documents need immutability -> private bucket, no public reads,
--     served only through short-lived signed URLs issued server-side.
-- -------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 26214400,
   array['image/png','image/jpeg','image/webp','image/avif','image/svg+xml','video/mp4']),
  ('certificates', 'certificates', false, 10485760,
   array['application/pdf','image/png']),
  ('evidence', 'evidence', false, 26214400,
   array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---- storage.objects policies -------------------------------------------------------
drop policy if exists "media_public_read"      on storage.objects;
drop policy if exists "media_staff_write"      on storage.objects;
drop policy if exists "media_staff_update"     on storage.objects;
drop policy if exists "media_staff_delete"     on storage.objects;
drop policy if exists "certificates_no_client" on storage.objects;
drop policy if exists "evidence_staff_read"    on storage.objects;
drop policy if exists "evidence_staff_write"   on storage.objects;

-- `media` is the only publicly readable bucket (BR-11 public content).
create policy "media_public_read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'media');

create policy "media_staff_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (app.has_perm('M9.CREATE') or app.is_admin()));

create policy "media_staff_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (app.has_perm('M9.UPDATE') or app.is_admin()))
  with check (bucket_id = 'media' and (app.has_perm('M9.UPDATE') or app.is_admin()));

create policy "media_staff_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (app.has_perm('M9.DELETE') or app.is_admin()));

-- `certificates`: NO client-side access at all, in either role. Issuance is service-role
-- only (S3), and delivery is via short-lived signed URLs minted server-side. RR-4.
-- Deliberately no policy is created for this bucket: with RLS on storage.objects,
-- absence of a policy means anon/authenticated can never read or write it.

-- `evidence`: inspection photos. Readable by M5 staff and by the holder of the checkout.
create policy "evidence_staff_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'evidence' and (app.has_perm('M5.READ') or app.is_admin()));

create policy "evidence_staff_write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidence' and (app.has_perm('M5.CREATE') or app.is_admin()));

commit;
