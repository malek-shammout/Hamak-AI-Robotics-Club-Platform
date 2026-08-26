import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {MetaPill} from '@/components/public/meta-pill';
import {requireUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {getMyRequisitions, getPendingRequisitions} from '@/lib/queries/requisitions';
import {localised} from '@/lib/utils';
import {formatDate, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function RequisitionsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await requireUser(l);

  const t = await getTranslations('requisitions');
  const mayApprove = await hasPermission('M5.APPROVE');

  // D-18: the two duties get two lists. A4 sees what they raised; A3 sees the queue
  // they must decide on.
  const [mine, queue] = await Promise.all([
    getMyRequisitions(user.id),
    mayApprove ? getPendingRequisitions() : Promise.resolve([]),
  ]);

  const pending = queue.filter((r) => r.status === 'PENDING');

  return (
    <>
      <PageHeading title={t('title')} lead={t('lead')} />

      <Link
        href="/staff/requisitions/new"
        className="mb-8 inline-block rounded-[--radius-control] bg-hmk-red px-5 py-2.5 text-sm
                   font-semibold text-white hover:bg-hmk-red-hover"
      >
        {t('raise')}
      </Link>

      {mayApprove ? (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">{t('queueTitle')}</h2>
          <p className="mb-4 max-w-2xl border-s-2 border-hmk-red bg-hmk-red-subtle px-4 py-2 text-sm">
            {t('queueNote', {n: pending.length})}
          </p>
          {queue.length === 0 ? (
            <EmptyState message={t('queueEmpty')} />
          ) : (
            <ul className="space-y-3">
              {queue.map((r) => (
                <li key={r.id} className="hmk-card flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <Link href={`/staff/requisitions/${r.id}`} className="font-semibold hover:text-hmk-red">
                      {r.projects ? localised(r.projects, 'title', l) : r.requisition_no}
                    </Link>
                    <p className="mt-1 text-xs text-[--foreground-muted]">
                      <span className="font-accent">{r.requisition_no}</span>
                      {r.users ? ` · ${localised(r.users, 'full_name', l)}` : ''}
                      {r.required_by ? (
                        <>
                          {' · '}
                          {t('by')}{' '}
                          <time dateTime={isoDate(r.required_by)}>{formatDate(r.required_by, l)}</time>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <MetaPill>{t('lines', {n: (r.requisition_lines ?? []).length})}</MetaPill>
                    <MetaPill tone={r.status === 'PENDING' ? 'accent' : 'default'}>
                      {t(`statuses.${r.status}`)}
                    </MetaPill>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('mineTitle')}</h2>
        {mine.length === 0 ? (
          <EmptyState message={t('mineEmpty')} />
        ) : (
          <ul className="space-y-3">
            {mine.map((r) => (
              <li key={r.id} className="hmk-card flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <Link href={`/staff/requisitions/${r.id}`} className="font-semibold hover:text-hmk-red">
                    {r.projects ? localised(r.projects, 'title', l) : r.requisition_no}
                  </Link>
                  <p className="mt-1 text-xs text-[--foreground-muted]">
                    <span className="font-accent">{r.requisition_no}</span>
                    {' · '}
                    {t('lines', {n: (r.requisition_lines ?? []).length})}
                  </p>
                  {r.review_reason ? (
                    <p className="mt-1 text-xs text-[--foreground-muted]">{r.review_reason}</p>
                  ) : null}
                </div>
                <MetaPill tone={r.status === 'APPROVED' ? 'accent' : 'default'}>
                  {t(`statuses.${r.status}`)}
                </MetaPill>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
