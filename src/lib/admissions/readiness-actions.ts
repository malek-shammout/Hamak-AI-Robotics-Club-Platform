'use server';

import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

export type ReadinessState = {error: string} | {ok: true; scored: number} | undefined;

/**
 * US-TRN-06. Recomputes the readiness snapshot for every live application in a cohort.
 *
 * Run this BEFORE allocation: BR-03 ranks on the stored readiness_score, so allocating
 * first would rank on whatever the previous run left behind.
 */
export async function computeCohortReadiness(
  _prev: ReadinessState,
  formData: FormData
): Promise<ReadinessState> {
  const parsed = z.string().uuid().safeParse(formData.get('cohortId'));
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {data, error} = await supabase.rpc('compute_readiness_for_cohort', {
    p_cohort_id: parsed.data,
  });

  if (error) {
    if (error.message.includes('FORBIDDEN')) return {error: 'FORBIDDEN'};
    if (error.message.includes('NO_ACTIVE_READINESS_MODEL')) return {error: 'NO_ACTIVE_MODEL'};
    return {error: 'UNEXPECTED'};
  }

  revalidatePath('/[locale]/staff/cohorts/[code]', 'page');
  return {ok: true, scored: (data as {scored: number}).scored};
}
