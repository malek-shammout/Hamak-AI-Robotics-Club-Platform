'use server';

import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';

export type RequisitionState = {error?: string; ok?: string} | undefined;

const KNOWN = [
  'AUTH_REQUIRED', 'FORBIDDEN', 'NO_LINES', 'INVALID_QUANTITY', 'ASSET_TYPE_NOT_FOUND',
  'PROJECT_REQUIRED', 'EVENT_REQUIRED', 'COHORT_REQUIRED', 'NOT_CONTEXT_OWNER',
  'REQUISITION_NOT_FOUND', 'REQUISITION_NOT_PENDING', 'SEPARATION_OF_DUTIES',
  'NO_STOCK_RECORD', 'INSUFFICIENT_STOCK', 'REJECTION_REASON_REQUIRED',
];
const toKey = (m?: string) => KNOWN.find((k) => m?.includes(k)) ?? 'UNEXPECTED';

const uuid = z.string().uuid();

/** A4 raises. Owning the context is the requirement — no M5 permission is needed. */
export async function raiseRequisition(
  _prev: RequisitionState,
  formData: FormData
): Promise<RequisitionState> {
  const projectId = uuid.safeParse(formData.get('projectId'));
  const requiredBy = z.string().min(1).safeParse(formData.get('requiredBy'));
  if (!projectId.success || !requiredBy.success) return {error: 'INVALID_INPUT'};

  const lines: {asset_type_id: string; quantity: number}[] = [];
  for (const raw of formData.getAll('line')) {
    const [typeId, qtyRaw] = String(raw).split(':');
    const qty = Number(qtyRaw);
    if (uuid.safeParse(typeId).success && Number.isFinite(qty) && qty > 0) {
      lines.push({asset_type_id: typeId!, quantity: qty});
    }
  }
  if (lines.length === 0) return {error: 'NO_LINES'};

  const supabase = await createClient();
  const {error} = await supabase.rpc('raise_requisition', {
    p_purpose_type: 'PROJECT',
    p_required_by: requiredBy.data,
    p_lines: lines,
    p_project_id: projectId.data,
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/requisitions', 'page');
  return {ok: 'RAISED'};
}

/**
 * A3 approves. The database refuses if the approver is the requester — D-18 is asserted
 * on IDENTITY, not role, so an admin cannot approve their own request either.
 */
export async function approveRequisition(
  _prev: RequisitionState,
  formData: FormData
): Promise<RequisitionState> {
  const id = uuid.safeParse(formData.get('requisitionId'));
  if (!id.success) return {error: 'INVALID_INPUT'};

  // A cut-back approval is expressed per line; omitting all of them approves in full.
  const approvals: {line_id: string; quantity_approved: number}[] = [];
  for (const raw of formData.getAll('approval')) {
    const [lineId, qtyRaw] = String(raw).split(':');
    const qty = Number(qtyRaw);
    if (uuid.safeParse(lineId).success && Number.isFinite(qty) && qty >= 0) {
      approvals.push({line_id: lineId!, quantity_approved: qty});
    }
  }

  const note = String(formData.get('note') ?? '').trim();

  const supabase = await createClient();
  const {error} = await supabase.rpc('approve_requisition', {
    p_requisition_id: id.data,
    p_line_approvals: approvals.length > 0 ? approvals : undefined,
    p_note: note || undefined,
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/requisitions/[id]', 'page');
  return {ok: 'APPROVED'};
}

export async function rejectRequisition(
  _prev: RequisitionState,
  formData: FormData
): Promise<RequisitionState> {
  const id = uuid.safeParse(formData.get('requisitionId'));
  const reason = String(formData.get('reason') ?? '').trim();
  if (!id.success) return {error: 'INVALID_INPUT'};
  if (!reason) return {error: 'REJECTION_REASON_REQUIRED'};

  const supabase = await createClient();
  const {error} = await supabase.rpc('reject_requisition', {
    p_requisition_id: id.data,
    p_reason: reason,
  });
  if (error) return {error: toKey(error.message)};

  revalidatePath('/[locale]/staff/requisitions/[id]', 'page');
  return {ok: 'REJECTED'};
}
