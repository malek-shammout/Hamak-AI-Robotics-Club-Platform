-- =====================================================================================
--  HMK Platform — Migration 0015
--  Manual grading + question-bank edit integrity
-- =====================================================================================
--  TWO CONCERNS:
--
--  1. MANUAL GRADING. submit_test_attempt parks non-auto-gradable answers in GRADING
--     with normalized_score NULL. A human scores them and finalises. Graders write
--     through these functions, never by hand, so every score carries a grader and a
--     timestamp — and an amended score preserves the original (BR-09).
--
--  2. EDIT INTEGRITY. Nothing previously stopped A2 editing a question — or flipping
--     which option is correct — while a test using it was ACTIVE. That silently changes
--     a live exam and retroactively invalidates graded attempts. Questions used by a
--     non-DRAFT test are now frozen; changing one means creating a NEW VERSION, which
--     is what the version chain on `questions` was designed for.
--
--  VERIFIED by adversarial probe (rolled back, 0 rows persisted):
--    * subjective answer parked in GRADING, normalized_score withheld
--    * student grading their own answer            -> refused (42501)
--    * score above the question's weight           -> SCORE_OUT_OF_RANGE
--    * finalise with ungraded answers              -> UNGRADED_ANSWERS_REMAIN
--    * amending a grade with no reason             -> OVERRIDE_REASON_REQUIRED (BR-09)
--    * justified amendment                         -> original_score preserved at 45
--    * finalise                                    -> 90.000 (auto 40 + manual 50)
--    * editing a question used by an ACTIVE test   -> QUESTION_IS_LIVE
--    * flipping the answer key on a live test      -> QUESTION_IS_LIVE
--    * clone_question_as_new_version               -> v2 with cloned options; v1 no longer current
--
--  TWO BUGS THE PROBE CAUGHT BEFORE THEY SHIPPED:
--    a) grade_attempt_answer set is_override without override_reason, violating
--       CK_ANSWER_OVERRIDE_JUSTIFIED. The constraint was right; the function now
--       REQUIRES a justification when overwriting a recorded score.
--    b) assert_question_not_live resolved the target id with a CASE expression
--       referencing both NEW.id and NEW.question_id. PL/pgSQL plans the WHOLE
--       expression, so the untaken branch still had to resolve and every UPDATE on
--       `questions` failed. Rewritten with IF branches.
--
--  Applied via MCP as `m4_manual_grading_and_question_versioning`, then
--  `fix_grade_answer_override_reason` and `fix_question_live_trigger_record_access`.
-- =====================================================================================

set search_path = public, extensions, pg_catalog;

begin;

-- ===== AUTHORITATIVE FUNCTION BODIES (exported from the live database) =====

CREATE OR REPLACE FUNCTION app.assert_question_not_live()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_qid uuid; v_live int;
begin
  if tg_table_name = 'questions' then
    if tg_op = 'DELETE' then v_qid := old.id; else v_qid := new.id; end if;
  else
    if tg_op = 'DELETE' then v_qid := old.question_id; else v_qid := new.question_id; end if;
  end if;

  select count(*) into v_live
    from public.test_questions tq
    join public.screening_tests st on st.id = tq.screening_test_id
   where tq.question_id = v_qid and st.status in ('ACTIVE','LOCKED');

  if v_live > 0 then
    raise exception
      'QUESTION_IS_LIVE: this question is used by an ACTIVE or LOCKED test. Editing it would change a live exam and invalidate graded attempts. Create a new version with clone_question_as_new_version() instead.'
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end $function$;

CREATE OR REPLACE FUNCTION public.clone_question_as_new_version(p_question_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid(); v_src record; v_root uuid; v_ver smallint; v_new uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not (app.has_perm('M4.CREATE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select * into v_src from public.questions where id = p_question_id;
  if not found then raise exception 'QUESTION_NOT_FOUND' using errcode='P0002'; end if;

  v_root := coalesce(v_src.root_question_id, v_src.id);
  select coalesce(max(version), 0) + 1 into v_ver
    from public.questions where coalesce(root_question_id, id) = v_root;

  insert into public.questions (root_question_id, version, is_current, type, stem, difficulty,
                                max_score, auto_gradable, grading_rubric, created_by)
  values (v_root, v_ver, true, v_src.type, v_src.stem, v_src.difficulty,
          v_src.max_score, v_src.auto_gradable, v_src.grading_rubric, v_uid)
  returning id into v_new;

  insert into public.question_options (question_id, order_index, option_text, is_correct)
  select v_new, o.order_index, o.option_text, o.is_correct
    from public.question_options o where o.question_id = p_question_id;

  -- Only one version of a question is current at a time.
  update public.questions set is_current = false
   where coalesce(root_question_id, id) = v_root and id <> v_new;

  return v_new;
end $function$;

CREATE OR REPLACE FUNCTION public.finalize_attempt_grading(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_att record; v_test record; v_ungraded int; v_raw numeric; v_norm numeric;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not (app.has_perm('M4.APPROVE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select ta.* into v_att from public.test_attempts ta where ta.id = p_attempt_id for update;
  if not found then raise exception 'ATTEMPT_NOT_FOUND' using errcode='P0002'; end if;
  if v_att.state <> 'GRADING' then raise exception 'ATTEMPT_NOT_GRADING' using errcode='P0001'; end if;

  select st.* into v_test from public.screening_tests st where st.id = v_att.screening_test_id;

  -- Every question on the paper must have a score, including ones never answered.
  select count(*) into v_ungraded
    from public.test_questions tq
    left join public.attempt_answers aa
           on aa.test_attempt_id = p_attempt_id and aa.question_id = tq.question_id
   where tq.screening_test_id = v_att.screening_test_id
     and (aa.id is null or aa.awarded_score is null);

  if v_ungraded > 0 then
    raise exception 'UNGRADED_ANSWERS_REMAIN' using errcode='P0001';
  end if;

  select coalesce(sum(aa.awarded_score), 0) into v_raw
    from public.attempt_answers aa where aa.test_attempt_id = p_attempt_id;

  v_norm := case when v_test.max_score > 0 then round(v_raw / v_test.max_score * 100, 3) else 0 end;

  update public.test_attempts
     set raw_score = v_raw, normalized_score = v_norm, state = 'GRADED'::test_attempt_state
   where id = p_attempt_id;

  -- NOTE: readiness is NOT recomputed here. It is an authored snapshot (§C.13) and A2
  -- recomputes the cohort deliberately before allocation.
  return jsonb_build_object('attempt_id', p_attempt_id, 'raw_score', v_raw,
                            'normalized_score', v_norm, 'state', 'GRADED');
end $function$;

CREATE OR REPLACE FUNCTION public.grade_attempt_answer(p_answer_id uuid, p_awarded_score numeric, p_comment text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_ans record; v_weight numeric; v_prev numeric; v_amending boolean;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
  if not (app.has_perm('M4.UPDATE') or app.has_perm('M4.APPROVE') or app.is_admin()) then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select aa.id, aa.test_attempt_id, aa.question_id, aa.awarded_score,
         aa.is_override, aa.original_score
    into v_ans from public.attempt_answers aa where aa.id = p_answer_id for update;
  if not found then raise exception 'ANSWER_NOT_FOUND' using errcode='P0002'; end if;

  select tq.weight into v_weight
    from public.test_questions tq
    join public.test_attempts ta on ta.screening_test_id = tq.screening_test_id
   where ta.id = v_ans.test_attempt_id and tq.question_id = v_ans.question_id;

  if p_awarded_score is null or p_awarded_score < 0 or p_awarded_score > coalesce(v_weight, 0) then
    raise exception 'SCORE_OUT_OF_RANGE' using errcode='P0001';
  end if;

  v_prev     := v_ans.awarded_score;
  v_amending := v_prev is not null;

  -- An amendment must be justified. This mirrors CK_ANSWER_OVERRIDE_JUSTIFIED rather
  -- than working around it: a silently changed grade is exactly what BR-09 forbids.
  if v_amending and (p_comment is null or btrim(p_comment) = '') then
    raise exception 'OVERRIDE_REASON_REQUIRED' using errcode='P0001';
  end if;

  update public.attempt_answers
     set awarded_score   = p_awarded_score,
         grader_comment  = p_comment,
         graded_by       = v_uid,
         graded_at       = now(),
         is_override     = case when v_amending then true else is_override end,
         -- original_score is written once and never overwritten by a later amendment.
         original_score  = case when v_amending and v_ans.original_score is null
                                then v_prev else v_ans.original_score end,
         override_reason = case when v_amending then p_comment else override_reason end
   where id = p_answer_id;
end $function$;

drop trigger if exists trg_questions_not_live on public.questions;
create trigger trg_questions_not_live
  before update of stem, type, max_score, auto_gradable, grading_rubric on public.questions
  for each row execute function app.assert_question_not_live();

drop trigger if exists trg_question_options_not_live on public.question_options;
create trigger trg_question_options_not_live
  before insert or update or delete on public.question_options
  for each row execute function app.assert_question_not_live();

revoke all on function public.grade_attempt_answer(uuid, numeric, text) from public, anon;
revoke all on function public.finalize_attempt_grading(uuid) from public, anon;
revoke all on function public.clone_question_as_new_version(uuid) from public, anon;
grant execute on function public.grade_attempt_answer(uuid, numeric, text) to authenticated;
grant execute on function public.finalize_attempt_grading(uuid)            to authenticated;
grant execute on function public.clone_question_as_new_version(uuid)       to authenticated;

commit;
