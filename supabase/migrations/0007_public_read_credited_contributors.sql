-- =====================================================================================
--  HMK Platform — Migration 0007
--  Public pages may credit contributors, by NAME ONLY
-- =====================================================================================
--  FOUND BY: loading /en/projects/DEMO-PRJ and seeing the team member render as
--  "Not available". project_members became readable in 0006, but the join to `users`
--  returned nothing because `users` has no anon policy.
--
--  THE WRONG FIX
--    `create policy ... on users for select to anon using (true)` — that publishes
--    every member's email, phone, verification state and account status.
--
--  THE FIX TAKEN — two independent locks, BOTH required:
--    1. ROW level: anon may see a user row only if that person is credited on
--       PUBLISHED content (project member, article author, or award recipient).
--    2. COLUMN level: anon is granted SELECT on exactly three columns. Even for a
--       row the policy allows, `select email from users` is a hard privilege error.
--
--  Verified as the `anon` role: name readable, `email` refused with SQLSTATE 42501.
--  Removing either lock re-opens the leak. Do not "simplify" this to one.
-- =====================================================================================

set search_path = public, extensions, pg_catalog;

begin;

create policy "public_read_credited_contributors" on public.users
  for select to anon
  using (
    exists (select 1 from public.project_members pm
             join public.projects p on p.id = pm.project_id
            where pm.user_id = users.id and p.publication_status = 'PUBLISHED')
    or exists (select 1 from public.articles a
                where a.author_user_id = users.id and a.publication_status = 'PUBLISHED')
    or exists (select 1 from public.award_recipients ar
                join public.awards aw on aw.id = ar.award_id
               where ar.user_id = users.id and aw.publication_status = 'PUBLISHED')
  );

revoke select on public.users from anon;
grant select (id, full_name_ar, full_name_en) on public.users to anon;

comment on policy "public_read_credited_contributors" on public.users is
  'Lets public pages credit contributors. Paired with a COLUMN-level grant limiting anon to (id, full_name_ar, full_name_en). Both locks are required; neither is sufficient alone.';

commit;
