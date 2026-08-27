set search_path = public, extensions, pg_catalog;

-- =====================================================================================
--  Migration 0026 — project team membership is ADMIN / manager / project-lead only.
-- =====================================================================================
--  CLUB RULING (Session 007): "Because adding a member grants hardware requisition
--  rights (BR-12), editing project members must be strictly limited to ADMIN or the
--  specific team lead/manager role, NOT generic UPDATE holders."
--
--  THE GAP THIS CLOSES (proven before the change): `project_members` carried the
--  ordinary `staff_create` / `staff_update` / `staff_delete` policies gated on
--  M7.CREATE / M7.UPDATE / M7.DELETE. A user holding only M7.UPDATE added a member to a
--  project — and `ck_req_single_context` + `raise_requisition` treat project membership
--  as the authorisation to raise hardware requisitions against that project. So an
--  editing permission silently conferred a custody-adjacent one.
--
--  Same family as D-22, one step further: there the editable column was the row's own
--  publication state; here the editable row is somebody ELSE'S authority.
--
--  WHY A SECURITY DEFINER PREDICATE (D-20): the rule needs to ask "is the caller a LEAD
--  on this project", which reads `project_members` — the very table being protected. A
--  policy that subqueries its own table recurses, and per D-20 a policy subquerying any
--  table is subject to that table's RLS. The predicate takes no user id, only
--  auth.uid(), so it cannot be used to probe anyone else's standing.
--
--  BOOTSTRAP: a new project has no LEAD yet, so the first member can only be added by an
--  admin or an M7.APPROVE holder (the Projects team manager). That is intended — it is
--  the same asymmetry as D-18, where raising and approving are deliberately different
--  people.
-- =====================================================================================

create or replace function app.can_manage_project_team(p_project_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select
    app.is_admin()
    -- The manager role. In the seed only PROJECTS and ADMIN hold M7.APPROVE, and a
    -- future drafting/editor role holding only M7.UPDATE is deliberately excluded.
    or app.has_perm('M7.APPROVE')
    -- The project's own lead, for their own project only.
    or exists (
      select 1 from public.project_members pm
       where pm.project_id = p_project_id
         and pm.user_id = auth.uid()
         and pm.role_in_project = 'LEAD'
    );
$fn$;

comment on function app.can_manage_project_team(uuid) is
  'Club ruling (S007): project membership grants BR-12 requisition rights, so it is '
  'editable only by ADMIN, an M7.APPROVE holder, or that project''s own LEAD. Never by a '
  'generic M7.UPDATE holder. SECURITY DEFINER because the predicate reads the very table '
  'it protects (D-20).';

grant execute on function app.can_manage_project_team(uuid) to authenticated;

-- Replace the generic staff write policies on this table only.
drop policy if exists "staff_create" on public.project_members;
drop policy if exists "staff_update" on public.project_members;
drop policy if exists "staff_delete" on public.project_members;

create policy "team_managers_add_members" on public.project_members
  for insert to authenticated
  with check (app.can_manage_project_team(project_id));

create policy "team_managers_update_members" on public.project_members
  for update to authenticated
  using (app.can_manage_project_team(project_id))
  with check (app.can_manage_project_team(project_id));

create policy "team_managers_remove_members" on public.project_members
  for delete to authenticated
  using (app.can_manage_project_team(project_id));

comment on policy "team_managers_add_members" on public.project_members is
  'Do NOT restore a generic M7.CREATE/UPDATE policy here. Membership confers the BR-12 '
  'right to raise requisitions against the project; the club ruled it manager-only.';
