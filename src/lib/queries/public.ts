import 'server-only';

import {createClient} from '@/lib/supabase/server';
import type {Locale} from '@/i18n/routing';

/**
 * Read layer for the M1 public portal.
 *
 * Every function here runs through the RLS-bound anon/authenticated client, so the
 * database is the authority on what is visible (BR-11 / D-08). The explicit
 * `publication_status` filters below are NOT the security boundary - they are there
 * so the intent is readable and so the planner can use the partial indexes. Removing
 * them would not leak anything; removing the RLS policy would.
 */

export async function getPublishedCourses() {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('courses')
    .select('id, code, title_ar, title_en, track, level, description_ar, description_en, session_count, duration_hours, requires_screening')
    .eq('status', 'PUBLISHED')
    .order('code');
  if (error) throw error;
  return data ?? [];
}

export async function getCourseByCode(code: string) {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('courses')
    .select('id, code, title_ar, title_en, track, level, description_ar, description_en, learning_outcomes, prerequisites_text, session_count, duration_hours, requires_screening')
    .eq('status', 'PUBLISHED')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Cohorts visible to the public: OPEN / RUNNING / FINISHED (see RLS policy). */
export async function getCohortsForCourse(courseId: string) {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('cohorts')
    .select('id, code, capacity, application_opens_at, application_closes_at, starts_on, ends_on, status')
    .eq('course_id', courseId)
    .order('starts_on', {ascending: false});
  if (error) throw error;
  return data ?? [];
}

export async function getPublicCourseModules(courseId: string) {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('course_modules')
    .select('id, order_index, title, objectives, estimated_minutes')
    .eq('course_id', courseId)
    .order('order_index');
  if (error) throw error;
  return data ?? [];
}

export async function getPublishedProjects() {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('projects')
    .select('id, code, title_ar, title_en, abstract, status, start_on, end_on, published_at, project_technologies(technologies(name))')
    .eq('publication_status', 'PUBLISHED')
    .order('published_at', {ascending: false});
  if (error) throw error;
  return data ?? [];
}

export async function getProjectByCode(code: string) {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('projects')
    .select('id, code, title_ar, title_en, abstract, problem_statement, outcome, status, start_on, end_on, published_at, project_technologies(technologies(name)), project_members(role_in_project, contribution_note, users(full_name_ar, full_name_en))')
    .eq('publication_status', 'PUBLISHED')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPublishedEvents() {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('events')
    .select('id, code, type, title_ar, title_en, description, starts_at, ends_at, capacity, eligibility, status, venues(name, location_note)')
    .eq('publication_status', 'PUBLISHED')
    .order('starts_at', {ascending: false});
  if (error) throw error;
  return data ?? [];
}

export async function getEventByCode(code: string) {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('events')
    .select('id, code, type, title_ar, title_en, description, starts_at, ends_at, capacity, eligibility, status, target_audience, registration_opens_at, registration_closes_at, venues(name, location_note), event_sessions(id, title, starts_at, ends_at, room, track, speaker_name)')
    .eq('publication_status', 'PUBLISHED')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * claude.md 7 - `articles` uses ROW-PER-LOCALE with translation_group_id.
 * The list is filtered to the active locale; an article that exists only in the
 * other language simply does not appear in this list. The detail page falls back.
 */
export async function getPublishedArticles(locale: Locale) {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('articles')
    .select('id, slug, locale, translation_group_id, title, summary, published_at, article_categories(name_ar, name_en)')
    .eq('publication_status', 'PUBLISHED')
    .eq('locale', locale)
    .order('published_at', {ascending: false});
  if (error) throw error;
  return data ?? [];
}

export async function getArticleBySlug(slug: string, locale: Locale) {
  const supabase = await createClient();

  const {data, error} = await supabase
    .from('articles')
    .select('id, slug, locale, translation_group_id, title, summary, body, published_at, article_categories(name_ar, name_en)')
    .eq('publication_status', 'PUBLISHED')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  // Exact locale match - done.
  if (data.locale === locale) return {article: data, isFallback: false};

  // The slug resolved to the other language. Try this locale's sibling via the
  // translation group before falling back to what we already have.
  const {data: sibling} = await supabase
    .from('articles')
    .select('id, slug, locale, translation_group_id, title, summary, body, published_at, article_categories(name_ar, name_en)')
    .eq('publication_status', 'PUBLISHED')
    .eq('translation_group_id', data.translation_group_id)
    .eq('locale', locale)
    .maybeSingle();

  return sibling ? {article: sibling, isFallback: false} : {article: data, isFallback: true};
}

export type CertificateVerification = {
  serial_no: string;
  issued_at: string;
  cert_status: 'ISSUED' | 'REVOKED' | 'REISSUED';
  student_name_ar: string;
  student_name_en: string;
  course_title_ar: string;
  course_title_en: string;
  course_level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  cohort_code: string;
  revoked_at: string | null;
};

/**
 * BR-10 - resolvable by any third party WITHOUT authentication.
 * Backed by the SECURITY DEFINER function added in migration 0005: `users`,
 * `enrollments` and `cohorts` stay closed to anon; only this fixed projection escapes.
 */
export async function verifyCertificate(code: string): Promise<CertificateVerification | null> {
  const supabase = await createClient();
  const {data, error} = await supabase.rpc('verify_certificate', {p_code: code});
  if (error) throw error;
  const rows = (data ?? []) as CertificateVerification[];
  return rows[0] ?? null;
}
