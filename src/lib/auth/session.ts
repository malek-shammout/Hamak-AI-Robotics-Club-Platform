import 'server-only';

import {createClient} from '@/lib/supabase/server';
import {redirect} from '@/i18n/navigation';
import type {Locale} from '@/i18n/routing';

export type SessionUser = {
  id: string;
  email: string;
  fullNameAr: string;
  fullNameEn: string;
  userType: 'EXTERNAL_STUDENT' | 'MEMBER';
};

/**
 * The single way server code asks "who is calling?".
 *
 * Uses getUser(), which revalidates the JWT against the auth server. getSession()
 * only decodes the cookie and would trust a forged one - never swap this.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) return null;

  const {data: profile} = await supabase
    .from('users')
    .select('id, email, full_name_ar, full_name_en, user_type')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    fullNameAr: profile.full_name_ar,
    fullNameEn: profile.full_name_en,
    userType: profile.user_type,
  };
}

/**
 * Returns the caller or redirects to sign-in.
 *
 * next-intl's `redirect()` is not typed as returning `never`, so TypeScript cannot
 * narrow `user` after a bare `if (!user) redirect(...)`. This helper carries the
 * narrowing in its return type, so pages get a non-null SessionUser without
 * scattering non-null assertions that would silence a real bug later.
 */
export async function requireUser(locale: Locale): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect({href: '/login', locale});
  return user as SessionUser;
}
