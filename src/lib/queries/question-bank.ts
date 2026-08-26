import 'server-only';

import {createClient} from '@/lib/supabase/server';

/**
 * A2 question bank. All reads are bounded by the `staff_read` policies (M4.READ),
 * so a student hitting these routes gets nothing rather than a leak.
 */

export async function listQuestions() {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('questions')
    .select('id, stem, type, difficulty, max_score, auto_gradable, version, is_current, created_at, question_options(id, option_text, is_correct, order_index)')
    .eq('is_current', true)
    .order('created_at', {ascending: false});
  if (error) throw error;
  return data ?? [];
}

/** Which questions are frozen because a live test uses them (migration 0015). */
export async function getLiveQuestionIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const {data} = await supabase
    .from('test_questions')
    .select('question_id, screening_tests!inner(status)')
    .in('screening_tests.status', ['ACTIVE', 'LOCKED']);
  return new Set((data ?? []).map((r) => r.question_id));
}

export async function listTopics() {
  const supabase = await createClient();
  const {data} = await supabase.from('topics').select('id, code, name_ar, name_en').order('code');
  return data ?? [];
}

/** Attempts parked awaiting a human grader. */
export async function listAttemptsNeedingGrading() {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('test_attempts')
    .select('id, attempt_no, submitted_at, state, raw_score, applications!inner(id, users!applicant_user_id(full_name_ar, full_name_en), cohorts(code)), screening_tests(title, max_score)')
    .eq('state', 'GRADING')
    .order('submitted_at', {ascending: true});
  if (error) throw error;
  return data ?? [];
}

export async function getAttemptForGrading(attemptId: string) {
  const supabase = await createClient();

  const {data: attempt} = await supabase
    .from('test_attempts')
    .select('id, state, submitted_at, raw_score, normalized_score, screening_test_id, applications(users!applicant_user_id(full_name_ar, full_name_en), cohorts(code)), screening_tests(title, max_score, pass_threshold)')
    .eq('id', attemptId)
    .maybeSingle();
  if (!attempt) return null;

  const [{data: answers}, {data: weights}] = await Promise.all([
    supabase
      .from('attempt_answers')
      .select('id, question_id, answer_payload, selected_option_id, auto_score, awarded_score, grader_comment, is_override, original_score, questions(stem, type, auto_gradable, grading_rubric)')
      .eq('test_attempt_id', attemptId),
    supabase
      .from('test_questions')
      .select('question_id, weight, order_index')
      .eq('screening_test_id', attempt.screening_test_id),
  ]);

  const weightBy = new Map((weights ?? []).map((w) => [w.question_id, w]));
  const merged = (answers ?? [])
    .map((a) => ({...a, weight: weightBy.get(a.question_id)?.weight ?? 0,
                        order_index: weightBy.get(a.question_id)?.order_index ?? 0}))
    .sort((a, b) => a.order_index - b.order_index);

  return {attempt, answers: merged};
}
