import createIntlMiddleware from 'next-intl/middleware';
import type {NextRequest} from 'next/server';
import {routing} from '@/i18n/routing';
import {updateSession} from '@/lib/supabase/session';

const handleI18n = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  // 1. next-intl resolves the locale and may rewrite/redirect.
  const response = handleI18n(request);

  // 2. Supabase session refresh writes its rotated cookies onto that SAME response,
  //    so the locale redirect and the auth cookies never fight over the response object.
  await updateSession(request, response);

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals, the API surface, and files with an extension.
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
