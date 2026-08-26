-- =====================================================================================
--  HMK Platform — Migration 0014
--  Dynamic readiness scoring (US-TRN-06)
-- =====================================================================================
--  §C.13 calls applications.readiness_score an AUTHORED DECISION SNAPSHOT, not a derived
--  value: it must survive later edits to the model or the grading. So this function
--  WRITES the snapshot plus its full per-factor breakdown into application_score_factors,
--  and BR-03 then ranks on the stored number. Re-running recomputes it deliberately.
--
--  Factor value sources:
--    TEST     - best GRADED normalized_score for the application (0..100)
--    DECLARED - a number pulled from applications.background_snapshot by factor_code,
--               clamped to 0..100; a non-numeric value contributes 0 rather than
--               silently poisoning the total
--    MANUAL   - whatever a human already recorded; NEVER overwritten here
--
--  CK_FACTOR_WEIGHTS_100 guarantees the active model's weights total 100, so the
--  weighted sum is directly a 0..100 score.
--
--  Authorisation: SECURITY DEFINER, so it asserts M4.APPROVE / M3.APPROVE / ADMIN
--  itself (BR-09). VERIFIED: a student calling it is refused (42501); as ADMIN with
--  TEST=60 @70% and DECLARED motivation=80 @30%, the result is exactly 66.000 and the
--  two-row breakdown is persisted.
--
--  Applied via MCP apply_migration as `m4_dynamic_readiness_scoring`.
--  Functions: public.compute_readiness_score(uuid) -> numeric
--             public.compute_readiness_for_cohort(uuid) -> jsonb
-- =====================================================================================


-- ===== AUTHORITATIVE FUNCTION BODIES (exported from the live database) =====
-- Regenerate with: pg_get_functiondef(). These make this file replayable on a
-- fresh project; previously it carried only a rationale header.

CREATE OR REPLACE FUNCTION public.compute_readiness_score(p_application_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_app record; v_model uuid; f record;
  v_raw numeric; v_weighted numeric; v_total numeric := 0; v_best numeric;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  -- SECURITY DEFINER: authorisation is asserted here, not by RLS (BR-09).
  if not (app.has_perm('M4.APPROVE') or app.has_perm('M3.APPROVE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select a.id, a.cohort_id, a.background_snapshot into v_app
    from public.applications a where a.id = p_application_id for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND' using errcode='P0002'; end if;

  select rm.id into v_model from public.readiness_models rm
   where rm.cohort_id = v_app.cohort_id and rm.is_active;
  if v_model is null then raise exception 'NO_ACTIVE_READINESS_MODEL' using errcode='P0002'; end if;

  select max(ta.normalized_score) into v_best
    from public.test_attempts ta
   where ta.application_id = p_application_id and ta.state = 'GRADED';

  for f in select rf.id, rf.factor_code, rf.weight_pct, rf.value_source
             from public.readiness_factors rf where rf.readiness_model_id = v_model
  loop
    v_raw := null;

    if f.value_source = 'TEST' then
      v_raw := coalesce(v_best, 0);

    elsif f.value_source = 'DECLARED' then
      -- Only a genuine number counts; anything else contributes 0 rather than
      -- silently poisoning the total.
      begin
        v_raw := (v_app.background_snapshot ->> lower(f.factor_code))::numeric;
      exception when others then
        v_raw := null;
      end;
      v_raw := coalesce(v_raw, 0);
      if v_raw < 0 then v_raw := 0; elsif v_raw > 100 then v_raw := 100; end if;

    elsif f.value_source = 'MANUAL' then
      select asf.raw_value into v_raw from public.application_score_factors asf
       where asf.application_id = p_application_id and asf.readiness_factor_id = f.id;
      v_raw := coalesce(v_raw, 0);
    end if;

    v_weighted := round(v_raw * f.weight_pct / 100.0, 3);
    v_total := v_total + v_weighted;

    insert into public.application_score_factors
      (application_id, readiness_factor_id, raw_value, weighted_value, computed_at)
    values (p_application_id, f.id, v_raw, v_weighted, now())
    on conflict (application_id, readiness_factor_id) do update
      set raw_value = excluded.raw_value,
          weighted_value = excluded.weighted_value,
          computed_at = excluded.computed_at;
  end loop;

  v_total := round(v_total, 3);

  update public.applications
     set readiness_score = v_total, updated_at = now()
   where id = p_application_id;

  return v_total;
end $function$;

CREATE OR REPLACE FUNCTION public.compute_readiness_for_cohort(p_cohort_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r record; v_n int := 0;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not (app.has_perm('M4.APPROVE') or app.has_perm('M3.APPROVE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  for r in select a.id from public.applications a
            where a.cohort_id = p_cohort_id
              and a.status in ('SUBMITTED','AWAITING_SCREENING','UNDER_EVALUATION','WAITLISTED')
  loop
    perform public.compute_readiness_score(r.id);
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('cohort_id', p_cohort_id, 'scored', v_n);
end $function$;

