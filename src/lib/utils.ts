import {clsx, type ClassValue} from 'clsx';
import {twMerge} from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Picks the right bilingual column off a DB row. claude.md 7 - short display
 * fields carry `_ar`/`_en` pairs; this is the single accessor for them.
 */
export function localised<T extends Record<string, unknown>>(
  row: T,
  base: string,
  locale: 'ar' | 'en'
): string {
  const primary = row[`${base}_${locale}`];
  if (typeof primary === 'string' && primary.length > 0) return primary;
  const fallback = row[`${base}_${locale === 'ar' ? 'en' : 'ar'}`];
  return typeof fallback === 'string' ? fallback : '';
}
