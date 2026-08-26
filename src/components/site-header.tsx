import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {LanguageToggle} from './language-toggle';
import {ThemeToggle} from './theme-toggle';
import {BinaryBar} from './binary-bar';
import {SignOutButton} from './auth/sign-out-button';
import {getSessionUser} from '@/lib/auth/session';
import {localised} from '@/lib/utils';
import type {Locale} from '@/i18n/routing';

export async function SiteHeader({locale}: {locale: Locale}) {
  const t = await getTranslations('nav');
  const tAuth = await getTranslations('auth');
  const tApp = await getTranslations('applications');

  const user = await getSessionUser();

  const links = [
    {href: '/courses', label: t('courses')},
    {href: '/projects', label: t('projects')},
    {href: '/events', label: t('events')},
    {href: '/news', label: t('news')},
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-[--border] bg-[--surface]/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="font-accent text-lg tracking-widest text-hmk-red">
          HMK
        </Link>

        {/* Logical properties only - `ms-auto` mirrors correctly in RTL. claude.md 7 */}
        <nav aria-label={t('home')} className="hidden gap-5 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-[--foreground-muted] transition-colors hover:text-hmk-red"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/me/applications"
                className="hidden text-sm text-[--foreground-muted] hover:text-hmk-red sm:inline"
              >
                {tApp('title')}
              </Link>
              <span className="hidden text-sm font-medium sm:inline">
                {localised(
                  {full_name_ar: user.fullNameAr, full_name_en: user.fullNameEn},
                  'full_name',
                  locale
                )}
              </span>
              <SignOutButton label={tAuth('signOut')} />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-[--radius-control] border border-[--border] px-3 py-1.5 text-sm
                         font-medium transition-colors hover:border-hmk-red hover:text-hmk-red"
            >
              {tAuth('signIn')}
            </Link>
          )}
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
      <BinaryBar />
    </header>
  );
}
