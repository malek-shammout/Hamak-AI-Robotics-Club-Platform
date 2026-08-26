'use server';

import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

export type LmsState = {error?: string; ok?: string} | undefined;

const KNOWN = [
  'AUTH_REQUIRED', 'FORBIDDEN', 'ENROLLMENT_NOT_FOUND', 'SESSION_NOT_FOUND',
  'SESSION_COHORT_MISMATCH', 'AMENDMENT_REASON_REQUIRED', 'ENROLLMENT_NOT_ACTIVE',
  'BR05_NOT_SATISFIED', 'OVERRIDE_REQUIRES_ADMIN',
];
const toKey = (m?: string) => KNOWN.find((k) => m?.includes(k)) ?? 'UNEXPECTED';

const uuid = z.string().uuid();

/**
 * Records or amends one attendance mark.
 *
 * The cohort/session consistency check and the amendment-justification rule both live
 * in record_attendance (migration 0016). Amending a recorded mark without a reason is
 * refused by the database, not merely discouraged here.
 */
export async function markAttendance(_prev: LmsState, formData: FormData): Promise<LmsState> {
  const enrollmentId = uuid.safeParse(formData.get('enrollmentId'));
  const sessionId = uuid.safeParse(formData.get('sessionId'));
  const state = z
    .enum(['PRESENT', 'ABSENT', 'EXCUSED', 'LATE'])
    .safeParse(formData.get('state'));
  if (!enrollmentId.success || !sessionId.success || !state.success) {
    return {error: 'INVALID_INPUT'};
  }

  const reason = String(formData.get('amendmentReason') ?? '').trim();

  const supabase = await createClient();
  const {error} = await supabase.rpc('record_attendance', {
    p_enrollment_id: enrollmentId.data,
    p_cohort_session_id: sessionId.data,
    p_state: state.data,
    p_note: undefined,
    p_amendment_reason: reason || undefined,
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/sessions/[sessionId]', 'page');
  return {ok: 'MARKED'};
}

/** Session lifecycle. Plain RLS writes - no elevated rights are needed, so none are used. */
export async function setSessionStatus(_prev: LmsState, formData: FormData): Promise<LmsState> {
  const sessionId = uuid.safeParse(formData.get('sessionId'));
  const status = z
    .enum(['PLANNED', 'HELD', 'CANCELLED'])
    .safeParse(formData.get('status'));
  if (!sessionId.success || !status.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {error} = await supabase
    .from('cohort_sessions')
    .update({status: status.data})
    .eq('id', sessionId.data);
  if (error) {
    return {error: error.message.includes('row-level security') ? 'FORBIDDEN' : 'UNEXPECTED'};
  }

  revalidatePath('/[locale]/staff/cohorts/[code]/sessions', 'page');
  return {ok: 'STATUS_SET'};
}

export async function createSession(_prev: LmsState, formData: FormData): Promise<LmsState> {
  const parsed = z
    .object({
      cohortId: uuid,
      sessionNo: z.coerce.number().int().positive().max(999),
      scheduledAt: z.string().min(1),
      durationMinutes: z.coerce.number().int().positive().max(600),
      location: z.string().trim().max(200).optional(),
    })
    .safeParse({
      cohortId: formData.get('cohortId'),
      sessionNo: formData.get('sessionNo'),
      scheduledAt: formData.get('scheduledAt'),
      durationMinutes: formData.get('durationMinutes'),
      location: formData.get('location') || undefined,
    });
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {error} = await supabase.from('cohort_sessions').insert({
    cohort_id: parsed.data.cohortId,
    session_no: parsed.data.sessionNo,
    scheduled_at: new Date(parsed.data.scheduledAt).toISOString(),
    duration_minutes: parsed.data.durationMinutes,
    location: parsed.data.location ?? null,
    status: 'PLANNED',
  });
  if (error) {
    // UQ_COHORT_SESSION_NO - a duplicate number is a real authoring mistake.
    if (error.message.includes('uq_cohort_session_no')) return {error: 'DUPLICATE_SESSION_NO'};
    return {error: error.message.includes('row-level security') ? 'FORBIDDEN' : 'UNEXPECTED'};
  }

  revalidatePath('/[locale]/staff/cohorts/[code]/sessions', 'page');
  return {ok: 'SESSION_CREATED'};
}

/**
 * BR-05 completion.
 *
 * `evaluationsPassed` is an ATTESTATION by A2, not a computed value - the frozen model
 * has no course-evaluation entity (see migration 0016). It is sent as an explicit
 * boolean and the database refuses completion when it is false, exactly as it refuses
 * short attendance.
 */
export async function completeEnrollment(_prev: LmsState, formData: FormData): Promise<LmsState> {
  const enrollmentId = uuid.safeParse(formData.get('enrollmentId'));
  if (!enrollmentId.success) return {error: 'INVALID_INPUT'};

  const evaluationsPassed = formData.get('evaluationsPassed') === 'on';
  const overrideReason = String(formData.get('overrideReason') ?? '').trim();

  const supabase = await createClient();
  const {error} = await supabase.rpc('mark_enrollment_completed', {
    p_enrollment_id: enrollmentId.data,
    p_evaluations_passed: evaluationsPassed,
    p_override_reason: overrideReason || undefined,
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/cohorts/[code]/completion', 'page');
  return {ok: 'COMPLETED'};
}
