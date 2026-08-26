import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {QuestionForm} from '@/components/assessment/question-form';
import {getSessionUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import type {Locale} from '@/i18n/routing';

export default async function NewQuestionPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect({href: '/login', locale: l});
  // Authoring needs CREATE, not just READ.
  if (!(await hasPermission('M4.CREATE'))) redirect({href: '/staff/questions', locale: l});

  const t = await getTranslations('bank');

  return (
    <>
      <Link href="/staff/questions" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToBank')}
      </Link>
      <PageHeading title={t('createQuestion')} />
      <QuestionForm />
    </>
  );
}
