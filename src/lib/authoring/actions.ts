'use server';

import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

export type AuthoringState = {error?: string; ok?: string; id?: string} | undefined;

/**
 * Staff authoring writes for M7 / M8 / M9.
 *
 * These are ordinary inserts and updates under the caller's own RLS — authoring needs no
 * elevated rights, so it is given none (the same reasoning as the M4 question bank).
 *
 * PUBLISHING IS DIFFERENT. `publication_status` is gated by the trigger added in
 * migration 0025, which requires `<module>.APPROVE` and stamps `published_at` itself.
 * That is why no action here ever sends `published_at`: a timestamp the client dictates
 * is not evidence of anything. The publish actions send only the status and let the
 * database decide whether the caller may make that transition, and when it happened.
 */

const KNOWN = [
  'PUBLISH_REQUIRES_APPROVE', 'AUTH_REQUIRED', 'FORBIDDEN',
];
function toKey(message?: string) {
  const hit = KNOWN.find((k) => message?.includes(k));
  if (hit) return hit;
  if (message && /row-level security/i.test(message)) return 'FORBIDDEN';
  if (message && /duplicate key/i.test(message)) return 'CODE_TAKEN';
  return 'UNEXPECTED';
}

const uuid = z.string().uuid();
const code = z.string().trim().min(2).max(32);
const PUBLICATION = ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED'] as const;

/** Optional text: '' from an untouched input means "not set", not "set to empty". */
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

/** Optional date: an empty date input must become NULL, never the epoch. */
const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

// =====================================================================================
//  Publication — one action for all three modules
// =====================================================================================
const TABLES = {
  projects: 'projects',
  events: 'events',
  articles: 'articles',
} as const;

/**
 * Moves an entity along the publication workflow.
 *
 * Deliberately generic: BR-11 is one rule, so it should have one implementation rather
 * than three that can drift. The database decides whether the caller may do it.
 */
export async function setPublicationStatus(
  _prev: AuthoringState,
  formData: FormData
): Promise<AuthoringState> {
  const parsed = z
    .object({
      entity: z.enum(['projects', 'events', 'articles']),
      id: uuid,
      status: z.enum(PUBLICATION),
    })
    .safeParse({
      entity: formData.get('entity'),
      id: formData.get('id'),
      status: formData.get('status'),
    });
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {error} = await supabase
    .from(TABLES[parsed.data.entity])
    // Only the status. `published_at` is the trigger's to set.
    .update({publication_status: parsed.data.status})
    .eq('id', parsed.data.id);
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff', 'layout');
  // The public pages read published rows, so they must not keep serving a stale cache
  // of something that was just withdrawn.
  revalidatePath('/[locale]', 'layout');
  return {ok: parsed.data.status};
}

// =====================================================================================
//  M7 — projects
// =====================================================================================
const projectSchema = z.object({
  code,
  titleAr: z.string().trim().min(1).max(200),
  titleEn: z.string().trim().min(1).max(200),
  abstract: optional(4000),
  problemStatement: optional(4000),
  status: z.enum(['IDEA', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED']),
  outcome: optional(4000),
  startOn: optionalDate,
  endOn: optionalDate,
});

function projectFields(formData: FormData) {
  return projectSchema.safeParse({
    code: formData.get('code'),
    titleAr: formData.get('titleAr'),
    titleEn: formData.get('titleEn'),
    abstract: formData.get('abstract') ?? undefined,
    problemStatement: formData.get('problemStatement') ?? undefined,
    status: formData.get('status'),
    outcome: formData.get('outcome') ?? undefined,
    startOn: formData.get('startOn') ?? undefined,
    endOn: formData.get('endOn') ?? undefined,
  });
}

export async function createProject(
  _prev: AuthoringState,
  formData: FormData
): Promise<AuthoringState> {
  const parsed = projectFields(formData);
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) return {error: 'AUTH_REQUIRED'};

  const {data, error} = await supabase
    .from('projects')
    .insert({
      code: parsed.data.code.toUpperCase(),
      title_ar: parsed.data.titleAr,
      title_en: parsed.data.titleEn,
      abstract: parsed.data.abstract,
      problem_statement: parsed.data.problemStatement,
      status: parsed.data.status,
      outcome: parsed.data.outcome,
      start_on: parsed.data.startOn,
      end_on: parsed.data.endOn,
      // Everything starts as a draft. Publishing is a separate, permissioned act.
      publication_status: 'DRAFT',
      created_by: user.id,
    })
    .select('id')
    .maybeSingle();
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/projects', 'page');
  return {ok: 'CREATED', id: data?.id};
}

export async function updateProject(
  _prev: AuthoringState,
  formData: FormData
): Promise<AuthoringState> {
  const id = uuid.safeParse(formData.get('id'));
  const parsed = projectFields(formData);
  if (!id.success || !parsed.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {error} = await supabase
    .from('projects')
    .update({
      code: parsed.data.code.toUpperCase(),
      title_ar: parsed.data.titleAr,
      title_en: parsed.data.titleEn,
      abstract: parsed.data.abstract,
      problem_statement: parsed.data.problemStatement,
      status: parsed.data.status,
      outcome: parsed.data.outcome,
      start_on: parsed.data.startOn,
      end_on: parsed.data.endOn,
      // publication_status is deliberately absent: editing is not publishing.
    })
    .eq('id', id.data);
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/projects/[id]', 'page');
  return {ok: 'SAVED'};
}

export async function setProjectTechnologies(
  _prev: AuthoringState,
  formData: FormData
): Promise<AuthoringState> {
  const id = uuid.safeParse(formData.get('projectId'));
  if (!id.success) return {error: 'INVALID_INPUT'};

  const chosen = formData
    .getAll('technology')
    .map(String)
    .filter((t) => uuid.safeParse(t).success);

  const supabase = await createClient();
  // Replace wholesale: the form submits the complete intended set, so a diff would just
  // be a more fragile way to reach the same state.
  const {error: delError} = await supabase
    .from('project_technologies')
    .delete()
    .eq('project_id', id.data);
  if (delError) return {error: toKey(delError.message)};

  if (chosen.length > 0) {
    const {error} = await supabase
      .from('project_technologies')
      .insert(chosen.map((t) => ({project_id: id.data, technology_id: t})));
    if (error) return {error: toKey(error.message)};
  }

  revalidatePath('/[locale]/staff/projects/[id]', 'page');
  return {ok: 'SAVED'};
}

// =====================================================================================
//  M8 — events
// =====================================================================================
const eventSchema = z
  .object({
    code,
    titleAr: z.string().trim().min(1).max(200),
    titleEn: z.string().trim().min(1).max(200),
    description: optional(4000),
    type: z.enum(['WORKSHOP', 'EXHIBITION', 'HACKATHON', 'SEMINAR']),
    eligibility: z.enum(['PUBLIC', 'REGISTERED_STUDENTS', 'MEMBERS_ONLY']),
    startsAt: z.string().trim().min(1),
    endsAt: z.string().trim().min(1),
    venueId: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
    capacity: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? Number(v) : null))
      .refine((v) => v === null || (Number.isInteger(v) && v > 0), 'CAPACITY_INVALID'),
  })
  // Caught here as well as by the DB so the organiser gets a message they can act on
  // rather than a constraint name.
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {message: 'END_BEFORE_START'});

function eventFields(formData: FormData) {
  return eventSchema.safeParse({
    code: formData.get('code'),
    titleAr: formData.get('titleAr'),
    titleEn: formData.get('titleEn'),
    description: formData.get('description') ?? undefined,
    type: formData.get('type'),
    eligibility: formData.get('eligibility'),
    startsAt: formData.get('startsAt'),
    endsAt: formData.get('endsAt'),
    venueId: formData.get('venueId') ?? undefined,
    capacity: formData.get('capacity') ?? undefined,
  });
}

function eventRow(d: z.infer<typeof eventSchema>) {
  return {
    code: d.code.toUpperCase(),
    title_ar: d.titleAr,
    title_en: d.titleEn,
    description: d.description,
    type: d.type,
    eligibility: d.eligibility,
    starts_at: new Date(d.startsAt).toISOString(),
    ends_at: new Date(d.endsAt).toISOString(),
    venue_id: d.venueId,
    capacity: d.capacity,
  };
}

export async function createEvent(
  _prev: AuthoringState,
  formData: FormData
): Promise<AuthoringState> {
  const parsed = eventFields(formData);
  if (!parsed.success) {
    const issue = parsed.error.issues.find((i) => i.message === 'END_BEFORE_START');
    return {error: issue ? 'END_BEFORE_START' : 'INVALID_INPUT'};
  }

  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) return {error: 'AUTH_REQUIRED'};

  const {data, error} = await supabase
    .from('events')
    .insert({
      ...eventRow(parsed.data),
      status: 'PLANNED',
      publication_status: 'DRAFT',
      created_by: user.id,
    })
    .select('id')
    .maybeSingle();
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/events', 'page');
  return {ok: 'CREATED', id: data?.id};
}

export async function updateEvent(
  _prev: AuthoringState,
  formData: FormData
): Promise<AuthoringState> {
  const id = uuid.safeParse(formData.get('id'));
  const parsed = eventFields(formData);
  if (!id.success || !parsed.success) {
    const issue = parsed.success
      ? undefined
      : parsed.error.issues.find((i) => i.message === 'END_BEFORE_START');
    return {error: issue ? 'END_BEFORE_START' : 'INVALID_INPUT'};
  }

  const supabase = await createClient();
  const {error} = await supabase.from('events').update(eventRow(parsed.data)).eq('id', id.data);
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/events/[id]', 'page');
  return {ok: 'SAVED'};
}

export async function createVenue(
  _prev: AuthoringState,
  formData: FormData
): Promise<AuthoringState> {
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(200),
      capacity: z
        .string()
        .trim()
        .optional()
        .transform((v) => (v ? Number(v) : null)),
      locationNote: optional(500),
    })
    .safeParse({
      name: formData.get('name'),
      capacity: formData.get('capacity') ?? undefined,
      locationNote: formData.get('locationNote') ?? undefined,
    });
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  // Venues carry a single `name`, not an _ar/_en pair — they are physical places, and
  // the schema models them that way. Do not "fix" this into a bilingual field.
  const {error} = await supabase.from('venues').insert({
    name: parsed.data.name,
    capacity: parsed.data.capacity,
    location_note: parsed.data.locationNote,
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/events', 'layout');
  return {ok: 'CREATED'};
}

export async function addEventSession(
  _prev: AuthoringState,
  formData: FormData
): Promise<AuthoringState> {
  const parsed = z
    .object({
      eventId: uuid,
      title: z.string().trim().min(1).max(200),
      startsAt: z.string().trim().min(1),
      endsAt: z.string().trim().min(1),
      room: optional(120),
      track: optional(120),
      speakerName: optional(200),
    })
    .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {message: 'END_BEFORE_START'})
    .safeParse({
      eventId: formData.get('eventId'),
      title: formData.get('title'),
      startsAt: formData.get('startsAt'),
      endsAt: formData.get('endsAt'),
      room: formData.get('room') ?? undefined,
      track: formData.get('track') ?? undefined,
      speakerName: formData.get('speakerName') ?? undefined,
    });
  if (!parsed.success) {
    const issue = parsed.error.issues.find((i) => i.message === 'END_BEFORE_START');
    return {error: issue ? 'END_BEFORE_START' : 'INVALID_INPUT'};
  }

  const supabase = await createClient();
  const {error} = await supabase.from('event_sessions').insert({
    event_id: parsed.data.eventId,
    title: parsed.data.title,
    starts_at: new Date(parsed.data.startsAt).toISOString(),
    ends_at: new Date(parsed.data.endsAt).toISOString(),
    room: parsed.data.room,
    track: parsed.data.track,
    speaker_name: parsed.data.speakerName,
  });
  // EX_SESSION_ROOM_OVERLAP is a GiST exclusion constraint: two sessions cannot hold the
  // same room at the same time. It surfaces as a conflict, and the organiser needs to be
  // told which problem it is.
  if (error) {
    if (/exclusion|overlap/i.test(error.message)) return {error: 'ROOM_DOUBLE_BOOKED'};
    return {error: toKey(error.message)};
  }

  revalidatePath('/[locale]/staff/events/[id]', 'page');
  return {ok: 'CREATED'};
}

// =====================================================================================
//  M9 — articles (row-per-locale, claude.md §5)
// =====================================================================================
const articleSchema = z.object({
  locale: z.enum(['ar', 'en']),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'SLUG_FORMAT'),
  title: z.string().trim().min(1).max(300),
  summary: optional(1000),
  body: z.string().trim().min(1),
  categoryId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
});

function articleFields(formData: FormData) {
  return articleSchema.safeParse({
    locale: formData.get('locale'),
    slug: formData.get('slug'),
    title: formData.get('title'),
    summary: formData.get('summary') ?? undefined,
    body: formData.get('body'),
    categoryId: formData.get('categoryId') ?? undefined,
  });
}

/**
 * Creates one article row — that is, one LOCALE of an article.
 *
 * `translationGroupId` is optional: omitted, this starts a new group; supplied, it adds
 * the other language to an existing one. That is what makes the pair discoverable later
 * (claude.md §7: query by translation_group_id + locale, fall back to the sibling).
 */
export async function createArticle(
  _prev: AuthoringState,
  formData: FormData
): Promise<AuthoringState> {
  const parsed = articleFields(formData);
  if (!parsed.success) {
    const slugIssue = parsed.error.issues.find((i) => i.message === 'SLUG_FORMAT');
    return {error: slugIssue ? 'SLUG_FORMAT' : 'INVALID_INPUT'};
  }

  const groupRaw = String(formData.get('translationGroupId') ?? '').trim();
  const group = uuid.safeParse(groupRaw);

  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) return {error: 'AUTH_REQUIRED'};

  const {data, error} = await supabase
    .from('articles')
    .insert({
      slug: parsed.data.slug,
      locale: parsed.data.locale,
      translation_group_id: group.success ? group.data : crypto.randomUUID(),
      title: parsed.data.title,
      summary: parsed.data.summary,
      body: parsed.data.body,
      article_category_id: parsed.data.categoryId,
      author_user_id: user.id,
      publication_status: 'DRAFT',
    })
    .select('id')
    .maybeSingle();
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/articles', 'page');
  return {ok: 'CREATED', id: data?.id};
}

export async function updateArticle(
  _prev: AuthoringState,
  formData: FormData
): Promise<AuthoringState> {
  const id = uuid.safeParse(formData.get('id'));
  const parsed = articleFields(formData);
  if (!id.success || !parsed.success) {
    const slugIssue = parsed.success
      ? undefined
      : parsed.error.issues.find((i) => i.message === 'SLUG_FORMAT');
    return {error: slugIssue ? 'SLUG_FORMAT' : 'INVALID_INPUT'};
  }

  const supabase = await createClient();
  const {error} = await supabase
    .from('articles')
    .update({
      slug: parsed.data.slug,
      locale: parsed.data.locale,
      title: parsed.data.title,
      summary: parsed.data.summary,
      body: parsed.data.body,
      article_category_id: parsed.data.categoryId,
    })
    .eq('id', id.data);
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/articles/[id]', 'page');
  return {ok: 'SAVED'};
}
