import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {Lock} from 'lucide-react';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {MetaPill} from '@/components/public/meta-pill';
import {NewVersionButton} from '@/components/assessment/new-version-button';
import {getSessionUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {listQuestions, getLiveQuestionIds} from '@/lib/queries/question-bank';
import type {Locale} from '@/i18n/routing';

export default async function QuestionBankPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect({href: '/login', locale: l});
  if (!(await hasPermission('M4.READ'))) redirect({href: '/', locale: l});

  const t = await getTranslations('bank');
  const [questions, liveIds, mayCreate] = await Promise.all([
    listQuestions(),
    getLiveQuestionIds(),
    hasPermission('M4.CREATE'),
  ]);

  return (
    <>
      <PageHeading title={t('title')} lead={t('lead')} />

      {mayCreate ? (
        <Link
          href="/staff/questions/new"
          className="mb-6 inline-block rounded-[--radius-control] bg-hmk-red px-5 py-2.5 text-sm
                     font-semibold text-white hover:bg-hmk-red-hover"
        >
          {t('createQuestion')}
        </Link>
      ) : null}

      {questions.length === 0 ? (
        <EmptyState message={t('empty')} />
      ) : (
        <ul className="space-y-3">
          {questions.map((q) => {
            const frozen = liveIds.has(q.id);
            const correct = (q.question_options ?? []).filter((o) => o.is_correct).length;
            return (
              <li key={q.id} className="hmk-card space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="max-w-2xl font-medium">{q.stem}</p>
                  <div className="flex flex-wrap gap-2">
                    <MetaPill tone="accent">{t(`types.${q.type}`)}</MetaPill>
                    <MetaPill>{t(`difficulties.${q.difficulty}`)}</MetaPill>
                    <MetaPill>{t('points', {points: q.max_score})}</MetaPill>
                    <MetaPill>{t('version', {v: q.version})}</MetaPill>
                  </div>
                </div>

                <p className="text-xs text-[--foreground-muted]">
                  {q.auto_gradable
                    ? t('autoGradedWith', {options: (q.question_options ?? []).length, correct})
                    : t('manuallyGraded')}
                </p>

                {/* Migration 0015: a question used by an ACTIVE/LOCKED test is frozen.
                    Say why, and offer the sanctioned route rather than a dead end. */}
                {frozen ? (
                  <div className="flex flex-wrap items-center gap-3 border-s-2 border-hmk-red
                                  bg-hmk-red-subtle px-4 py-2">
                    <Lock className="h-3.5 w-3.5 shrink-0 text-hmk-red" aria-hidden="true" />
                    <span className="text-xs">{t('frozen')}</span>
                    {mayCreate ? <NewVersionButton questionId={q.id} /> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
