import {createBrowserClient} from '@supabase/ssr';
import type {Database} from './database.types';

/**
 * Browser-side Supabase client. Carries ONLY the publishable anon key, so every
 * query it makes is bound by RLS. claude.md 6 - the service-role key must never
 * reach this module or anything it imports.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
