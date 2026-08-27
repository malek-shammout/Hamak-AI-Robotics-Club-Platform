'use client';

import {useTransition} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useParams, useSearchParams} from 'next/navigation';
import {usePathname, useRouter} from '@/i18n/navigation';
import {useUiStore} from '@/stores/ui-store';
import {createClient} from '@/lib/supabase/client';
import type {Locale} from '@/i18n/routing';

/**
 * One-click AR <-> EN toggle (claude.md 7).
 *
 * Preserves the current route AND its query string - switching language must never
 * lose the page you were on. Persists the choice to:
 *   (a) `users.locale` when signed in (authoritative), and
 *   (b) the locale cookie + Zustand otherwise.
 */
export function LanguageToggle() {
  const t = useTranslations('actions');
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const params = useParams();
  // usePathname() returns the path WITHOUT the query string, so switching language
  // silently dropped it — a visitor who pasted a verification code into /verify?code=…
  // lost it on the toggle. claude.md §7 requires route AND query to survive.
  const searchParams = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const setPreferredLocale = useUiStore((s) => s.setPreferredLocale);

  const next: Locale = locale === 'ar' ? 'en' : 'ar';

  function switchLocale() {
    setPreferredLocale(next);

    // Genuinely fire-and-forget. This used to be AWAITED before navigating, despite the
    // comment claiming otherwise: two Supabase round-trips (getUser, then the update) sat
    // between the click and the visible language change, so a signed-in user on a slow
    // connection saw nothing happen for seconds. Caught by the E2E language-switch spec
    // exceeding its timeout.
    //
    // RLS `self_update_profile` restricts the write to the caller's own row, and the
    // cookie already carries the preference, so losing this write costs nothing.
    void (async () => {
      try {
        const supabase = createClient();
        const {data} = await supabase.auth.getUser();
        if (data.user) {
          await supabase.from('users').update({locale: next}).eq('id', data.user.id);
        }
      } catch {
        // Non-fatal - the cookie still carries the preference.
      }
    })();

    startTransition(() => {
      router.replace(
        // @ts-expect-error - pathname is a validated route at runtime
        {pathname, params, query: Object.fromEntries(searchParams.entries())},
        {locale: next}
      );
    });
  }

  return (
    <button
      type="button"
      onClick={switchLocale}
      disabled={pending}
      lang={next}
      aria-label={next === 'en' ? 'Switch to English' : 'التبديل إلى العربية'}
      className="rounded-[--radius-control] border border-[--border] px-3 py-1.5 text-sm
                 font-medium text-[--foreground] transition-colors
                 hover:border-hmk-red hover:text-hmk-red
                 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {t('switchToEnglish')}
    </button>
  );
}
