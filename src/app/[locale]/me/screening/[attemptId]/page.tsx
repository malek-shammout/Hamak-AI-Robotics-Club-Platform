import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {MetaPill} from '@/components/public/meta-pill';
import {AttemptCountdown} from '@/components/assessment/attempt-countdown';
import {QuestionCard} from '@/components/assessment/question-card';
import {SubmitAttempt} from '@/components/assessment/submit-attempt';
import {getSessionUser} from '@/lib/auth/session';
import {getAttemptPaper, getMyAttempt} from '@/lib/queries/assessment';
import type {Locale} from '@/i18n/routing';

export default async function ScreeningAttemptPage({
  params,
}: {
  params: Promise<{locale: string; attemptId: string}>;
}) {
  const {locale, attemptId} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect({href: '/login', locale: l});

  const t = await getTranslations('screening');

  const attempt = await getMyAttempt(attemptId);
  if (!attempt) notFound();          // RLS already scopes this to the caller

  // A finished attempt is never re-served as a paper.
  if (attempt.state !== 'IN_PROGRESS') {
    const visible =
      attempt.screening_tests?.result_visibility !== 'HIDDEN' &&
      attempt.normalized_score !== null;

    return (
      <>
        <PageHeading title={t('title')} />
        <div className="hmk-card max-w-lg space-y-3 p-6">
          <MetaPill tone="accent">{t(`state.${attempt.state}`)}</MetaPill>
          <p className="text-[--foreground-muted]">{t('alreadySubmitted')}</p>
          {visible ? (
            <p className="font-accent text-3xl">{attempt.normalized_score}%</p>
          ) : (
            <p className="text-sm text-[--foreground-muted]">{t('resultHidden')}</p>
          )}
          <Link href="/me/applications" className="inline-block text-sm text-hmk-red hover:underline">
            {t('backToApplications')}
          </Link>
        </div>
      </>
    );
  }

  const {questions, error} = await getAttemptPaper(attemptId);
  if (error || !questions) {
    return (
      <>
        <PageHeading title={t('title')} />
        <p className="hmk-card p-6 text-[--foreground-muted]">{t('paperUnavailable')}</p>
      </>
    );
  }

  return (
    <>
      <PageHeading title={attempt.screening_tests?.title ?? t('title')} />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <AttemptCountdown deadlineIso={attempt.deadline_at} />
        <MetaPill>{t('questionCount', {count: questions.length})}</MetaPill>
        {attempt.screening_tests?.max_score ? (
          <MetaPill>{t('totalPoints', {points: attempt.screening_tests.max_score})}</MetaPill>
        ) : null}
      </div>

      <p className="mb-6 max-w-2xl border-s-2 border-hmk-red bg-hmk-red-subtle px-4 py-2 text-sm">
        {t('saveEachAnswer')}
      </p>

      <ol className="space-y-4">
        {questions.map((q, i) => (
          <QuestionCard key={q.question_id} attemptId={attemptId} question={q} index={i} />
        ))}
      </ol>

      <div className="mt-8">
        <SubmitAttempt attemptId={attemptId} />
      </div>
    </>
  );
}
