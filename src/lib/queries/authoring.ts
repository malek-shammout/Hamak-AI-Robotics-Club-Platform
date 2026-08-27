import 'server-only';

import {createClient} from '@/lib/supabase/server';

/**
 * Staff authoring reads for M7 (projects), M8 (events) and M9 (media/articles).
 *
 * These read through `staff_read`, which is gated on `<module>.READ`. A caller without
 * it gets an empty list rather than an error, and the pages render an empty state —
 * the page is not the boundary, RLS is.
 *
 * Note these are the STAFF views, so unlike the public queries they deliberately do NOT
 * filter on `publication_status`: seeing your own drafts is the entire point.
 */

// ---------------------------------------------------------------- M7 projects
export async function getStaffProjects() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('projects')
    .select(
      `id, code, title_ar, title_en, status, publication_status, published_at,
       start_on, end_on, created_at`
    )
    .order('created_at', {ascending: false});
  return data ?? [];
}

export async function getStaffProject(id: string) {
  const supabase = await createClient();
  const {data} = await supabase
    .from('projects')
    .select(
      `id, code, title_ar, title_en, abstract, problem_statement, status, outcome,
       start_on, end_on, publication_status, published_at,
       project_members(project_id, user_id, role_in_project, contribution_note,
                       users(full_name_ar, full_name_en)),
       project_technologies(technology_id, technologies(id, name, category))`
    )
    .eq('id', id)
    .maybeSingle();
  return data;
}

export async function getTechnologies() {
  const supabase = await createClient();
  const {data} = await supabase.from('technologies').select('id, name, category').order('name');
  return data ?? [];
}

// ---------------------------------------------------------------- M8 events
export async function getStaffEvents() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('events')
    .select(
      `id, code, title_ar, title_en, type, status, publication_status, published_at,
       starts_at, ends_at, capacity, venues(name)`
    )
    .order('starts_at', {ascending: false});
  return data ?? [];
}

export async function getStaffEvent(id: string) {
  const supabase = await createClient();
  const {data} = await supabase
    .from('events')
    .select(
      `id, code, title_ar, title_en, description, type, status, eligibility,
       starts_at, ends_at, capacity, waitlist_capacity, venue_id,
       registration_opens_at, registration_closes_at,
       publication_status, published_at,
       venues(id, name, capacity),
       event_sessions(id, title, starts_at, ends_at, room, track, speaker_name)`
    )
    .eq('id', id)
    .maybeSingle();
  return data;
}

export async function getVenues() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('venues')
    .select('id, name, capacity, location_note')
    .order('name');
  return data ?? [];
}

/**
 * Registration counts, so an organiser can see uptake without opening each event.
 *
 * Cancelled registrations are excluded. Counting every row would overstate uptake and,
 * worse, make a half-empty event look full enough to stop promoting.
 */
export async function getEventRegistrationCounts() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('event_registrations')
    .select('event_id, cancelled_at')
    .is('cancelled_at', null);
  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    counts.set(r.event_id, (counts.get(r.event_id) ?? 0) + 1);
  }
  return counts;
}

// ---------------------------------------------------------------- M9 articles
export async function getStaffArticles() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('articles')
    .select(
      `id, slug, locale, translation_group_id, title, summary,
       publication_status, published_at, created_at,
       article_categories(code, name_ar, name_en)`
    )
    .order('created_at', {ascending: false});
  return data ?? [];
}

export async function getStaffArticle(id: string) {
  const supabase = await createClient();
  const {data} = await supabase
    .from('articles')
    .select(
      `id, slug, locale, translation_group_id, title, summary, body,
       article_category_id, publication_status, published_at, review_comments,
       article_categories(id, code, name_ar, name_en)`
    )
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;

  // claude.md §5: long-form content is row-per-locale joined by `translation_group_id`.
  // The sibling is fetched with the article so the editor can see at a glance whether
  // the other language exists — a published article with only one locale renders as a
  // dead end for half the audience.
  const {data: siblings} = await supabase
    .from('articles')
    .select('id, locale, title, publication_status')
    .eq('translation_group_id', data.translation_group_id);

  return {...data, siblings: (siblings ?? []).filter((s) => s.id !== data.id)};
}

export async function getArticleCategories() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('article_categories')
    .select('id, code, name_ar, name_en')
    .order('code');
  return data ?? [];
}
