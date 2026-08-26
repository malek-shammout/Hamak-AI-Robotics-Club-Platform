import {formatInTimeZone} from 'date-fns-tz';
import {ar, enUS} from 'date-fns/locale';
import type {Locale as AppLocale} from '@/i18n/routing';

const TZ = process.env.NEXT_PUBLIC_DEFAULT_TZ ?? 'Asia/Damascus';

function dfLocale(locale: AppLocale) {
  return locale === 'ar' ? ar : enUS;
}

/**
 * claude.md 7 - dates render in the club's timezone with locale-appropriate month
 * names but WESTERN digits in both locales (engineering context). date-fns emits
 * plain JS numbers, so the digits stay Western while `ar` localises the month name.
 */
export function formatDate(value: string | Date | null | undefined, locale: AppLocale) {
  if (!value) return '';
  return formatInTimeZone(new Date(value), TZ, 'd MMMM yyyy', {locale: dfLocale(locale)});
}

export function formatDateTime(value: string | Date | null | undefined, locale: AppLocale) {
  if (!value) return '';
  return formatInTimeZone(new Date(value), TZ, 'd MMMM yyyy - HH:mm', {
    locale: dfLocale(locale),
  });
}

/** Machine-readable value for <time dateTime="..."> - always ISO, never localised. */
export function isoDate(value: string | Date | null | undefined) {
  if (!value) return undefined;
  return new Date(value).toISOString();
}
