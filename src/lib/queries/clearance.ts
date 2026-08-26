import 'server-only';

import {createClient} from '@/lib/supabase/server';

export type PreconditionSnapshot = {
  evaluated_at?: string;
  C1_NOT_COMPLETED?: {pass: boolean};
  C2_ITEMS_OUTSTANDING?: {pass: boolean; count: number};
  C3_INSPECTION_PENDING?: {pass: boolean; count: number};
  C4_LIABILITY_OPEN?: {pass: boolean; count: number};
  C5_INCIDENT_OPEN?: {pass: boolean; count: number};
  A1_OUTSTANDING_ELSEWHERE?: {advisory: boolean; blocking: boolean};
  approval_enabled?: boolean;
};

/** Enrollments that have reached the clearance stage. */
export async function getClearanceQueue() {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('clearance_records')
    .select('id, status, advisory_outstanding_elsewhere, precondition_snapshot, approved_at, updated_at, enrollments(id, status, users!student_user_id(full_name_ar, full_name_en), cohorts(code, courses(title_ar, title_en)))')
    .order('updated_at', {ascending: false});
  if (error) throw error;
  return data ?? [];
}

export async function getClearanceForEnrollment(enrollmentId: string) {
  const supabase = await createClient();

  const {data: record} = await supabase
    .from('clearance_records')
    .select('id, status, advisory_outstanding_elsewhere, precondition_snapshot, approved_at, is_override, override_justification, enrollments(id, status, users!student_user_id(full_name_ar, full_name_en), cohorts(code, courses(title_ar, title_en)))')
    .eq('enrollment_id', enrollmentId)
    .maybeSingle();
  if (!record) return null;

  const [{data: blockers}, {data: certificate}] = await Promise.all([
    supabase
      .from('clearance_blockers')
      .select('id, blocker_code, detail_ar, detail_en, raised_at, resolved_at')
      .eq('clearance_record_id', record.id)
      .order('raised_at', {ascending: false}),
    supabase
      .from('certificates')
      .select('id, serial_no, verification_code, issued_at, status, issued_under_override')
      .eq('enrollment_id', enrollmentId)
      .maybeSingle(),
  ]);

  return {record, blockers: blockers ?? [], certificate};
}

/**
 * A student's own clearance view.
 *
 * §B.2 is explicit that the A1 advisory is "not shown to student" — it is an A3/A7
 * signal about OTHER enrollments and revealing it here would leak one course's
 * business into another. The projection below deliberately omits it.
 */
export async function getMyClearances() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('clearance_records')
    .select('id, status, precondition_snapshot, approved_at, enrollments(id, cohorts(code, courses(title_ar, title_en)))')
    .order('updated_at', {ascending: false});

  // Query unconditionally: `.in(col, [])` is valid and returns nothing, whereas a
  // `{data: []}` fallback infers never[] and poisons the types downstream.
  const ids = (data ?? []).map((r) => r.id);
  const {data: blockers} = await supabase
    .from('clearance_blockers')
    .select('clearance_record_id, blocker_code, detail_ar, detail_en, resolved_at')
    .in('clearance_record_id', ids)
    .is('resolved_at', null);

  const byRecord = new Map<string, NonNullable<typeof blockers>>();
  for (const b of blockers ?? []) {
    const list = byRecord.get(b.clearance_record_id) ?? [];
    list.push(b);
    byRecord.set(b.clearance_record_id, list);
  }

  return (data ?? []).map((r) => ({...r, blockers: byRecord.get(r.id) ?? []}));
}

export async function getMyCertificates() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('certificates')
    .select('id, serial_no, verification_code, issued_at, status, issued_under_override, enrollments(cohorts(code, courses(title_ar, title_en, level)))')
    .order('issued_at', {ascending: false});
  return data ?? [];
}
