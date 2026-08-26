import 'server-only';

import {createClient} from '@/lib/supabase/server';

/**
 * A3 (Logistics) reads. Bounded by the `staff_read` policies (M5.READ).
 *
 * Note what is NOT here: any write. `checkouts`, `checkout_lines` and
 * `liability_records` are RPC-write-only since migration 0017 — a direct write would
 * skip BR-06/07/12/13 entirely. See claude.md D-13.
 */

export async function getAssetCatalogue() {
  const supabase = await createClient();
  const [{data: types, error}, {data: availability}] = await Promise.all([
    supabase
      .from('asset_types')
      .select('id, name, manufacturer, model, tracking_mode, is_consumable, unit_cost, currency, low_stock_threshold, asset_categories(code, name_ar, name_en)')
      .order('name'),
    supabase.from('v_asset_availability').select('*'),
  ]);
  if (error) throw error;

  const availBy = new Map((availability ?? []).map((a) => [a.asset_type_id, a]));
  return (types ?? []).map((t) => ({...t, availability: availBy.get(t.id) ?? null}));
}

/** Serialized units that can actually be issued right now. */
export async function getAvailableUnits() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('asset_units')
    .select('id, asset_tag, condition, status, asset_type_id, asset_types(name, manufacturer, model, tracking_mode)')
    .eq('status', 'AVAILABLE')
    .order('asset_tag');
  return data ?? [];
}

/** Bulk-tracked types, offered by quantity rather than by unit. */
export async function getBulkTypes() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('asset_types')
    .select('id, name, manufacturer, model, is_consumable')
    .eq('tracking_mode', 'BULK')
    .order('name');
  return data ?? [];
}

/**
 * Candidate holders for STUDENT custody: enrollments that BR-12 would accept.
 * Each carries whether BR-13 currently blocks them, so the desk can warn BEFORE
 * the clerk fills in a form the database will reject.
 */
export async function getEligibleHolders() {
  const supabase = await createClient();
  const [{data: enrollments}, {data: liable}] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id, status, student_user_id, users!student_user_id(full_name_ar, full_name_en), cohorts(code, courses(title_ar, title_en))')
      .in('status', ['ACTIVE', 'COMPLETED', 'COMPLETED_BY_OVERRIDE'])
      .order('enrolled_at', {ascending: false}),
    supabase.from('v_holder_open_liabilities').select('holder_user_id, open_liability_count'),
  ]);

  const blocked = new Map((liable ?? []).map((l) => [l.holder_user_id, l.open_liability_count]));
  return (enrollments ?? []).map((e) => ({
    ...e,
    openLiabilities: blocked.get(e.student_user_id) ?? 0,
  }));
}

/** Outstanding custody — the return desk's working list. */
export async function getOutstandingCheckouts() {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('checkouts')
    .select('id, checkout_no, custody_type, issued_at, due_at, status, issued_under_override, users!holder_user_id(full_name_ar, full_name_en), checkout_lines(id, quantity, status, asset_units(asset_tag), asset_types(name, tracking_mode, is_consumable))')
    .in('status', ['ACTIVE', 'PARTIALLY_RETURNED'])
    .order('due_at');
  if (error) throw error;
  return data ?? [];
}

export async function getCheckout(id: string) {
  const supabase = await createClient();
  const {data} = await supabase
    .from('checkouts')
    .select('id, checkout_no, custody_type, issued_at, due_at, status, issued_under_override, override_justification, users!holder_user_id(full_name_ar, full_name_en), checkout_lines(id, quantity, status, condition_at_issue, condition_at_return, inspection_notes, returned_at, asset_units(asset_tag), asset_types(name, manufacturer, model, tracking_mode, is_consumable, unit_cost, currency))')
    .eq('id', id)
    .maybeSingle();
  return data;
}

/** Liability queue. Non-terminal first — those are the ones blocking people. */
export async function getLiabilities() {
  const supabase = await createClient();
  const {data, error} = await supabase
    .from('liability_records')
    .select('id, liability_type, assessed_value, currency, status, resolution_note, waiver_justification, created_at, resolved_at, users!holder_user_id(full_name_ar, full_name_en), checkout_lines(asset_units(asset_tag), asset_types(name))')
    .order('created_at', {ascending: false});
  if (error) throw error;

  const OPEN = ['OPEN', 'UNDER_ASSESSMENT', 'PENDING_SETTLEMENT'];
  return (data ?? []).sort((a, b) => {
    const ao = OPEN.includes(a.status) ? 0 : 1;
    const bo = OPEN.includes(b.status) ? 0 : 1;
    return ao - bo;
  });
}
