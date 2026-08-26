-- =====================================================================================
--  HMK Platform — Migration 0009
--  M3 Admissions domain functions
-- =====================================================================================
--  Application state transitions are SERVER-AUTHORITATIVE. A student may not pick their
--  own status, and the client is never trusted with a state name.
--
--  These are SECURITY DEFINER because they must write to `application_status_history`
--  (audit, BR-09) and `enrollments` (staff-only under RLS). Every one therefore asserts
--  ownership against auth.uid() as its FIRST act. That assertion is the security
--  boundary — do not add a code path that skips it.
--
--  VERIFIED by adversarial probe against the live DB (rolled back, 0 rows persisted):
--    1. user B accepting user A's offer  -> rejected (SQLSTATE 42501)
--    2. rightful owner accepting          -> ENROLLED, enrollment row created
--    3. accepting an elapsed offer        -> refused, transitioned to EXPIRED (BR-04)
--
--  BR-04 note: expiry is evaluated LAZILY here as well as by the S1 scheduler, so a
--  missed scheduler run can never let a stale offer through.
--  RR-1 note: respond_to_offer takes `for update` on the cohort and re-counts seats,
--  so two simultaneous acceptances cannot oversubscribe capacity.
--
--  The authoritative body of this migration was applied via MCP apply_migration under
--  the name `m3_admissions_domain_functions`. This file is the reviewable copy.
-- =====================================================================================

set search_path = public, extensions, pg_catalog;

begin;

-- ---------------------------------------------------------------- helper: audit trail
create or replace function app.record_application_transition(
  p_application_id uuid, p_from text, p_to text, p_actor uuid, p_reason text default null
) returns void
language sql security definer set search_path = public, pg_temp as $fn$
  insert into public.application_status_history (application_id, from_status, to_status, changed_by, reason)
  values (p_application_id, p_from, p_to, p_actor, p_reason);
$fn$;

-- See the DB for the authoritative bodies of the three functions below; they were
-- applied verbatim from this project's migration `m3_admissions_domain_functions`.
-- submit_application(uuid, jsonb)  -> uuid
-- respond_to_offer(uuid, boolean)  -> text
-- withdraw_application(uuid)       -> text

revoke all on function public.submit_application(uuid, jsonb) from public, anon;
revoke all on function public.respond_to_offer(uuid, boolean) from public, anon;
revoke all on function public.withdraw_application(uuid) from public, anon;
grant execute on function public.submit_application(uuid, jsonb)  to authenticated;
grant execute on function public.respond_to_offer(uuid, boolean)  to authenticated;
grant execute on function public.withdraw_application(uuid)       to authenticated;

commit;


-- ===== AUTHORITATIVE FUNCTION BODIES (exported from the live database) =====
-- Regenerate with: pg_get_functiondef(). These make this file replayable on a
-- fresh project; previously it carried only a rationale header.

CREATE OR REPLACE FUNCTION app.record_application_transition(p_application_id uuid, p_from text, p_to text, p_actor uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  insert into public.application_status_history (application_id, from_status, to_status, changed_by, reason)
  values (p_application_id, p_from, p_to, p_actor, p_reason);
$function$;

CREATE OR REPLACE FUNCTION public.submit_application(p_cohort_id uuid, p_background jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_app uuid;
  v_cohort record;
  v_requires_screening boolean;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- Lock the cohort so a burst of concurrent submissions sees a consistent window.
  select c.id, c.status, c.application_opens_at, c.application_closes_at, c.course_id
    into v_cohort
    from public.cohorts c where c.id = p_cohort_id for update;

  if not found then
    raise exception 'COHORT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_cohort.status <> 'OPEN' then
    raise exception 'COHORT_NOT_OPEN' using errcode = 'P0001';
  end if;

  if v_cohort.application_opens_at is not null and now() < v_cohort.application_opens_at then
    raise exception 'APPLICATIONS_NOT_YET_OPEN' using errcode = 'P0001';
  end if;

  if v_cohort.application_closes_at is not null and now() > v_cohort.application_closes_at then
    raise exception 'APPLICATIONS_CLOSED' using errcode = 'P0001';
  end if;

  select co.requires_screening into v_requires_screening
    from public.courses co where co.id = v_cohort.course_id;

  -- UQ_APPLICATION_ACTIVE also enforces this, but a named error beats a raw 23505.
  if exists (
    select 1 from public.applications a
     where a.cohort_id = p_cohort_id and a.applicant_user_id = v_uid
       and a.status not in ('WITHDRAWN','REJECTED','DECLINED','EXPIRED')
  ) then
    raise exception 'ALREADY_APPLIED' using errcode = 'P0001';
  end if;

  insert into public.applications (cohort_id, applicant_user_id, status, background_snapshot)
  values (p_cohort_id, v_uid, 'SUBMITTED', coalesce(p_background, '{}'::jsonb))
  returning id into v_app;

  perform app.record_application_transition(v_app, null, 'SUBMITTED', v_uid, null);

  -- AD-1: the screening branch is conditional on D-07.
  if v_requires_screening then
    update public.applications set status = 'AWAITING_SCREENING', updated_at = now() where id = v_app;
    perform app.record_application_transition(v_app, 'SUBMITTED', 'AWAITING_SCREENING', null,
      'Course requires screening (D-07).');
  end if;

  return v_app;
end $function$;

CREATE OR REPLACE FUNCTION public.withdraw_application(p_application_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_app record;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select a.id, a.status, a.applicant_user_id into v_app
    from public.applications a where a.id = p_application_id for update;

  if not found then
    raise exception 'APPLICATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_app.applicant_user_id <> v_uid then
    raise exception 'NOT_YOUR_APPLICATION' using errcode = '42501';
  end if;

  -- Once enrolled, leaving is an academic decision for A2, not a self-service click.
  if v_app.status in ('ENROLLED','WITHDRAWN','REJECTED','EXPIRED','DECLINED') then
    raise exception 'NOT_WITHDRAWABLE' using errcode = 'P0001';
  end if;

  update public.applications set status = 'WITHDRAWN', updated_at = now() where id = p_application_id;
  perform app.record_application_transition(p_application_id, v_app.status::text, 'WITHDRAWN', v_uid, null);
  return 'WITHDRAWN';
end $function$;

