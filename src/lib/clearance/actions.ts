'use server';

import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

export type ClearanceState = {error?: string; ok?: string} | undefined;

const KNOWN = [
  'AUTH_REQUIRED', 'FORBIDDEN', 'ENROLLMENT_NOT_FOUND', 'PRECONDITIONS_FAILED',
  'OVERRIDE_REQUIRES_ADMIN', 'ALREADY_APPROVED', 'NO_CLEARANCE_RECORD',
  'CLEARANCE_NOT_APPROVED', 'CERTIFICATE_ALREADY_ISSUED',
];
const toKey = (m?: string) => KNOWN.find((k) => m?.includes(k)) ?? 'UNEXPECTED';

const uuid = z.string().uuid();

/** Re-runs the §B.2 decision table and refreshes the stored snapshot and blockers. */
export async function reevaluateClearance(
  _prev: ClearanceState,
  formData: FormData
): Promise<ClearanceState> {
  const parsed = uuid.safeParse(formData.get('enrollmentId'));
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {error} = await supabase.rpc('evaluate_clearance', {p_enrollment_id: parsed.data});
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/clearance/[enrollmentId]', 'page');
  return {ok: 'EVALUATED'};
}

/**
 * UC-6.11. approve_clearance re-evaluates before deciding, so a snapshot that went
 * stale between page load and click cannot let a failing precondition through.
 */
export async function approveClearance(
  _prev: ClearanceState,
  formData: FormData
): Promise<ClearanceState> {
  const parsed = uuid.safeParse(formData.get('enrollmentId'));
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const override = String(formData.get('overrideJustification') ?? '').trim();

  const supabase = await createClient();
  const {error} = await supabase.rpc('approve_clearance', {
    p_enrollment_id: parsed.data,
    p_override_justification: override || undefined,
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/clearance/[enrollmentId]', 'page');
  return {ok: 'APPROVED'};
}

/**
 * UC-6.14. BR-01 is guaranteed structurally by the composite FK (D-09), not by this
 * call succeeding — issue_certificate writes clearance_status from the locked
 * clearance row, so a forged value is impossible.
 */
export async function issueCertificate(
  _prev: ClearanceState,
  formData: FormData
): Promise<ClearanceState> {
  const parsed = uuid.safeParse(formData.get('enrollmentId'));
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {error} = await supabase.rpc('issue_certificate', {p_enrollment_id: parsed.data});
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/clearance/[enrollmentId]', 'page');
  return {ok: 'ISSUED'};
}
