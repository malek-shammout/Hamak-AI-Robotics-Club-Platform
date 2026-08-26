'use client';

import {useTransition} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useParams} from 'next/navigation';
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const setPreferredLocale = useUiStore((s) => s.setPreferredLocale);

  const next: Locale = locale === 'ar' ? 'en' : 'ar';

  function switchLocale() {
    setPreferredLocale(next);

    startTransition(async () => {
      // Fire-and-forget: a failed profile write must not block the UI switch.
      // RLS `self_update_profile` restricts this to the caller's own row.
      try {
        const supabase = createClient();
        const {data} = await supabase.auth.getUser();
        if (data.user) {
          await supabase.from('users').update({locale: next}).eq('id', data.user.id);
        }
      } catch {
        // Non-fatal - the cookie still carries the preference.
      }

      router.replace(
        // @ts-expect-error - pathname is a validated route at runtime
        {pathname, params},
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
