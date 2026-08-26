import 'server-only';

import {createClient} from '@/lib/supabase/server';

/**
 * Asks the database whether the CALLER holds a permission (migration 0012).
 *
 * For conditional rendering and route guards only. It is deliberately not the
 * enforcement point: run_seat_allocation re-checks the same permission itself, and
 * RLS governs every table read. Hiding a button is courtesy; the database is the
 * boundary. Never let this be the only thing standing between a user and an action.
 */
export async function hasPermission(code: string): Promise<boolean> {
  const supabase = await createClient();
  const {data, error} = await supabase.rpc('has_permission', {p_code: code});
  if (error) return false;
  return data === true;
}
