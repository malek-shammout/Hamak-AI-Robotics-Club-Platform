import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect} from '@/i18n/navigation';
import {Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {AuthForm, Field} from '@/components/auth/auth-form';
import {signIn} from '@/lib/auth/actions';
import {getSessionUser} from '@/lib/auth/session';
import type {Locale} from '@/i18n/routing';

export default async function LoginPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);

  // Already signed in - no reason to show a login form.
  if (await getSessionUser()) {
    redirect({href: '/me/applications', locale: locale as Locale});
  }

  const t = await getTranslations('auth');

  return (
    <>
      <PageHeading title={t('signIn')} />
      <AuthForm action={signIn} submitLabel={t('signIn')}>
        <Field name="email" label={t('email')} type="email" autoComplete="email" />
        <Field
          name="password"
          label={t('password')}
          type="password"
          autoComplete="current-password"
        />
      </AuthForm>

      <p className="mt-4 text-sm text-[--foreground-muted]">
        {t('noAccount')}{' '}
        <Link href="/register" className="font-medium text-hmk-red hover:underline">
          {t('signUp')}
        </Link>
      </p>
    </>
  );
}
