'use server';

import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {redirect} from '@/i18n/navigation';
import {createClient} from '@/lib/supabase/server';
import {routing, type Locale} from '@/i18n/routing';

/**
 * M10 identity. Supabase Auth owns credentials (D-10) - this module never sees a
 * password hash, only hands the plaintext straight to Supabase over the server channel.
 */

const emailSchema = z.string().trim().toLowerCase().email();

/**
 * MUST mirror the Supabase Auth password policy exactly:
 *   password_min_length          = 8
 *   password_required_characters = lowercase : uppercase : digits
 *
 * This is not the enforcement point — Supabase is. It exists so a user gets a
 * specific, actionable message instead of a raw API error. If the project policy
 * changes, change this in the same commit or the two will drift apart.
 */
const passwordSchema = z
  .string()
  .min(8, 'PASSWORD_TOO_SHORT')
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /[0-9]/.test(v), {
    message: 'PASSWORD_NEEDS_COMPLEXITY',
  });

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullNameAr: z.string().trim().min(2).max(160),
  fullNameEn: z.string().trim().min(2).max(160),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export type AuthState = {error?: string} | undefined;

function localeOf(value: FormDataEntryValue | null): Locale {
  const v = String(value ?? '');
  return (routing.locales as readonly string[]).includes(v)
    ? (v as Locale)
    : routing.defaultLocale;
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const locale = localeOf(formData.get('locale'));
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return {error: 'INVALID_INPUT'};

  const supabase = await createClient();
  const {error} = await supabase.auth.signInWithPassword(parsed.data);

  // Deliberately generic: distinguishing "no such account" from "wrong password"
  // turns the login form into an account-enumeration oracle.
  if (error) return {error: 'INVALID_CREDENTIALS'};

  revalidatePath('/', 'layout');
  redirect({href: '/me/applications', locale});
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const locale = localeOf(formData.get('locale'));
  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullNameAr: formData.get('fullNameAr'),
    fullNameEn: formData.get('fullNameEn'),
  });
  if (!parsed.success) {
    // Surface the password rule that actually failed; anything else is a generic
    // input error (the other fields are self-explanatory in the form).
    const passwordKeys = ['PASSWORD_TOO_SHORT', 'PASSWORD_NEEDS_COMPLEXITY'];
    const hit = parsed.error.issues.find((i) => passwordKeys.includes(i.message));
    return {error: hit?.message ?? 'INVALID_INPUT'};
  }

  const supabase = await createClient();
  const {error} = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Consumed by the auth.users -> public.users bridge trigger (migration 0002).
      data: {
        full_name_ar: parsed.data.fullNameAr,
        full_name_en: parsed.data.fullNameEn,
        user_type: 'EXTERNAL_STUDENT',
        locale,
      },
    },
  });

  if (error) {
    // Supabase returns this when leaked-password protection or strength rules reject it.
    if (error.message.toLowerCase().includes('password')) return {error: 'WEAK_PASSWORD'};
    return {error: 'SIGNUP_FAILED'};
  }

  redirect({href: '/register/check-email', locale});
}

export async function signOut(formData: FormData) {
  const locale = localeOf(formData.get('locale'));
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect({href: '/', locale});
}
