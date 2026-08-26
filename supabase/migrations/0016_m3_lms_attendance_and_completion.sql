-- =====================================================================================
--  HMK Platform — Migration 0016
--  LMS delivery: attendance + BR-05 completion
-- =====================================================================================
--  BR-05 HAS TWO HALVES OF DIFFERENT NATURE. Both frozen documents agree:
--    Step 1 §3  : "attendance >= course minimum AND all required evaluations are
--                  MARKED PASSED BY A2"
--    Step 2 §B.1: enforcement layer = "Domain service" (NOT a table)
--
--  The 78-entity model has NO course-evaluation entity, and that is deliberate: M4's
--  assessment tables bind to `applications` (admission screening), not `enrollments`.
--  Therefore:
--    * ATTENDANCE  -> computed and enforced by the database.
--    * EVALUATIONS -> an A2 ATTESTATION. mark_enrollment_completed takes an explicit
--                     boolean the caller must affirm; it is never assumed true.
--
--  Do NOT add an evaluations table to "finish" this without a recorded decision in
--  claude.md §3 — that would be inventing schema (Rules of Engagement #1).
--
--  VERIFIED by adversarial probe (rolled back, 0 rows persisted):
--    * student recording their own attendance   -> refused (42501)
--    * attendance against another cohort's session -> SESSION_COHORT_MISMATCH
--    * changing a mark with no reason           -> AMENDMENT_REASON_REQUIRED (BR-09)
--    * justified amendment                      -> amendment_reason persisted
--    * CANCELLED session excluded from the denominator; PRESENT/LATE/EXCUSED all count
--    * 33.33% attendance correctly fails a 75% minimum
--    * completion with short attendance         -> BR05_NOT_SATISFIED
--    * completion without attesting evaluations -> BR05_NOT_SATISFIED
--    * both halves satisfied                    -> COMPLETED
--    * A7 override                              -> COMPLETED_BY_OVERRIDE + audit row
--    * completion opens clearance in EVALUATING for the M6 pipeline (grants nothing)
--
--  Applied via MCP as `m3_lms_attendance_and_completion`.
--  Functions: public.record_attendance(uuid,uuid,attendance_state,text,text)
--             public.evaluate_completion_readiness(uuid) -> jsonb
--             public.mark_enrollment_completed(uuid, boolean, text) -> jsonb
-- =====================================================================================

set search_path = public, extensions, pg_catalog;

begin;

-- ===== AUTHORITATIVE FUNCTION BODIES (exported from the live database) =====

CREATE OR REPLACE FUNCTION public.evaluate_completion_readiness(p_enrollment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_enr record; v_min smallint; v_held int; v_attended int; v_pct numeric;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not (app.has_perm('M3.READ') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select e.id, e.cohort_id, e.status into v_enr
    from public.enrollments e where e.id = p_enrollment_id;
  if not found then raise exception 'ENROLLMENT_NOT_FOUND' using errcode='P0002'; end if;

  select c.min_attendance_pct into v_min from public.cohorts c where c.id = v_enr.cohort_id;

  -- Only HELD sessions count. Cancelled sessions must not penalise a student, and
  -- planned ones have not happened yet.
  select count(*) into v_held
    from public.cohort_sessions cs
   where cs.cohort_id = v_enr.cohort_id and cs.status = 'HELD';

  select count(*) into v_attended
    from public.attendance_records ar
    join public.cohort_sessions cs on cs.id = ar.cohort_session_id
   where ar.enrollment_id = p_enrollment_id
     and cs.status = 'HELD'
     and ar.state in ('PRESENT','LATE','EXCUSED');

  v_pct := case when v_held = 0 then 0 else round(100.0 * v_attended / v_held, 2) end;

  return jsonb_build_object(
    'enrollment_id', p_enrollment_id,
    'status', v_enr.status,
    'sessions_held', v_held,
    'sessions_attended', v_attended,
    'attendance_pct', v_pct,
    'required_pct', v_min,
    'meets_attendance', (v_held > 0 and v_pct >= v_min),
    -- Deliberately absent: any claim about evaluations. The model has no entity for
    -- them; A2 attests to that half explicitly at completion time.
    'attendance_is_only_computable_half', true
  );
end $function$;

CREATE OR REPLACE FUNCTION public.mark_enrollment_completed(p_enrollment_id uuid, p_evaluations_passed boolean, p_override_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_enr record; v_readiness jsonb; v_meets boolean;
  v_override boolean := false; v_new enrollment_status;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not (app.has_perm('M3.APPROVE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select e.* into v_enr from public.enrollments e where e.id = p_enrollment_id for update;
  if not found then raise exception 'ENROLLMENT_NOT_FOUND' using errcode='P0002'; end if;
  if v_enr.status <> 'ACTIVE' then
    raise exception 'ENROLLMENT_NOT_ACTIVE' using errcode='P0001';
  end if;

  v_readiness := public.evaluate_completion_readiness(p_enrollment_id);
  v_meets := (v_readiness->>'meets_attendance')::boolean;

  -- BR-05 requires BOTH halves. p_evaluations_passed is an attestation by A2, never
  -- inferred: passing false here fails the rule exactly as short attendance does.
  if not (v_meets and coalesce(p_evaluations_passed, false)) then
    if p_override_reason is null or btrim(p_override_reason) = '' then
      raise exception 'BR05_NOT_SATISFIED' using errcode='P0001',
        detail = v_readiness::text;
    end if;
    -- A7-overridable per BR-05, and only with a reason. Overriding is a recorded act.
    if not app.is_admin() then
      raise exception 'OVERRIDE_REQUIRES_ADMIN' using errcode='42501';
    end if;
    v_override := true;
  end if;

  v_new := case when v_override then 'COMPLETED_BY_OVERRIDE'::enrollment_status
                else 'COMPLETED'::enrollment_status end;

  update public.enrollments
     set status = v_new,
         completed_at = now(),
         completion_marked_by = v_uid,
         completion_overridden = v_override,
         completion_override_reason = case when v_override then p_override_reason else null end,
         updated_at = now()
   where id = p_enrollment_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id,
                                 before_state, after_state, is_override, justification)
  values (v_uid, 'MARK_ENROLLMENT_COMPLETED', 'enrollments', p_enrollment_id,
          jsonb_build_object('status', v_enr.status),
          jsonb_build_object('status', v_new, 'readiness', v_readiness,
                             'evaluations_passed_attested', coalesce(p_evaluations_passed,false)),
          v_override,
          case when v_override then p_override_reason else null end);

  -- State machine (§B.13): clearance is "triggered by completion or return". Opening the
  -- record in EVALUATING starts the M6 pipeline; it grants nothing on its own, and
  -- BR-01 still requires an APPROVED clearance before any certificate can exist.
  insert into public.clearance_records (enrollment_id, status)
  values (p_enrollment_id, 'EVALUATING')
  on conflict (enrollment_id) do nothing;

  return jsonb_build_object('enrollment_id', p_enrollment_id, 'status', v_new,
                            'overridden', v_override, 'readiness', v_readiness);
end $function$;

CREATE OR REPLACE FUNCTION public.record_attendance(p_enrollment_id uuid, p_cohort_session_id uuid, p_state attendance_state, p_note text DEFAULT NULL::text, p_amendment_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_existing record;
  v_enr_cohort uuid;
  v_sess_cohort uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not (app.has_perm('M3.UPDATE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select e.cohort_id into v_enr_cohort from public.enrollments e where e.id = p_enrollment_id;
  if v_enr_cohort is null then raise exception 'ENROLLMENT_NOT_FOUND' using errcode='P0002'; end if;

  select cs.cohort_id into v_sess_cohort
    from public.cohort_sessions cs where cs.id = p_cohort_session_id;
  if v_sess_cohort is null then raise exception 'SESSION_NOT_FOUND' using errcode='P0002'; end if;

  -- A roster is per cohort. Marking a student present at another cohort's session is a
  -- data-integrity error, not a typo to tolerate.
  if v_enr_cohort <> v_sess_cohort then
    raise exception 'SESSION_COHORT_MISMATCH' using errcode='P0001';
  end if;

  select * into v_existing from public.attendance_records ar
   where ar.enrollment_id = p_enrollment_id and ar.cohort_session_id = p_cohort_session_id
   for update;

  if not found then
    insert into public.attendance_records (enrollment_id, cohort_session_id, state, recorded_by, note)
    values (p_enrollment_id, p_cohort_session_id, p_state, v_uid, p_note);
    return;
  end if;

  -- Changing a recorded mark is an amendment and must be justified (CK_ATTENDANCE_
  -- AMENDMENT + BR-09). Re-saving the same state is not an amendment.
  if v_existing.state = p_state then
    update public.attendance_records set note = p_note where id = v_existing.id;
    return;
  end if;

  if p_amendment_reason is null or btrim(p_amendment_reason) = '' then
    raise exception 'AMENDMENT_REASON_REQUIRED' using errcode='P0001';
  end if;

  update public.attendance_records
     set state = p_state, note = p_note, recorded_by = v_uid,
         amended_at = now(), amendment_reason = p_amendment_reason
   where id = v_existing.id;
end $function$;

revoke all on function public.record_attendance(uuid, uuid, attendance_state, text, text) from public, anon;
revoke all on function public.evaluate_completion_readiness(uuid) from public, anon;
revoke all on function public.mark_enrollment_completed(uuid, boolean, text) from public, anon;
grant execute on function public.record_attendance(uuid, uuid, attendance_state, text, text) to authenticated;
grant execute on function public.evaluate_completion_readiness(uuid)  to authenticated;
grant execute on function public.mark_enrollment_completed(uuid, boolean, text) to authenticated;

commit;
