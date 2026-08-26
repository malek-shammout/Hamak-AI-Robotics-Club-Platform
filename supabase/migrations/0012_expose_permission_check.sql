-- =====================================================================================
--  HMK Platform — Migration 0012
--  Expose a permission check to the application layer
-- =====================================================================================
--  The app must render staff UI conditionally, but `role_permissions` / `permissions`
--  carry only an admin RLS policy — a TRAINING member cannot read the matrix that
--  grants them their own rights. Rather than open those tables, expose a boolean.
--
--  It answers exactly one question — "may the CALLER do X?" — and cannot enumerate
--  anyone else's rights: the subject comes from auth.uid() and there is no user param.
--
--  It is a CONVENIENCE for rendering, NOT an enforcement point. Every privileged
--  function re-checks permission itself (see run_seat_allocation) and RLS still governs
--  every table read. Hiding a button is courtesy; the database is the boundary.
-- =====================================================================================

set search_path = public, extensions, pg_catalog;

begin;

create or replace function public.has_permission(p_code text)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $fn$
  select app.has_perm(p_code) or app.is_admin();
$fn$;

revoke all on function public.has_permission(text) from public, anon;
grant execute on function public.has_permission(text) to authenticated;

commit;


-- ===== AUTHORITATIVE FUNCTION BODIES (exported from the live database) =====
-- Regenerate with: pg_get_functiondef(). These make this file replayable on a
-- fresh project; previously it carried only a rationale header.

CREATE OR REPLACE FUNCTION public.has_permission(p_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select app.has_perm(p_code) or app.is_admin();
$function$;

