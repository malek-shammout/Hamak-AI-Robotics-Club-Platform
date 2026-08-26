-- =====================================================================================
--  HMK Platform — Migration 0013
--  M4 Assessment Engine — PART 1 IS A SECURITY FIX. Read it before anything else.
-- =====================================================================================
--  THE FLAW (introduced in schema.sql; CONFIRMED EXPLOITABLE by live probe):
--    Policy `self_answer_test` on attempt_answers was `FOR ALL`. It scoped ROWS to the
--    student's own in-progress attempt but placed NO restriction on COLUMNS. A student
--    could therefore PATCH /rest/v1/attempt_answers and set `awarded_score` directly.
--
--    Probe result BEFORE the fix: a student set their own awarded_score to 999.00 and
--    it persisted. Because BR-02 gates admission on the resulting score, this was a
--    direct route to fraudulent admission.
--
--  THE FIX:
--    Students get SELECT only. Every write goes through save_attempt_answer(), which
--    writes ONLY answer columns and never touches a scoring column. Scoring columns are
--    written solely by submit_test_attempt() and by the grader path (staff_update,
--    gated on M4.UPDATE).
--
--    NEVER restore a student write policy on attempt_answers. Row scoping is not column
--    scoping — that is exactly the mistake this migration corrects.
--
--  VERIFIED after the fix (probe rolled back, 0 rows persisted):
--    * student UPDATE of awarded_score -> refused; value unchanged
--    * get_attempt_paper output contains no `is_correct` field
--    * user B saving an answer on user A's attempt -> refused (42501)
--    * saving after deadline_at -> ATTEMPT_EXPIRED
--    * auto-grading: Q1 right (60) + Q2 wrong (0) -> raw 60, normalized 60.000, GRADED
--    * attempt_limit enforced by the existing UQ_ATTEMPT_LIMIT trigger
--
--  Applied via MCP apply_migration as `m4_fix_self_grading_and_assessment_engine`,
--  plus `fix_submit_attempt_enum_cast` (CASE returned text where state is an enum —
--  caught by the probe before it ever ran in the app).
--
--  Functions defined:
--    app.assert_owns_attempt(uuid)                       -- ownership assertion helper
--    public.start_test_attempt(uuid)                     -- server-authoritative deadline
--    public.get_attempt_paper(uuid)                      -- paper WITHOUT is_correct
--    public.save_attempt_answer(uuid,uuid,uuid,jsonb)    -- answer columns ONLY
--    public.submit_test_attempt(uuid)                    -- auto-grade + normalize
-- =====================================================================================

set search_path = public, extensions, pg_catalog;

begin;

drop policy if exists "self_answer_test" on public.attempt_answers;

create policy "self_read_own_answers" on public.attempt_answers
  for select to authenticated
  using (exists (
    select 1 from public.test_attempts ta
      join public.applications a on a.id = ta.application_id
     where ta.id = attempt_answers.test_attempt_id
       and a.applicant_user_id = auth.uid()
  ));

comment on policy "self_read_own_answers" on public.attempt_answers is
  'SELECT ONLY. Students must never hold INSERT/UPDATE here: the scoring columns live in this table, and a row-scoped FOR ALL policy does not restrict columns. Writes go through save_attempt_answer().';

commit;


-- ===== AUTHORITATIVE FUNCTION BODIES (exported from the live database) =====
-- Regenerate with: pg_get_functiondef(). These make this file replayable on a
-- fresh project; previously it carried only a rationale header.

CREATE OR REPLACE FUNCTION app.assert_owns_attempt(p_attempt_id uuid)
 RETURNS test_attempts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_att test_attempts;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  select ta.* into v_att from public.test_attempts ta where ta.id = p_attempt_id;
  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.applications a
                  where a.id = v_att.application_id and a.applicant_user_id = auth.uid()) then
    raise exception 'NOT_YOUR_ATTEMPT' using errcode = '42501';
  end if;
  return v_att;
end $function$;

CREATE OR REPLACE FUNCTION public.start_test_attempt(p_application_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_app record; v_test record; v_used int; v_next int; v_id uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;

  select a.id, a.cohort_id, a.applicant_user_id, a.status
    into v_app from public.applications a where a.id = p_application_id for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND' using errcode='P0002'; end if;
  if v_app.applicant_user_id <> v_uid then
    raise exception 'NOT_YOUR_APPLICATION' using errcode='42501';
  end if;
  if v_app.status not in ('SUBMITTED','AWAITING_SCREENING','UNDER_EVALUATION') then
    raise exception 'NOT_ELIGIBLE_FOR_SCREENING' using errcode='P0001';
  end if;

  select st.* into v_test from public.screening_tests st
   where st.cohort_id = v_app.cohort_id and st.status = 'ACTIVE';
  if not found then raise exception 'NO_ACTIVE_TEST' using errcode='P0002'; end if;

  -- Resume an attempt that is still in progress rather than burning another allowance.
  select ta.id into v_id from public.test_attempts ta
   where ta.application_id = p_application_id and ta.state = 'IN_PROGRESS'
     and ta.deadline_at > now() limit 1;
  if v_id is not null then return v_id; end if;

  select count(*) into v_used from public.test_attempts ta
   where ta.application_id = p_application_id and ta.state <> 'VOIDED';
  if v_used >= v_test.attempt_limit then
    raise exception 'ATTEMPT_LIMIT_REACHED' using errcode='P0001';
  end if;
  v_next := v_used + 1;

  -- The deadline is computed HERE, from the server clock. A client-supplied deadline
  -- would be trivially extendable.
  insert into public.test_attempts (screening_test_id, application_id, attempt_no,
                                    started_at, deadline_at, state)
  values (v_test.id, p_application_id, v_next, now(),
          now() + make_interval(mins => v_test.duration_minutes), 'IN_PROGRESS')
  returning id into v_id;

  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.get_attempt_paper(p_attempt_id uuid)
 RETURNS TABLE(question_id uuid, order_index smallint, stem text, qtype question_type, weight numeric, options jsonb, saved_option_id uuid, saved_payload jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_att test_attempts; v_test record;
begin
  v_att := app.assert_owns_attempt(p_attempt_id);
  select st.* into v_test from public.screening_tests st where st.id = v_att.screening_test_id;

  -- Results visibility is a deliberate setting; a submitted paper is not re-served.
  if v_att.state <> 'IN_PROGRESS' then
    raise exception 'ATTEMPT_NOT_IN_PROGRESS' using errcode='P0001';
  end if;
  if now() > v_att.deadline_at then
    raise exception 'ATTEMPT_EXPIRED' using errcode='P0001';
  end if;

  return query
  select q.id,
         tq.order_index,
         q.stem,
         q.type,
         tq.weight,
         case when q.type in ('SINGLE_CHOICE','MULTI_CHOICE','TRUE_FALSE') then (
           select jsonb_agg(jsonb_build_object('id', o.id, 'text', o.option_text)
                            order by case when v_test.shuffle_options
                                          then md5(p_attempt_id::text || o.id::text)
                                          else lpad(o.order_index::text, 6, '0') end)
             from public.question_options o where o.question_id = q.id
         ) else null end as options,          -- is_correct is NEVER selected here
         aa.selected_option_id,
         aa.answer_payload
    from public.test_questions tq
    join public.questions q on q.id = tq.question_id
    left join public.attempt_answers aa
           on aa.test_attempt_id = p_attempt_id and aa.question_id = q.id
   where tq.screening_test_id = v_att.screening_test_id
   order by case when v_test.shuffle_questions
                 then md5(p_attempt_id::text || q.id::text)
                 else lpad(tq.order_index::text, 6, '0') end;
end $function$;

CREATE OR REPLACE FUNCTION public.save_attempt_answer(p_attempt_id uuid, p_question_id uuid, p_selected_option_id uuid DEFAULT NULL::uuid, p_answer_payload jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_att test_attempts;
begin
  v_att := app.assert_owns_attempt(p_attempt_id);

  if v_att.state <> 'IN_PROGRESS' then
    raise exception 'ATTEMPT_NOT_IN_PROGRESS' using errcode='P0001';
  end if;
  -- Server clock decides. A late save is refused outright.
  if now() > v_att.deadline_at then
    raise exception 'ATTEMPT_EXPIRED' using errcode='P0001';
  end if;
  if not exists (select 1 from public.test_questions tq
                  where tq.screening_test_id = v_att.screening_test_id
                    and tq.question_id = p_question_id) then
    raise exception 'QUESTION_NOT_IN_TEST' using errcode='P0001';
  end if;
  if p_selected_option_id is not null and not exists (
       select 1 from public.question_options o
        where o.id = p_selected_option_id and o.question_id = p_question_id) then
    raise exception 'OPTION_NOT_IN_QUESTION' using errcode='P0001';
  end if;

  -- ONLY answer columns. No scoring column appears in this statement, by design.
  insert into public.attempt_answers (test_attempt_id, question_id, selected_option_id, answer_payload)
  values (p_attempt_id, p_question_id, p_selected_option_id, p_answer_payload)
  on conflict (test_attempt_id, question_id) do update
    set selected_option_id = excluded.selected_option_id,
        answer_payload     = excluded.answer_payload;
end $function$;

CREATE OR REPLACE FUNCTION public.submit_test_attempt(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_att test_attempts; v_test record; r record;
  v_raw numeric := 0; v_manual int := 0; v_auto_submitted boolean := false; v_norm numeric;
  v_state test_attempt_state;
begin
  v_att := app.assert_owns_attempt(p_attempt_id);
  if v_att.state <> 'IN_PROGRESS' then
    raise exception 'ATTEMPT_NOT_IN_PROGRESS' using errcode='P0001';
  end if;

  select st.* into v_test from public.screening_tests st where st.id = v_att.screening_test_id;
  if now() > v_att.deadline_at then v_auto_submitted := true; end if;

  for r in
    select tq.question_id, tq.weight, q.type, q.auto_gradable,
           aa.id as answer_id, aa.selected_option_id, aa.answer_payload
      from public.test_questions tq
      join public.questions q on q.id = tq.question_id
      left join public.attempt_answers aa
             on aa.test_attempt_id = p_attempt_id and aa.question_id = tq.question_id
     where tq.screening_test_id = v_att.screening_test_id
  loop
    if not r.auto_gradable then
      v_manual := v_manual + 1;
      continue;
    end if;

    declare v_score numeric := 0; v_correct uuid[]; v_given uuid[];
    begin
      if r.type in ('SINGLE_CHOICE','TRUE_FALSE') then
        if r.selected_option_id is not null and exists (
             select 1 from public.question_options o
              where o.id = r.selected_option_id and o.is_correct) then
          v_score := r.weight;
        end if;

      elsif r.type = 'MULTI_CHOICE' then
        select coalesce(array_agg(o.id order by o.id), '{}')
          into v_correct from public.question_options o
         where o.question_id = r.question_id and o.is_correct;
        select coalesce(array_agg(s.x order by s.x), '{}') into v_given
          from jsonb_array_elements_text(coalesce(r.answer_payload->'selected','[]'::jsonb)) as t(x1),
               lateral (select t.x1::uuid as x) s;
        -- All-or-nothing: partial credit needs a policy decision, not a default.
        if v_correct = v_given and array_length(v_correct,1) is not null then
          v_score := r.weight;
        end if;
      end if;

      v_raw := v_raw + v_score;

      if r.answer_id is null then
        insert into public.attempt_answers (test_attempt_id, question_id, auto_score, awarded_score)
        values (p_attempt_id, r.question_id, v_score, v_score);
      else
        update public.attempt_answers
           set auto_score = v_score, awarded_score = v_score
         where id = r.answer_id;
      end if;
    end;
  end loop;

  v_norm  := case when v_test.max_score > 0 then round(v_raw / v_test.max_score * 100, 3) else 0 end;
  v_state := case when v_manual = 0 then 'GRADED'::test_attempt_state
                  else 'GRADING'::test_attempt_state end;

  update public.test_attempts
     set submitted_at = now(),
         auto_submitted = v_auto_submitted,
         raw_score = v_raw,
         -- normalized_score is authoritative only once nothing is left to grade
         normalized_score = case when v_manual = 0 then v_norm else null end,
         state = v_state
   where id = p_attempt_id;

  return jsonb_build_object(
    'attempt_id', p_attempt_id, 'raw_score', v_raw, 'max_score', v_test.max_score,
    'normalized_score', case when v_manual = 0 then v_norm else null end,
    'awaiting_manual_grading', v_manual, 'auto_submitted', v_auto_submitted,
    'state', v_state
  );
end $function$;

