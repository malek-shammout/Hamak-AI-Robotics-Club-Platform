import 'server-only';

import {createClient} from '@/lib/supabase/server';

/**
 * D-18 separation of duties: A4 raises, A3 approves.
 *
 * The RLS `staff_read` policy on requisitions is gated on M5.READ, which A4 does not
 * hold — so a raiser could not see their own request. `getMyRequisitions` therefore
 * reads through a filter on requester_user_id, which the cross-module READ grant in
 * the seed allows. A3 uses `getPendingRequisitions`.
 */

export async function getMyRequisitions(userId: string) {
  const supabase = await createClient();
  const {data} = await supabase
    .from('requisitions')
    .select('id, requisition_no, purpose_type, status, required_by, created_at, reviewed_at, review_reason, projects(code, title_ar, title_en), events(code, title_ar, title_en), requisition_lines(id, quantity_requested, quantity_approved, asset_types(name, tracking_mode))')
    .eq('requester_user_id', userId)
    .order('created_at', {ascending: false});
  return data ?? [];
}

export async function getPendingRequisitions() {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('requisitions')
    .select('id, requisition_no, purpose_type, status, required_by, created_at, requester_user_id, users!requester_user_id(full_name_ar, full_name_en), projects(code, title_ar, title_en), events(code, title_ar, title_en), requisition_lines(id, quantity_requested, quantity_approved, asset_types(name, tracking_mode))')
    .order('created_at', {ascending: false});
  if (error) throw error;
  return data ?? [];
}

export async function getRequisition(id: string) {
  const supabase = await createClient();
  const {data} = await supabase
    .from('requisitions')
    .select('id, requisition_no, purpose_type, status, required_by, created_at, requester_user_id, reviewed_by, reviewed_at, review_reason, users!requester_user_id(full_name_ar, full_name_en), projects(code, title_ar, title_en), events(code, title_ar, title_en), cohorts(code), requisition_lines(id, quantity_requested, quantity_approved, asset_type_id, asset_types(name, manufacturer, model, tracking_mode, is_consumable))')
    .eq('id', id)
    .maybeSingle();
  if (!data) return null;

  // Availability is what makes an approval decision possible, so it is fetched with
  // the requisition rather than left for the approver to guess.
  const {data: availability} = await supabase.from('v_asset_availability').select('*');
  const availBy = new Map((availability ?? []).map((a) => [a.asset_type_id, a]));

  return {
    ...data,
    requisition_lines: (data.requisition_lines ?? []).map((l) => ({
      ...l,
      availability: availBy.get(l.asset_type_id) ?? null,
    })),
  };
}

/** Projects the caller may raise a requisition against (they must own the context). */
export async function getMyProjects(userId: string) {
  const supabase = await createClient();
  const {data} = await supabase
    .from('project_members')
    .select('project_id, projects(id, code, title_ar, title_en)')
    .eq('user_id', userId);
  return (data ?? []).map((r) => r.projects).filter(Boolean);
}

export async function getRequestableAssetTypes() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('asset_types')
    .select('id, name, manufacturer, model, tracking_mode, is_consumable')
    .order('name');
  return data ?? [];
}
