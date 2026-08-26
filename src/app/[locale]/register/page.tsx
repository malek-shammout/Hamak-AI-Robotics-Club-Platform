import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {AuthForm, Field} from '@/components/auth/auth-form';
import {signUp} from '@/lib/auth/actions';
import {getSessionUser} from '@/lib/auth/session';
import type {Locale} from '@/i18n/routing';

export default async function RegisterPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);

  if (await getSessionUser()) {
    redirect({href: '/me/applications', locale: locale as Locale});
  }

  const t = await getTranslations('auth');

  return (
    <>
      <PageHeading title={t('signUp')} />
      <AuthForm action={signUp} submitLabel={t('signUp')}>
        {/* Bilingual by construction: claude.md 5 - a member record without both
            name forms cannot render correctly on the other locale's pages. */}
        <Field name="fullNameAr" label={t('fullNameAr')} autoComplete="name" dir="rtl" />
        <Field name="fullNameEn" label={t('fullNameEn')} autoComplete="name" dir="ltr" />
        <Field name="email" label={t('email')} type="email" autoComplete="email" />
        <Field
          name="password"
          label={t('password')}
          type="password"
          autoComplete="new-password"
          hint={t('passwordHint')}
        />
      </AuthForm>

      <p className="mt-4 text-sm text-[--foreground-muted]">
        {t('haveAccount')}{' '}
        <Link href="/login" className="font-medium text-hmk-red hover:underline">
          {t('signIn')}
        </Link>
      </p>
    </>
  );
}
