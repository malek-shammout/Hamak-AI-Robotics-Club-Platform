import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {LanguageToggle} from './language-toggle';
import {ThemeToggle} from './theme-toggle';
import {BinaryBar} from './binary-bar';
import {SignOutButton} from './auth/sign-out-button';
import {MobileNavigation} from './mobile-navigation';
import {getSessionUser} from '@/lib/auth/session';
import {localised} from '@/lib/utils';
import type {Locale} from '@/i18n/routing';

export async function SiteHeader({locale}: {locale: Locale}) {
  const t = await getTranslations('nav');
  const tAuth = await getTranslations('auth');
  const tApp = await getTranslations('applications');
  const tEnrollment = await getTranslations('lms');
  const tCertificates = await getTranslations('myCerts');
  const tConsultations = await getTranslations('consultations');
  const tStaff = await getTranslations('staffHub');

  const user = await getSessionUser();

  const links = [
    {href: '/courses', label: t('courses')},
    {href: '/projects', label: t('projects')},
    {href: '/consultations', label: t('consultations')},
    {href: '/events', label: t('events')},
    {href: '/news', label: t('news')},
  ] as const;
  const signedInLinks = [
    {href: '/me/applications', label: tApp('title')},
    {href: '/me/enrollments', label: tEnrollment('myEnrollments')},
    {href: '/me/certificates', label: tCertificates('title')},
    {href: '/me/consultations', label: tConsultations('myTitle')},
    {href: '/staff', label: tStaff('title')},
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-[--border] bg-[--surface]/85 backdrop-blur">
      <div className="mx-auto flex h-16 min-w-0 max-w-6xl items-center gap-3 px-4 sm:gap-6">
        <Link href="/" className="font-accent text-lg tracking-widest text-hmk-red">
          HMK
        </Link>
        <MobileNavigation
          links={[...links]}
          signedInLinks={[...signedInLinks]}
          userName={
            user
              ? localised(
                  {full_name_ar: user.fullNameAr, full_name_en: user.fullNameEn},
                  'full_name',
                  locale
                )
              : undefined
          }
          signInLabel={tAuth('signIn')}
          signOutLabel={tAuth('signOut')}
          menuLabel={t('menu')}
          closeLabel={t('closeMenu')}
          navigationLabel={t('mobileNavigation')}
        />

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

        <div className="ms-auto flex min-w-0 items-center gap-2">
          {user ? (
            <>
              <Link
                href="/me/applications"
                className="hidden text-sm text-[--foreground-muted] hover:text-hmk-red sm:inline"
              >
                {tApp('title')}
              </Link>
              {/* The staff hub filters itself by permission and shows a plain message to
                  someone with none, so linking it for every signed-in user leaks nothing
                  and saves staff from having to remember URLs. */}
              <Link
                href="/staff"
                className="hidden text-sm text-[--foreground-muted] hover:text-hmk-red sm:inline"
              >
                {tStaff('title')}
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
