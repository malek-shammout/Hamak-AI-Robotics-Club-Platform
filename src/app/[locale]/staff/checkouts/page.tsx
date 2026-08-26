import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {MetaPill} from '@/components/public/meta-pill';
import {getSessionUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {getOutstandingCheckouts} from '@/lib/queries/logistics';
import {localised} from '@/lib/utils';
import {formatDate, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function OutstandingCheckoutsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect({href: '/login', locale: l});
  if (!(await hasPermission('M5.READ'))) redirect({href: '/', locale: l});

  const t = await getTranslations('desk');
  const checkouts = await getOutstandingCheckouts();
  const now = Date.now();

  return (
    <>
      <PageHeading title={t('outstandingTitle')} lead={t('outstandingLead')} />

      <Link href="/staff/desk" className="mb-6 inline-block text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToDesk')}
      </Link>

      {checkouts.length === 0 ? (
        <EmptyState message={t('noOutstanding')} />
      ) : (
        <ul className="space-y-3">
          {checkouts.map((c) => {
            const overdue = Date.parse(c.due_at) < now;
            const open = (c.checkout_lines ?? []).filter((x) =>
              ['ACTIVE', 'OVERDUE'].includes(x.status)
            ).length;

            return (
              <li key={c.id} className="hmk-card flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <Link href={`/staff/checkouts/${c.id}`} className="font-semibold hover:text-hmk-red">
                    {c.users ? localised(c.users, 'full_name', l) : '-'}
                  </Link>
                  <p className="mt-1 text-xs text-[--foreground-muted]">
                    <span className="font-accent">{c.checkout_no}</span>
                    {' · '}
                    {t('itemsOutstanding', {n: open})}
                    {' · '}
                    {t('due')}{' '}
                    <time dateTime={isoDate(c.due_at)}>{formatDate(c.due_at, l)}</time>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.issued_under_override ? <MetaPill>{t('issuedByOverride')}</MetaPill> : null}
                  <MetaPill tone={overdue ? 'accent' : 'default'}>
                    {overdue ? t('overdue') : t(`checkoutStates.${c.status}`)}
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
