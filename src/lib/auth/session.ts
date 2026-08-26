import 'server-only';

import {createClient} from '@/lib/supabase/server';

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
