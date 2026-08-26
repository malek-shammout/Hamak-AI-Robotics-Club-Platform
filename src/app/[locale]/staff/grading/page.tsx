import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {MetaPill} from '@/components/public/meta-pill';
import {getSessionUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {listAttemptsNeedingGrading} from '@/lib/queries/question-bank';
import {localised} from '@/lib/utils';
import {formatDateTime, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function GradingQueuePage({
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

  const t = await getTranslations('grading');
  const attempts = await listAttemptsNeedingGrading();

  return (
    <>
      <PageHeading title={t('queueTitle')} lead={t('queueLead')} />

      {attempts.length === 0 ? (
        <EmptyState message={t('queueEmpty')} />
      ) : (
        <ul className="space-y-3">
          {attempts.map((a) => (
            <li key={a.id} className="hmk-card flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <Link
                  href={`/staff/grading/${a.id}`}
                  className="font-semibold hover:text-hmk-red"
                >
                  {a.applications?.users
                    ? localised(a.applications.users, 'full_name', l)
                    : t('unknownApplicant')}
                </Link>
                <p className="mt-1 text-xs text-[--foreground-muted]">
                  <span className="font-accent">{a.applications?.cohorts?.code}</span>
                  {' · '}
                  {a.screening_tests?.title}
                  {a.submitted_at ? (
                    <>
                      {' · '}
                      <time dateTime={isoDate(a.submitted_at)}>
                        {formatDateTime(a.submitted_at, l)}
                      </time>
                    </>
                  ) : null}
                </p>
              </div>
              <MetaPill tone="accent">{t('awaitingGrading')}</MetaPill>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
