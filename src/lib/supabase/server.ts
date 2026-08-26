import 'server-only';

import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import type {Database} from './database.types';

/**
 * RLS-bound server client. This is the default for every Server Component read.
 * `server-only` makes an accidental client import a build error rather than a leak.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({name, value, options}) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component: middleware already refreshes the
            // session, so this is safe to ignore.
          }
        },
      },
    }
  );
}

/**
 * Service-role client. BYPASSES RLS ENTIRELY.
 *
 * claude.md 6 - reserved for S1 scheduled jobs and the admin bootstrap. Do not
 * reach for this to "fix" a policy that is denying you; fix the policy instead.
 * Every call site must be justifiable in a code review.
 */
export function createServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. It is intentionally absent from .env.local - ' +
        'add it only in the environment that actually runs scheduled jobs.'
    );
  }
  return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    cookies: {getAll: () => [], setAll: () => {}},
  });
}
