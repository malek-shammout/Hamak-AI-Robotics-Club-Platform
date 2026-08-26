import {redirect} from 'next/navigation';
import {routing} from '@/i18n/routing';

/**
 * A request that matched no locale segment at all. Send it to the default locale
 * rather than rendering an unlocalised shell.
 */
export default function RootNotFound() {
  redirect(`/${routing.defaultLocale}`);
}
