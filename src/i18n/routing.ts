import {defineRouting} from 'next-intl/routing';

/**
 * claude.md 7 - locales are `ar` (default, RTL) and `en` (LTR).
 * `always` prefixing keeps the locale explicit in every URL, which makes the
 * one-click toggle a pure pathname rewrite with no hidden state.
 */
export const routing = defineRouting({
  locales: ['ar', 'en'],
  defaultLocale: 'ar',
  localePrefix: 'always',
  localeCookie: {
    name: 'HMK_LOCALE',
    maxAge: 60 * 60 * 24 * 365,
  },
});

export type Locale = (typeof routing.locales)[number];

/** RTL/LTR direction for a locale. The single source of truth - never inline this check. */
export function dirOf(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
