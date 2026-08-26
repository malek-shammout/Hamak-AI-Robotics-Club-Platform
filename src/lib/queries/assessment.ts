import 'server-only';

import {createClient} from '@/lib/supabase/server';

export type PaperQuestion = {
  question_id: string;
  order_index: number;
  stem: string;
  qtype: string;
  weight: number;
  options: {id: string; text: string}[] | null;
  saved_option_id: string | null;
  saved_payload: unknown;
};

/**
 * The question paper for an in-progress attempt.
 *
 * This RPC is the ONLY route by which a student sees a question - `questions` and
 * `question_options` have no student read policy, deliberately. The projection omits
 * `is_correct` entirely, so the answer key cannot leak even through a serialisation bug.
 */
export async function getAttemptPaper(attemptId: string) {
  const supabase = await createClient();
  const {data, error} = await supabase.rpc('get_attempt_paper', {p_attempt_id: attemptId});
  if (error) return {questions: null as PaperQuestion[] | null, error: error.message};
  return {questions: (data ?? []) as PaperQuestion[], error: null};
}

export async function getMyAttempt(attemptId: string) {
  const supabase = await createClient();
  // Bounded by the `self_read_test_attempts` RLS policy.
  const {data} = await supabase
    .from('test_attempts')
    .select('id, state, started_at, deadline_at, submitted_at, normalized_score, raw_score, screening_tests(title, max_score, pass_threshold, result_visibility)')
    .eq('id', attemptId)
    .maybeSingle();
  return data;
}

/** Latest attempt per application, for the "my applications" screen. */
export async function getMyAttemptsByApplication() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('test_attempts')
    .select('id, application_id, state, deadline_at, normalized_score')
    .order('attempt_no', {ascending: false});
  const map = new Map<string, NonNullable<typeof data>[number]>();
  for (const a of data ?? []) if (!map.has(a.application_id)) map.set(a.application_id, a);
  return map;
}

export async function getReadinessBreakdown(applicationId: string) {
  const supabase = await createClient();
  const {data} = await supabase
    .from('application_score_factors')
    .select('raw_value, weighted_value, computed_at, readiness_factors(factor_code, weight_pct, value_source)')
    .eq('application_id', applicationId);
  return data ?? [];
}

export async function getActiveReadinessModel(cohortId: string) {
  const supabase = await createClient();
  const {data} = await supabase
    .from('readiness_models')
    .select('id, name, is_active, readiness_factors(id, factor_code, weight_pct, value_source)')
    .eq('cohort_id', cohortId)
    .eq('is_active', true)
    .maybeSingle();
  return data;
}
