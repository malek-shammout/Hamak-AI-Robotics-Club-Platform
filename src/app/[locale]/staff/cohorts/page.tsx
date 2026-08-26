import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {MetaPill} from '@/components/public/meta-pill';
import {getSessionUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {getCohortsWithFunnel} from '@/lib/queries/staff';
import {localised} from '@/lib/utils';
import {formatDate, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function StaffCohortsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect({href: '/login', locale: l});
  // Route guard. RLS would return an empty list anyway; this gives an honest 404
  // instead of a page that looks broken.
  if (!(await hasPermission('M3.READ'))) redirect({href: '/', locale: l});

  const t = await getTranslations('staff');
  const cohorts = await getCohortsWithFunnel();

  return (
    <>
      <PageHeading title={t('cohortsTitle')} lead={t('cohortsLead')} />

      {cohorts.length === 0 ? (
        <EmptyState message={t('noCohorts')} />
      ) : (
        <ul className="space-y-3">
          {cohorts.map((c) => (
            <li key={c.id} className="hmk-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/staff/cohorts/${c.code}`}
                    className="font-semibold hover:text-hmk-red"
                  >
                    {c.courses ? localised(c.courses, 'title', l) : c.code}
                  </Link>
                  <p className="mt-1 text-xs text-[--foreground-muted]">
                    <span className="font-accent">{c.code}</span>
                    {c.starts_on ? (
                      <>
                        {' · '}
                        <time dateTime={isoDate(c.starts_on)}>{formatDate(c.starts_on, l)}</time>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.courses?.requires_screening ? (
                    <MetaPill>{t('screening')}</MetaPill>
                  ) : null}
                  <MetaPill tone={c.status === 'OPEN' ? 'accent' : 'default'}>{c.status}</MetaPill>
                </div>
              </div>

              {c.funnel ? (
                <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                  <Stat label={t('funnel.total')} value={c.funnel.total_applications} />
                  <Stat label={t('funnel.offered')} value={c.funnel.offered} />
                  <Stat label={t('funnel.waitlisted')} value={c.funnel.waitlisted} />
                  <Stat label={t('funnel.enrolled')} value={c.funnel.enrolled} />
                  <Stat label={t('funnel.rejected')} value={c.funnel.rejected} />
                  <Stat label={t('funnel.capacity')} value={c.capacity} />
                </dl>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Stat({label, value}: {label: string; value: number | null}) {
  return (
    <div>
      <dt className="text-[--foreground-muted]">{label}</dt>
      <dd className="font-accent text-base">{value ?? 0}</dd>
    </div>
  );
}
