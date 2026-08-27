'use server';

import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

export type ConsultationState = {error?: string; ok?: string; id?: string} | undefined;

/**
 * The database is the authority (D-11): every function called here is SECURITY DEFINER
 * and asserts its own authorisation first. These actions validate shape, call the RPC,
 * and translate the error code — they do not re-implement the rule, because a check
 * duplicated in TypeScript is a check that can drift out of agreement with the one that
 * actually runs.
 */
const KNOWN = [
  'AUTH_REQUIRED', 'FORBIDDEN', 'TITLE_REQUIRED', 'DUPLICATE_OPEN_REQUEST',
  'REQUEST_NOT_FOUND', 'NOT_TRIAGEABLE', 'NOT_ASSIGNABLE', 'EXPERT_UNAVAILABLE',
  'EXPERT_AT_CAPACITY', 'ASSIGNMENT_NOT_FOUND', 'NOT_YOUR_ASSIGNMENT',
  'ASSIGNMENT_NOT_PENDING', 'DECLINE_REASON_REQUIRED', 'ALREADY_RESOLVED',
  'OUTCOME_AND_SUMMARY_REQUIRED', 'EXPERTISE_NOT_FOUND', 'NOT_YOUR_EXPERTISE',
];
const toKey = (m?: string) => KNOWN.find((k) => m?.includes(k)) ?? 'UNEXPECTED';

const uuid = z.string().uuid();
const SUPPORT = ['TECHNICAL_ADVICE', 'COMPONENT_SELECTION', 'CODE_REVIEW', 'MENTORSHIP', 'OTHER'] as const;
const PRIORITY = ['LOW', 'NORMAL', 'HIGH'] as const;
const COMPLEXITY = ['LOW', 'MEDIUM', 'HIGH'] as const;
const OUTCOME = ['ADVICE_GIVEN', 'ONGOING_MENTORSHIP', 'OUT_OF_SCOPE', 'UNRESPONSIVE'] as const;

/** A1 submits. BR-08 starts the SLA clock inside the RPC, not here. */
export async function submitConsultation(
  _prev: ConsultationState,
  formData: FormData
): Promise<ConsultationState> {
  const parsed = z
    .object({
      title: z.string().trim().min(1).max(300),
      // Required, not optional: `submit_consultation_request` takes p_abstract with no
      // SQL default, and a consultation with no description cannot be triaged or
      // matched to a field anyway. The form marks it required to match.
      abstract: z.string().trim().min(1).max(4000),
      supportType: z.enum(SUPPORT),
      supervisorName: z.string().trim().max(200).optional(),
      deadline: z.string().trim().optional(),
    })
    .safeParse({
      title: formData.get('title'),
      abstract: formData.get('abstract'),
      supportType: formData.get('supportType'),
      supervisorName: formData.get('supervisorName') ?? undefined,
      deadline: formData.get('deadline') ?? undefined,
    });
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const domains = formData
    .getAll('domain')
    .map(String)
    .filter((d) => uuid.safeParse(d).success);

  const supabase = await createClient();
  const {data, error} = await supabase.rpc('submit_consultation_request', {
    p_title: parsed.data.title,
    p_abstract: parsed.data.abstract,
    p_support_type: parsed.data.supportType,
    p_domain_ids: domains,
    p_supervisor_name: parsed.data.supervisorName || undefined,
    p_project_deadline_on: parsed.data.deadline || undefined,
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/me/consultations', 'page');
  return {ok: 'SUBMITTED', id: data as string};
}

/** A4 classifies. */
export async function triageConsultation(
  _prev: ConsultationState,
  formData: FormData
): Promise<ConsultationState> {
  const parsed = z
    .object({
      requestId: uuid,
      priority: z.enum(PRIORITY),
      complexity: z.enum(COMPLEXITY),
    })
    .safeParse({
      requestId: formData.get('requestId'),
      priority: formData.get('priority'),
      complexity: formData.get('complexity'),
    });
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const domains = formData
    .getAll('domain')
    .map(String)
    .filter((d) => uuid.safeParse(d).success);

  const supabase = await createClient();
  const {error} = await supabase.rpc('triage_consultation', {
    p_request_id: parsed.data.requestId,
    p_priority: parsed.data.priority,
    p_complexity: parsed.data.complexity,
    // Passing an empty array would WIPE the domains the student chose; only send the
    // list when the triager actually edited it.
    p_domain_ids: domains.length > 0 ? domains : undefined,
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/consultations/[id]', 'page');
  return {ok: 'TRIAGED'};
}

/** A4 assigns. Availability and max_concurrent_load are re-checked in the RPC. */
export async function assignExpert(
  _prev: ConsultationState,
  formData: FormData
): Promise<ConsultationState> {
  const requestId = uuid.safeParse(formData.get('requestId'));
  const expertId = uuid.safeParse(formData.get('expertId'));
  if (!requestId.success || !expertId.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {error} = await supabase.rpc('assign_consultation_expert', {
    p_request_id: requestId.data,
    p_expert_user_id: expertId.data,
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/consultations/[id]', 'page');
  return {ok: 'ASSIGNED'};
}

/** The named expert answers for themselves — the RPC refuses anyone else. */
export async function respondToAssignment(
  _prev: ConsultationState,
  formData: FormData
): Promise<ConsultationState> {
  const id = uuid.safeParse(formData.get('assignmentId'));
  if (!id.success) return {error: 'INVALID_INPUT'};

  const accept = formData.get('accept') === 'true';
  const reason = String(formData.get('declineReason') ?? '').trim();
  if (!accept && !reason) return {error: 'DECLINE_REASON_REQUIRED'};

  const supabase = await createClient();
  const {error} = await supabase.rpc('respond_to_assignment', {
    p_assignment_id: id.data,
    p_accept: accept,
    p_decline_reason: accept ? undefined : reason,
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/me/consultations', 'page');
  return {ok: accept ? 'ACCEPTED' : 'DECLINED'};
}

/**
 * Posting a message.
 *
 * This is a plain insert rather than an RPC, and that is deliberate: the RLS policy
 * `participants_send_messages` is the boundary, so exercising it here means a
 * regression in that policy shows up as a broken feature instead of being masked by a
 * SECURITY DEFINER wrapper that re-derives participation independently.
 */
export async function postMessage(
  _prev: ConsultationState,
  formData: FormData
): Promise<ConsultationState> {
  const requestId = uuid.safeParse(formData.get('requestId'));
  const body = z.string().trim().min(1).max(8000).safeParse(formData.get('body'));
  if (!requestId.success || !body.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) return {error: 'AUTH_REQUIRED'};

  const {error} = await supabase.from('consultation_messages').insert({
    consultation_request_id: requestId.data,
    sender_user_id: user.id,
    body: body.data,
  });
  // A non-participant hits the policy, which surfaces as a row-level-security error.
  if (error) return {error: /row-level security/i.test(error.message) ? 'FORBIDDEN' : 'UNEXPECTED'};

  revalidatePath('/[locale]/me/consultations/[id]', 'page');
  return {ok: 'SENT'};
}

/** Closing a case. AD-7 makes the outcome category and summary mandatory. */
export async function resolveConsultation(
  _prev: ConsultationState,
  formData: FormData
): Promise<ConsultationState> {
  const parsed = z
    .object({
      requestId: uuid,
      outcome: z.enum(OUTCOME),
      summary: z.string().trim().min(1).max(4000),
    })
    .safeParse({
      requestId: formData.get('requestId'),
      outcome: formData.get('outcome'),
      summary: formData.get('summary'),
    });
  if (!parsed.success) return {error: 'OUTCOME_AND_SUMMARY_REQUIRED'};

  const supabase = await createClient();
  const {error} = await supabase.rpc('resolve_consultation', {
    p_request_id: parsed.data.requestId,
    p_outcome: parsed.data.outcome,
    p_summary: parsed.data.summary,
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/me/consultations/[id]', 'page');
  return {ok: 'RESOLVED'};
}

/**
 * D-06: a member toggles their OWN availability and nothing else.
 *
 * The RPC updates only `is_available`. Proficiency and curation stay with A4, which is
 * why there is no action here that can write them.
 */
export async function setAvailability(
  _prev: ConsultationState,
  formData: FormData
): Promise<ConsultationState> {
  const id = uuid.safeParse(formData.get('expertiseId'));
  if (!id.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {error} = await supabase.rpc('set_expertise_availability', {
    p_expertise_id: id.data,
    p_is_available: formData.get('available') === 'true',
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/me/expertise', 'page');
  return {ok: 'SAVED'};
}
