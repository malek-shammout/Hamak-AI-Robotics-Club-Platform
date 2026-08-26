'use server';

import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

export type GradingState = {error?: string; ok?: string} | undefined;

const KNOWN = [
  'AUTH_REQUIRED', 'FORBIDDEN', 'ANSWER_NOT_FOUND', 'SCORE_OUT_OF_RANGE',
  'OVERRIDE_REASON_REQUIRED', 'ATTEMPT_NOT_FOUND', 'ATTEMPT_NOT_GRADING',
  'UNGRADED_ANSWERS_REMAIN',
];
const toKey = (m?: string) => KNOWN.find((k) => m?.includes(k)) ?? 'UNEXPECTED';

/**
 * Records a human grade. The score bound, the grader identity and the
 * amendment-justification rule all live in grade_attempt_answer (migration 0015);
 * this only forwards. Note there is no path here to set `is_override` or
 * `original_score` directly - the database derives both.
 */
export async function gradeAnswer(
  _prev: GradingState,
  formData: FormData
): Promise<GradingState> {
  const answerId = z.string().uuid().safeParse(formData.get('answerId'));
  const score = z.coerce.number().min(0).safeParse(formData.get('awardedScore'));
  if (!answerId.success || !score.success) return {error: 'INVALID_INPUT'};

  const comment = String(formData.get('comment') ?? '').trim();

  const supabase = await createClient();
  const {error} = await supabase.rpc('grade_attempt_answer', {
    p_answer_id: answerId.data,
    p_awarded_score: score.data,
    p_comment: comment || undefined,
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/grading/[attemptId]', 'page');
  return {ok: 'GRADED'};
}

export async function finalizeGrading(
  _prev: GradingState,
  formData: FormData
): Promise<GradingState> {
  const parsed = z.string().uuid().safeParse(formData.get('attemptId'));
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {error} = await supabase.rpc('finalize_attempt_grading', {p_attempt_id: parsed.data});
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/grading', 'page');
  return {ok: 'FINALIZED'};
}
