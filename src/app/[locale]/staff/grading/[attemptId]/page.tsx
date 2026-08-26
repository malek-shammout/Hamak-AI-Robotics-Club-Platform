import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {MetaPill} from '@/components/public/meta-pill';
import {GradeAnswerForm} from '@/components/assessment/grade-answer-form';
import {FinalizeGradingButton} from '@/components/assessment/finalize-grading-button';
import {getSessionUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {getAttemptForGrading} from '@/lib/queries/question-bank';
import {localised} from '@/lib/utils';
import type {Locale} from '@/i18n/routing';

export default async function GradeAttemptPage({
  params,
}: {
  params: Promise<{locale: string; attemptId: string}>;
}) {
  const {locale, attemptId} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect({href: '/login', locale: l});
  if (!(await hasPermission('M4.READ'))) redirect({href: '/', locale: l});

  const t = await getTranslations('grading');
  const data = await getAttemptForGrading(attemptId);
  if (!data) notFound();

  const {attempt, answers} = data;
  const [mayGrade, mayFinalize] = await Promise.all([
    hasPermission('M4.UPDATE'),
    hasPermission('M4.APPROVE'),
  ]);

  const manual = answers.filter((a) => a.questions && !a.questions.auto_gradable);
  const auto = answers.filter((a) => a.questions?.auto_gradable);
  const ungraded = answers.filter((a) => a.awarded_score === null).length;

  return (
    <article>
      <Link href="/staff/grading" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToQueue')}
      </Link>

      <PageHeading
        title={
          attempt.applications?.users
            ? localised(attempt.applications.users, 'full_name', l)
            : t('unknownApplicant')
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <MetaPill tone="accent">{attempt.screening_tests?.title}</MetaPill>
        <MetaPill>{attempt.applications?.cohorts?.code}</MetaPill>
        <MetaPill>{t('state', {state: attempt.state})}</MetaPill>
        {attempt.screening_tests?.max_score ? (
          <MetaPill>{t('outOf', {max: attempt.screening_tests.max_score})}</MetaPill>
        ) : null}
      </div>

      {/* Auto-graded items are shown read-only. They are already scored; surfacing them
          gives the grader the full picture without inviting edits to settled answers. */}
      {auto.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">{t('autoGradedSection')}</h2>
          <ul className="space-y-2">
            {auto.map((a) => (
              <li key={a.id} className="hmk-card flex items-start justify-between gap-4 p-4">
                <p className="text-sm">{a.questions?.stem}</p>
                <span className="font-accent shrink-0 text-sm">
                  {a.awarded_score ?? 0} / {a.weight}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('manualSection')}</h2>
        {manual.length === 0 ? (
          <p className="text-[--foreground-muted]">{t('nothingToGrade')}</p>
        ) : (
          <ul className="space-y-4">
            {manual.map((a) => {
              const payload = a.answer_payload as {text?: string} | null;
              return (
                <li key={a.id} className="hmk-card space-y-3 p-5">
                  <p className="font-medium">{a.questions?.stem}</p>

                  {a.questions?.grading_rubric ? (
                    <p className="border-s-2 border-[--border] px-3 py-1 text-xs text-[--foreground-muted]">
                      <span className="font-semibold">{t('rubric')}: </span>
                      {a.questions.grading_rubric}
                    </p>
                  ) : null}

                  <div className="rounded-[--radius-card] bg-[--background] p-3">
                    <p className="text-xs text-[--foreground-muted]">{t('answer')}</p>
                    <p className="mt-1 whitespace-pre-line text-sm">
                      {payload?.text ?? t('noAnswer')}
                    </p>
                  </div>

                  {mayGrade ? (
                    <GradeAnswerForm
                      answerId={a.id}
                      weight={Number(a.weight)}
                      currentScore={a.awarded_score === null ? null : Number(a.awarded_score)}
                      isOverride={Boolean(a.is_override)}
                      originalScore={a.original_score === null ? null : Number(a.original_score)}
                    />
                  ) : (
                    <p className="text-xs text-[--foreground-muted]">{t('noGradePermission')}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {mayFinalize && attempt.state === 'GRADING' ? (
        <div className="mt-8 hmk-card p-5">
          <h2 className="mb-2 text-sm font-semibold">{t('finalizeTitle')}</h2>
          {ungraded > 0 ? (
            <p className="text-sm text-[--foreground-muted]">{t('ungradedRemain', {n: ungraded})}</p>
          ) : (
            <FinalizeGradingButton attemptId={attempt.id} />
          )}
        </div>
      ) : null}
    </article>
  );
}
