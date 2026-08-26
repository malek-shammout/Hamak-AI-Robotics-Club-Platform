'use server';

import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

/**
 * M4 assessment. Every function here is a thin wrapper over a database function
 * (migrations 0013/0014).
 *
 * Note what is ABSENT: nothing in this file writes a score. The client cannot reach a
 * scoring column at all - `attempt_answers` is SELECT-only for students, and the
 * grading columns are written exclusively by submit_test_attempt() inside the database.
 * That separation is the fix for the self-grading flaw; do not add a score parameter
 * to any of these actions.
 */

const uuid = z.string().uuid();

export type AssessmentState = {error?: string; ok?: string} | undefined;

const KNOWN = [
  'AUTH_REQUIRED', 'APPLICATION_NOT_FOUND', 'NOT_YOUR_APPLICATION',
  'NOT_ELIGIBLE_FOR_SCREENING', 'NO_ACTIVE_TEST', 'ATTEMPT_LIMIT_REACHED',
  'ATTEMPT_NOT_FOUND', 'NOT_YOUR_ATTEMPT', 'ATTEMPT_NOT_IN_PROGRESS',
  'ATTEMPT_EXPIRED', 'QUESTION_NOT_IN_TEST', 'OPTION_NOT_IN_QUESTION',
  'UQ_ATTEMPT_LIMIT',
];

function toKey(message?: string): string {
  return KNOWN.find((k) => message?.includes(k)) ?? 'UNEXPECTED';
}

export async function startAttempt(
  _prev: AssessmentState,
  formData: FormData
): Promise<AssessmentState> {
  const parsed = uuid.safeParse(formData.get('applicationId'));
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {data, error} = await supabase.rpc('start_test_attempt', {
    p_application_id: parsed.data,
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/me/applications', 'page');
  return {ok: String(data)};   // the attempt id
}

export async function saveAnswer(
  _prev: AssessmentState,
  formData: FormData
): Promise<AssessmentState> {
  const attemptId = uuid.safeParse(formData.get('attemptId'));
  const questionId = uuid.safeParse(formData.get('questionId'));
  if (!attemptId.success || !questionId.success) return {error: 'INVALID_INPUT'};

  const rawOption = formData.get('selectedOptionId');
  const optionId = rawOption ? uuid.safeParse(rawOption) : null;

  const supabase = await createClient();
  const {error} = await supabase.rpc('save_attempt_answer', {
    p_attempt_id: attemptId.data,
    p_question_id: questionId.data,
    p_selected_option_id: optionId?.success ? optionId.data : undefined,
    p_answer_payload: undefined,
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/me/screening/[attemptId]', 'page');
  return {ok: 'SAVED'};
}

export async function submitAttempt(
  _prev: AssessmentState,
  formData: FormData
): Promise<AssessmentState> {
  const parsed = uuid.safeParse(formData.get('attemptId'));
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {error} = await supabase.rpc('submit_test_attempt', {p_attempt_id: parsed.data});
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/me/applications', 'page');
  return {ok: 'SUBMITTED'};
}
