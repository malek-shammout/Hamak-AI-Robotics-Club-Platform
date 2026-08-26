'use server';

import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

/**
 * M3 admissions. Every one of these is a thin wrapper over a database function that
 * does the real validation (migration 0009). The status is NEVER chosen here - if this
 * file could set `status = 'ENROLLED'` directly, the RLS model would be decorative.
 */

const uuid = z.string().uuid();

export type ActionState = {error?: string; ok?: string} | undefined;

/** Maps a Postgres error to a message key the UI can translate. */
function toKey(message: string | undefined): string {
  const known = [
    'AUTH_REQUIRED',
    'COHORT_NOT_FOUND',
    'COHORT_NOT_OPEN',
    'APPLICATIONS_NOT_YET_OPEN',
    'APPLICATIONS_CLOSED',
    'ALREADY_APPLIED',
    'APPLICATION_NOT_FOUND',
    'NOT_YOUR_APPLICATION',
    'NO_ACTIVE_OFFER',
    'COHORT_FULL',
    'NOT_WITHDRAWABLE',
  ];
  const hit = known.find((k) => message?.includes(k));
  return hit ?? 'UNEXPECTED';
}

export async function applyToCohort(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = uuid.safeParse(formData.get('cohortId'));
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {error} = await supabase.rpc('submit_application', {
    p_cohort_id: parsed.data,
    p_background: {},
  });

  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/me/applications', 'page');
  return {ok: 'APPLIED'};
}

export async function respondToOffer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = uuid.safeParse(formData.get('applicationId'));
  if (!parsed.success) return {error: 'INVALID_INPUT'};
  const accept = formData.get('accept') === 'true';

  const supabase = await createClient();
  const {data, error} = await supabase.rpc('respond_to_offer', {
    p_application_id: parsed.data,
    p_accept: accept,
  });

  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/me/applications', 'page');
  // The function returns the resulting state - including EXPIRED, which is not an
  // error but is also not what the student clicked.
  return data === 'EXPIRED' ? {error: 'OFFER_EXPIRED'} : {ok: String(data)};
}

export async function withdrawApplication(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = uuid.safeParse(formData.get('applicationId'));
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {error} = await supabase.rpc('withdraw_application', {p_application_id: parsed.data});
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/me/applications', 'page');
  return {ok: 'WITHDRAWN'};
}
