import {createServerClient} from '@supabase/ssr';
import type {NextRequest, NextResponse} from 'next/server';

/**
 * Refreshes the Supabase auth session and writes rotated cookies onto `response`.
 * Called from src/proxy.ts. Must run on every request or server-side reads will intermittently see an
 * expired JWT and silently fall back to anon policies.
 */
export async function updateSession(request: NextRequest, response: NextResponse) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({name, value, options}) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() revalidates against the auth server. Do NOT swap this for
  // getSession(), which trusts the cookie without verifying it.
  const {
    data: {user},
  } = await supabase.auth.getUser();

  return user;
}
