import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {MetaPill} from '@/components/public/meta-pill';
import {getSessionUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {getClearanceQueue, type PreconditionSnapshot} from '@/lib/queries/clearance';
import {localised} from '@/lib/utils';
import type {Locale} from '@/i18n/routing';

export default async function ClearanceQueuePage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect({href: '/login', locale: l});
  if (!(await hasPermission('M6.READ'))) redirect({href: '/', locale: l});

  const t = await getTranslations('clearance');
  const rows = await getClearanceQueue();

  const pending = rows.filter((r) => r.status === 'EVALUATING' || r.status === 'WITHHELD');

  return (
    <>
      <PageHeading title={t('queueTitle')} lead={t('queueLead')} />

      <p className="mb-6 max-w-2xl border-s-2 border-hmk-red bg-hmk-red-subtle px-4 py-2 text-sm">
        {t('queueNote', {n: pending.length})}
      </p>

      {rows.length === 0 ? (
        <EmptyState message={t('queueEmpty')} />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const snap = r.precondition_snapshot as PreconditionSnapshot | null;
            const ready = snap?.approval_enabled === true;
            const e = r.enrollments;

            return (
              <li key={r.id} className="hmk-card flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <Link
                    href={`/staff/clearance/${e?.id}`}
                    className="font-semibold hover:text-hmk-red"
                  >
                    {e?.users ? localised(e.users, 'full_name', l) : '-'}
                  </Link>
                  <p className="mt-1 text-xs text-[--foreground-muted]">
                    <span className="font-accent">{e?.cohorts?.code}</span>
                    {e?.cohorts?.courses ? ` · ${localised(e.cohorts.courses, 'title', l)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* The advisory is an A3/A7 signal only — never surfaced to students. */}
                  {r.advisory_outstanding_elsewhere ? (
                    <MetaPill>{t('outstandingElsewhere')}</MetaPill>
                  ) : null}
                  {ready && r.status === 'EVALUATING' ? (
                    <MetaPill tone="accent">{t('readyToApprove')}</MetaPill>
                  ) : null}
                  <MetaPill tone={r.status === 'APPROVED' ? 'accent' : 'default'}>
                    {t(`statuses.${r.status}`)}
                  </MetaPill>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
