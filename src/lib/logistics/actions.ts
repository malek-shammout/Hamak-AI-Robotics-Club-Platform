'use server';

import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

export type LogisticsState = {error?: string; ok?: string} | undefined;

const KNOWN = [
  'AUTH_REQUIRED', 'FORBIDDEN', 'NO_LINES', 'DUE_DATE_IN_PAST',
  'ENROLLMENT_REQUIRED', 'NO_ACTIVE_ENROLLMENT', 'REQUISITION_REQUIRED',
  'REQUISITION_NOT_APPROVED', 'HOLDER_HAS_OPEN_LIABILITY', 'OVERRIDE_REQUIRES_ADMIN',
  'ASSET_TYPE_NOT_FOUND', 'ASSET_UNIT_NOT_FOUND', 'UNIT_NOT_AVAILABLE',
  'UNIT_ALREADY_CHECKED_OUT', 'INVALID_QUANTITY',
  'LINE_NOT_FOUND', 'LINE_NOT_OUTSTANDING', 'CONDITION_REQUIRED',
  'LIABILITY_NOT_FOUND', 'LIABILITY_ALREADY_TERMINAL', 'WAIVER_REQUIRES_ADMIN',
  'WAIVER_JUSTIFICATION_REQUIRED', 'REPLACEMENT_UNIT_REQUIRED',
];
const toKey = (m?: string) => KNOWN.find((k) => m?.includes(k)) ?? 'UNEXPECTED';

const uuid = z.string().uuid();

/**
 * BR-12 custody issue. Every rule — context, BR-13 liability block, BR-07 single active
 * custody — lives in issue_checkout (migration 0017). This only marshals the form.
 */
export async function issueCheckout(
  _prev: LogisticsState,
  formData: FormData
): Promise<LogisticsState> {
  const enrollmentId = uuid.safeParse(formData.get('enrollmentId'));
  const holderId = uuid.safeParse(formData.get('holderUserId'));
  const dueAt = z.string().min(1).safeParse(formData.get('dueAt'));
  if (!enrollmentId.success || !holderId.success || !dueAt.success) {
    return {error: 'INVALID_INPUT'};
  }

  // Serialized units arrive as repeated checkboxes; bulk lines as type+quantity pairs.
  const lines: {asset_type_id: string; asset_unit_id?: string; quantity?: number}[] = [];

  for (const raw of formData.getAll('unit')) {
    const [typeId, unitId] = String(raw).split(':');
    if (uuid.safeParse(typeId).success && uuid.safeParse(unitId).success) {
      lines.push({asset_type_id: typeId!, asset_unit_id: unitId!});
    }
  }

  for (const raw of formData.getAll('bulk')) {
    const [typeId, qtyRaw] = String(raw).split(':');
    const qty = Number(qtyRaw);
    if (uuid.safeParse(typeId).success && Number.isFinite(qty) && qty > 0) {
      lines.push({asset_type_id: typeId!, quantity: qty});
    }
  }

  if (lines.length === 0) return {error: 'NO_LINES'};

  const override = String(formData.get('overrideJustification') ?? '').trim();

  const supabase = await createClient();
  const {error} = await supabase.rpc('issue_checkout', {
    p_custody_type: 'STUDENT',
    p_holder_user_id: holderId.data,
    p_enrollment_id: enrollmentId.data,
    p_due_at: new Date(dueAt.data).toISOString(),
    p_lines: lines,
    p_override_justification: override || undefined,
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/desk', 'page');
  return {ok: 'ISSUED'};
}

/**
 * BR-06 check-in. A condition is mandatory (CK_RETURN_INSPECTED) and a Damaged/Lost
 * return opens a liability automatically — the clerk cannot forget to raise one.
 */
export async function checkInLine(
  _prev: LogisticsState,
  formData: FormData
): Promise<LogisticsState> {
  const lineId = uuid.safeParse(formData.get('lineId'));
  const condition = z
    .enum(['HEALTHY', 'DAMAGED', 'LOST'])
    .safeParse(formData.get('condition'));
  if (!lineId.success || !condition.success) return {error: 'INVALID_INPUT'};

  const notes = String(formData.get('notes') ?? '').trim();
  const assessedRaw = String(formData.get('assessedValue') ?? '').trim();
  const assessed = assessedRaw ? Number(assessedRaw) : undefined;
  if (assessed !== undefined && (!Number.isFinite(assessed) || assessed < 0)) {
    return {error: 'INVALID_INPUT'};
  }

  const supabase = await createClient();
  const {error} = await supabase.rpc('check_in_line', {
    p_line_id: lineId.data,
    p_condition_at_return: condition.data,
    p_inspection_notes: notes || undefined,
    p_evidence_media_id: undefined,
    p_assessed_value: assessed,
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/checkouts/[id]', 'page');
  return {ok: 'CHECKED_IN'};
}

/**
 * BR-06 resolution. The A7-only waiver is asserted inside resolve_liability, not here —
 * a gap proven exploitable before migration 0017 and now covered by test 07.
 */
export async function resolveLiability(
  _prev: LogisticsState,
  formData: FormData
): Promise<LogisticsState> {
  const liabilityId = uuid.safeParse(formData.get('liabilityId'));
  const status = z
    .enum([
      'UNDER_ASSESSMENT',
      'PENDING_SETTLEMENT',
      'RESOLVED_REPAIRED',
      'RESOLVED_REPLACED',
      'RESOLVED_SETTLED',
      'RESOLVED_WAIVED',
    ])
    .safeParse(formData.get('status'));
  if (!liabilityId.success || !status.success) return {error: 'INVALID_INPUT'};

  const note = String(formData.get('note') ?? '').trim();
  const replacementRaw = String(formData.get('replacementUnitId') ?? '').trim();
  const replacement = replacementRaw ? uuid.safeParse(replacementRaw) : null;

  const supabase = await createClient();
  const {error} = await supabase.rpc('resolve_liability', {
    p_liability_id: liabilityId.data,
    p_status: status.data,
    p_note: note || undefined,
    p_replacement_asset_unit_id: replacement?.success ? replacement.data : undefined,
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/liabilities', 'page');
  return {ok: 'RESOLVED'};
}
