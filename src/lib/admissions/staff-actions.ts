'use server';

import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

export type AllocationState =
  | {error: string}
  | {ok: true; offered: number; waitlisted: number; rejected: number}
  | undefined;

/**
 * BR-03 seat allocation. A thin trigger only - the ranking, the BR-02 gate and the
 * capacity arithmetic all live in run_seat_allocation (migration 0010), inside one
 * transaction holding the cohort lock. Doing any of it here would race.
 */
export async function runAllocation(
  _prev: AllocationState,
  formData: FormData
): Promise<AllocationState> {
  const parsed = z.string().uuid().safeParse(formData.get('cohortId'));
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {data, error} = await supabase.rpc('run_seat_allocation', {p_cohort_id: parsed.data});

  if (error) {
    if (error.message.includes('FORBIDDEN')) return {error: 'FORBIDDEN'};
    if (error.message.includes('COHORT_NOT_FOUND')) return {error: 'COHORT_NOT_FOUND'};
    return {error: 'UNEXPECTED'};
  }

  const result = data as {offered: number; waitlisted: number; rejected_below_threshold: number};
  revalidatePath('/[locale]/staff/cohorts/[code]', 'page');

  return {
    ok: true,
    offered: result.offered,
    waitlisted: result.waitlisted,
    rejected: result.rejected_below_threshold,
  };
}
