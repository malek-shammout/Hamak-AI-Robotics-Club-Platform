-- =====================================================================================
--  HMK Platform — Migration 0004
--  Allow anonymous reads of the PUBLIC subset of system_policies
-- =====================================================================================
--  WHY
--    schema.sql gave `system_policies` only the `admin_full_access` policy. That is
--    correct for operational config (SLA windows, loan horizons), but the public
--    contact page reads `club.location` and the locale switcher reads the i18n keys.
--    With no anon policy those reads returned zero rows and the ClubMap section
--    silently rendered nothing — found by loading the page, not by reading the SQL.
--
--  PRINCIPLE
--    Least privilege: an explicit allow-list of keys, not `using (true)` on the table.
--    Adding a new key does NOT make it public; it must be added here deliberately.
-- =====================================================================================

set search_path = public, extensions, pg_catalog;

begin;

drop policy if exists "public_read_public_config" on public.system_policies;

create policy "public_read_public_config" on public.system_policies
  for select to anon, authenticated
  using (key in ('club.location', 'i18n.supported_locales', 'i18n.default_locale'));

comment on table public.system_policies is
  'Runtime configuration. Only the keys named in the "public_read_public_config" policy '
  'are readable without authentication. Do not broaden that policy to `using (true)` — '
  'operational keys (SLA windows, loan horizons) are deliberately staff-only.';

commit;
