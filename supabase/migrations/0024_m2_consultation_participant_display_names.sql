set search_path = public, extensions, pg_catalog;

-- =====================================================================================
--  Migration 0024 — participants could not see each other's names.
-- =====================================================================================
--  PROVEN: with the expert assigned and posting into the thread, the student's join to
--  `users` returned 0 rows and the sender name resolved to NULL. `users.self_read_profile`
--  scopes reads to `id = app.uid()` (or M10.READ), so each side sees only itself. The
--  thread would have rendered every counterpart message unattributed.
--
--  Same shape as the "contributor names" gap fixed in 0007 — and the fix has the same
--  shape too, minimal disclosure rather than a broad row policy:
--
--  A row policy on `users` granting the counterpart access would expose the WHOLE row —
--  email, phone, everything the authenticated role holds column privileges on. What the
--  thread actually needs is a display name. So this returns names ONLY, for participants
--  ONLY, and refuses everyone else outright.
-- =====================================================================================

create or replace function public.get_consultation_participants(p_request_id uuid)
returns table (user_id uuid, full_name_ar varchar, full_name_en varchar)
language plpgsql stable security definer set search_path = public, pg_temp as $fn$
begin
  -- The authorisation assertion IS the boundary (D-11). Without it, this function would
  -- hand any signed-in user the names attached to any consultation id they guessed.
  if not (app.is_consultation_participant(p_request_id) or app.has_perm('M2.READ')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
    select u.id, u.full_name_ar, u.full_name_en
      from public.users u
     where u.id = (select cr.requester_user_id from public.consultation_requests cr
                    where cr.id = p_request_id)
    union
    select u.id, u.full_name_ar, u.full_name_en
      from public.users u
      join public.consultation_assignments ca on ca.expert_user_id = u.id
     where ca.consultation_request_id = p_request_id;
end $fn$;

comment on function public.get_consultation_participants(uuid) is
  'Display names for one thread''s participants. Deliberately narrow: names only, and '
  'only for someone already in the thread. A row policy on users would have leaked the '
  'entire row to satisfy the same need.';

revoke all on function public.get_consultation_participants(uuid) from public, anon;
grant execute on function public.get_consultation_participants(uuid) to authenticated;
