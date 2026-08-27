import 'server-only';

import {createClient} from '@/lib/supabase/server';

/**
 * M2 reads.
 *
 * Every query here runs through the RLS-bound client, so the policies are the access
 * control and these functions are only shaping. That matters most for the thread:
 * `getConsultation` does not filter by participant, because
 * `app.is_consultation_participant()` already does — adding a redundant filter here
 * would hide a policy regression rather than surface it.
 */

const REQUEST_FIELDS = `id, reference_no, title, abstract, status, priority, complexity,
  support_type, supervisor_name, project_deadline_on, sla_due_at, sla_breached,
  outcome_category, outcome_summary, created_at, closed_at, requester_user_id`;

export async function getMyConsultations() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('consultation_requests')
    .select(
      `${REQUEST_FIELDS}, consultation_request_domains(expertise_domains(code, name_ar, name_en))`
    )
    .order('created_at', {ascending: false});
  return data ?? [];
}

export async function getConsultation(id: string) {
  const supabase = await createClient();
  const {data} = await supabase
    .from('consultation_requests')
    .select(
      `${REQUEST_FIELDS},
       users!requester_user_id(full_name_ar, full_name_en),
       consultation_request_domains(expertise_domains(id, code, name_ar, name_en)),
       consultation_assignments(id, state, response_due_at, decline_reason, assigned_at,
                                expert_user_id, users!expert_user_id(full_name_ar, full_name_en))`
    )
    .eq('id', id)
    .maybeSingle();
  return data;
}

/**
 * The thread, with sender names attached.
 *
 * The names deliberately do NOT come from a join. `users.self_read_profile` scopes reads
 * to the caller's own row, so a join returns NULL for the counterpart and every message
 * from the other side renders unattributed — proven against the live database before
 * this was written. `get_consultation_participants` (migration 0024) hands back names
 * only, for participants only.
 */
export async function getThread(requestId: string) {
  const supabase = await createClient();

  const [{data: messages}, nameOf] = await Promise.all([
    supabase
      .from('consultation_messages')
      .select('id, body, sent_at, sender_user_id')
      .eq('consultation_request_id', requestId)
      .order('sent_at', {ascending: true}),
    getParticipantNames(requestId),
  ]);

  return (messages ?? []).map((m) => ({...m, sender: nameOf.get(m.sender_user_id) ?? null}));
}

/** Display names for one thread, keyed by user id. Empty for a non-participant. */
export async function getParticipantNames(requestId: string) {
  const supabase = await createClient();
  const {data} = await supabase.rpc('get_consultation_participants', {
    p_request_id: requestId,
  });
  return new Map(
    (data ?? []).map((p) => [
      p.user_id,
      {full_name_ar: p.full_name_ar, full_name_en: p.full_name_en},
    ])
  );
}

/** A4's triage queue. `staff_read` gates this on M2.READ, so an unprivileged caller
 *  gets an empty list rather than an error — the page treats that as "nothing to do". */
export async function getTriageQueue() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('consultation_requests')
    .select(
      `${REQUEST_FIELDS},
       users!requester_user_id(full_name_ar, full_name_en),
       consultation_request_domains(expertise_domains(code, name_ar, name_en)),
       consultation_assignments(id, state, users!expert_user_id(full_name_ar, full_name_en))`
    )
    .order('sla_due_at', {ascending: true, nullsFirst: false});
  return data ?? [];
}

/** AD-7 ranking: domain overlap, then evidence, then lowest current load. */
export async function getSuggestedExperts(requestId: string) {
  const supabase = await createClient();
  const {data} = await supabase.rpc('suggest_experts', {p_request_id: requestId});
  return data ?? [];
}

/** The member's own assignment queue — visible via `self_read_own_assignments`. */
export async function getMyAssignments() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('consultation_assignments')
    // One literal, not a `+` concatenation: TypeScript widens concatenated strings to
    // `string`, which loses the row shape PostgREST infers from the select.
    .select(
      `id, state, response_due_at, assigned_at, consultation_request_id,
       consultation_requests(id, reference_no, title, status, priority, support_type)`
    )
    .order('assigned_at', {ascending: false});
  return data ?? [];
}

/** D-06: the member sees their curated expertise and may toggle only availability. */
export async function getMyExpertise() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('member_expertise')
    .select(
      `id, proficiency, is_available, max_concurrent_load,
       expertise_domains(code, name_ar, name_en)`
    );
  return data ?? [];
}

export async function getExpertiseDomains() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('expertise_domains')
    .select('id, code, name_ar, name_en')
    .eq('is_active', true)
    .order('code');
  return data ?? [];
}

/** Every domain, retired ones included — A4 curates the whole catalogue. */
export async function getAllExpertiseDomains() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('expertise_domains')
    .select('id, code, name_ar, name_en, is_active')
    .order('code');
  return data ?? [];
}

/**
 * Every curated expertise entry, for the A4 curation screen.
 *
 * The member join works here and not in the thread because `users.self_read_profile`
 * also admits M10.READ, which the PROJECTS role holds. A caller without it gets an
 * empty list rather than rows with blank names.
 */
export async function getAllMemberExpertise() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('member_expertise')
    .select(
      `id, proficiency, is_available, max_concurrent_load, member_user_id,
       users!member_user_id(full_name_ar, full_name_en),
       expertise_domains(code, name_ar, name_en)`
    );
  return data ?? [];
}

/** Club members who can be given expertise. Requires M10.READ. */
export async function getCurationCandidates() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('users')
    .select('id, full_name_ar, full_name_en')
    .eq('user_type', 'MEMBER')
    .eq('status', 'ACTIVE')
    .order('full_name_en');
  return data ?? [];
}
