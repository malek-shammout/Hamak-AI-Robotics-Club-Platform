import {createNavigation} from 'next-intl/navigation';
import {routing} from './routing';

/**
 * Locale-aware navigation primitives. Always import Link/useRouter from HERE,
 * never from `next/link` or `next/navigation` - those drop the locale segment.
 */
export const {Link, redirect, usePathname, useRouter, getPathname} =
  createNavigation(routing);
