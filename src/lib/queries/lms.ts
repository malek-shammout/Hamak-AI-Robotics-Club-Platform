import 'server-only';

import {createClient} from '@/lib/supabase/server';

/**
 * M3 delivery (LMS) reads. Bounded by the `staff_read` policies (M3.READ) except
 * where noted; a student hitting these routes gets nothing rather than a leak.
 */

export async function getCohortSessions(cohortId: string) {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('cohort_sessions')
    .select('id, session_no, scheduled_at, duration_minutes, location, status, course_modules(title)')
    .eq('cohort_id', cohortId)
    .order('session_no');
  if (error) throw error;
  return data ?? [];
}

export async function getSession(sessionId: string) {
  const supabase = await createClient();
  const {data} = await supabase
    .from('cohort_sessions')
    .select('id, cohort_id, session_no, scheduled_at, duration_minutes, location, status, cohorts(code, min_attendance_pct, courses(title_ar, title_en))')
    .eq('id', sessionId)
    .maybeSingle();
  return data;
}

/**
 * The roster for one session: every ACTIVE enrollment in the cohort, with whatever
 * mark already exists. Built from enrollments (not attendance_records) so a student
 * who has never been marked still appears — otherwise they would silently vanish
 * from the register.
 */
export async function getSessionRoster(cohortId: string, sessionId: string) {
  const supabase = await createClient();

  const [{data: enrollments}, {data: marks}] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id, status, users!student_user_id(full_name_ar, full_name_en)')
      .eq('cohort_id', cohortId)
      .in('status', ['ACTIVE', 'COMPLETED', 'COMPLETED_BY_OVERRIDE']),
    supabase
      .from('attendance_records')
      .select('enrollment_id, state, note, amended_at, amendment_reason')
      .eq('cohort_session_id', sessionId),
  ]);

  const markBy = new Map((marks ?? []).map((m) => [m.enrollment_id, m]));
  return (enrollments ?? []).map((e) => ({...e, mark: markBy.get(e.id) ?? null}));
}

/** Enrollments in a cohort with their attendance standing, for the completion screen. */
export async function getCohortEnrollments(cohortId: string) {
  const supabase = await createClient();

  const [{data: enrollments}, {data: attendance}] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id, status, completed_at, completion_overridden, completion_override_reason, users!student_user_id(full_name_ar, full_name_en)')
      .eq('cohort_id', cohortId),
    supabase.from('v_enrollment_attendance').select('*').eq('cohort_id', cohortId),
  ]);

  const attBy = new Map((attendance ?? []).map((a) => [a.enrollment_id, a]));
  return (enrollments ?? []).map((e) => ({...e, attendance: attBy.get(e.id) ?? null}));
}

/** A student's own enrollments. Scoped by the `self_read_enrollments` policy. */
export async function getMyEnrollments() {
  const supabase = await createClient();
  const [{data: enrollments}, {data: attendance}] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id, cohort_id, status, enrolled_at, completed_at, cohorts(code, starts_on, ends_on, min_attendance_pct, courses(code, title_ar, title_en, level))')
      .order('enrolled_at', {ascending: false}),
    supabase.from('v_enrollment_attendance').select('*'),
  ]);

  const attBy = new Map((attendance ?? []).map((a) => [a.enrollment_id, a]));
  return (enrollments ?? []).map((e) => ({...e, attendance: attBy.get(e.id) ?? null}));
}

/** Materials a student may see for a cohort they are enrolled in. */
export async function getCourseMaterialsForEnrollment(courseId: string) {
  const supabase = await createClient();
  const {data} = await supabase
    .from('course_modules')
    .select('id, order_index, title, objectives, estimated_minutes, visibility, course_module_materials(id, title, visibility, media_assets(storage_key, mime_type))')
    .eq('course_id', courseId)
    .order('order_index');
  return data ?? [];
}
