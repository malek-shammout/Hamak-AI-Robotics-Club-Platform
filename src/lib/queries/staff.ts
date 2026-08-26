import 'server-only';

import {createClient} from '@/lib/supabase/server';

/**
 * A2 (Training Team) reads. Everything here is bounded by the `staff_read` RLS
 * policies, which require the M3.READ permission - a student hitting these routes
 * gets empty results, not a leak.
 */

export async function getCohortsWithFunnel() {
  const supabase = await createClient();

  const [{data: cohorts, error}, {data: funnel}] = await Promise.all([
    supabase
      .from('cohorts')
      .select('id, code, capacity, status, starts_on, application_closes_at, courses(code, title_ar, title_en, requires_screening)')
      .order('starts_on', {ascending: false}),
    supabase.from('v_cohort_funnel').select('*'),
  ]);
  if (error) throw error;

  const byId = new Map((funnel ?? []).map((f) => [f.cohort_id, f]));
  return (cohorts ?? []).map((c) => ({...c, funnel: byId.get(c.id) ?? null}));
}

export async function getCohortByCodeForStaff(code: string) {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('cohorts')
    .select('id, code, capacity, waitlist_capacity, status, starts_on, offer_confirmation_hours, min_attendance_pct, courses(code, title_ar, title_en, requires_screening)')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * The ranking A2 sees before pressing "run allocation".
 *
 * Ordered exactly as run_seat_allocation orders it - readiness_score descending,
 * nulls last, submitted_at as the tie-break. If this ordering and the function's
 * ordering ever diverge, the preview stops predicting the outcome, which is worse
 * than showing nothing.
 */
export async function getCohortApplicants(cohortId: string) {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('applications')
    // `applications` has TWO foreign keys to `users` (applicant_user_id and decided_by),
    // so the embed must name the column or PostgREST cannot resolve it.
    .select('id, status, readiness_score, rank_position, waitlist_rank, submitted_at, offer_expires_at, users!applicant_user_id(full_name_ar, full_name_en)')
    .eq('cohort_id', cohortId)
    .order('readiness_score', {ascending: false, nullsFirst: false})
    .order('submitted_at', {ascending: true});
  if (error) throw error;
  return data ?? [];
}

export async function getScreeningTest(cohortId: string) {
  const supabase = await createClient();
  const {data} = await supabase
    .from('screening_tests')
    .select('id, title, pass_threshold, max_score, status')
    .eq('cohort_id', cohortId)
    .maybeSingle();
  return data;
}
