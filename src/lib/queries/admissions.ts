import 'server-only';

import {createClient} from '@/lib/supabase/server';

/**
 * A student's own applications.
 *
 * No `.eq('applicant_user_id', me)` filter is needed: the RLS policy
 * `self_read_applications` already scopes this to the caller. Adding a redundant
 * client-side filter would imply the policy is not trusted.
 */
export async function getMyApplications() {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('applications')
    .select(
      'id, status, submitted_at, offer_expires_at, readiness_score, waitlist_rank, cohorts(code, starts_on, courses(code, title_ar, title_en, level))'
    )
    .order('submitted_at', {ascending: false});
  if (error) throw error;
  return data ?? [];
}

/** Cohort ids the caller already has a live application for, to disable the apply button. */
export async function getMyLiveCohortIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('applications')
    .select('cohort_id, status')
    .not('status', 'in', '(WITHDRAWN,REJECTED,DECLINED,EXPIRED)');
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.cohort_id));
}
