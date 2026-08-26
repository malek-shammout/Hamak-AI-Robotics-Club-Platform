import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {MetaPill} from '@/components/public/meta-pill';
import {RunAllocationButton} from '@/components/admissions/run-allocation-button';
import {ComputeReadinessButton} from '@/components/admissions/compute-readiness-button';
import {getSessionUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {
  getCohortByCodeForStaff,
  getCohortApplicants,
  getScreeningTest,
} from '@/lib/queries/staff';
import {getActiveReadinessModel} from '@/lib/queries/assessment';
import {localised} from '@/lib/utils';
import {formatDate, formatDateTime, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function StaffCohortPage({
  params,
}: {
  params: Promise<{locale: string; code: string}>;
}) {
  const {locale, code} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect({href: '/login', locale: l});
  if (!(await hasPermission('M3.READ'))) redirect({href: '/', locale: l});

  const t = await getTranslations('staff');
  const tApp = await getTranslations('applications');

  const cohort = await getCohortByCodeForStaff(code);
  if (!cohort) notFound();

  const [applicants, screening, mayApprove, readinessModel] = await Promise.all([
    getCohortApplicants(cohort.id),
    getScreeningTest(cohort.id),
    hasPermission('M3.APPROVE'),
    getActiveReadinessModel(cohort.id),
  ]);

  return (
    <article>
      <Link href="/staff/cohorts" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToCohorts')}
      </Link>

      <PageHeading title={cohort.courses ? localised(cohort.courses, 'title', l) : cohort.code} />

      <div className="mb-6 flex flex-wrap gap-2">
        <MetaPill tone="accent">{cohort.code}</MetaPill>
        <MetaPill>{`${t('funnel.capacity')}: ${cohort.capacity}`}</MetaPill>
        <MetaPill>{`${t('offerWindow')}: ${cohort.offer_confirmation_hours}h`}</MetaPill>
        {cohort.starts_on ? (
          <MetaPill>
            <time dateTime={isoDate(cohort.starts_on)}>{formatDate(cohort.starts_on, l)}</time>
          </MetaPill>
        ) : null}
      </div>

      {/* BR-02 is only meaningful when a threshold is configured. Saying so out loud
          stops A2 assuming a gate is active when it is not. */}
      <div className="hmk-card mb-6 p-5">
        <h2 className="text-sm font-semibold">{t('screeningGate')}</h2>
        <p className="mt-1 text-sm text-[--foreground-muted]">
          {cohort.courses?.requires_screening
            ? screening
              ? t('gateActive', {threshold: screening.pass_threshold, max: screening.max_score})
              : t('gateMissingTest')
            : t('gateNotRequired')}
        </p>
      </div>

      {/* US-TRN-06. Readiness must be computed BEFORE allocation, because BR-03
          ranks on the STORED readiness_score - allocating first would rank on
          whatever the previous run left behind. The ordering is stated in the UI
          rather than left for A2 to infer. */}
      <div className="hmk-card mb-6 p-5">
        <h2 className="text-sm font-semibold">{t('readinessModel')}</h2>
        {readinessModel ? (
          <>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[24rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[--border] text-xs uppercase text-[--foreground-muted]">
                    <th scope="col" className="p-2 text-start">{t('factor')}</th>
                    <th scope="col" className="p-2 text-start">{t('weight')}</th>
                    <th scope="col" className="p-2 text-start">{t('source')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(readinessModel.readiness_factors ?? []).map((f) => (
                    <tr key={f.id} className="border-b border-[--border]">
                      <td className="p-2 font-accent">{f.factor_code}</td>
                      <td className="p-2">{f.weight_pct}%</td>
                      <td className="p-2 text-[--foreground-muted]">{f.value_source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {mayApprove ? (
              <div className="mt-4 space-y-2">
                <p className="text-sm text-[--foreground-muted]">{t('readinessOrder')}</p>
                <ComputeReadinessButton cohortId={cohort.id} />
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-sm text-[--foreground-muted]">{t('noReadinessModel')}</p>
        )}
      </div>

      {mayApprove ? (
        <div className="hmk-card mb-8 space-y-3 p-5">
          <h2 className="text-sm font-semibold">{t('allocationTitle')}</h2>
          <p className="text-sm text-[--foreground-muted]">{t('allocationExplain')}</p>
          <RunAllocationButton cohortId={cohort.id} />
        </div>
      ) : null}

      <h2 className="mb-3 text-xl font-semibold">{t('applicants')}</h2>
      {applicants.length === 0 ? (
        <p className="text-[--foreground-muted]">{t('noApplicants')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[--border] text-start text-xs uppercase text-[--foreground-muted]">
                <th scope="col" className="p-2 text-start">#</th>
                <th scope="col" className="p-2 text-start">{t('applicant')}</th>
                <th scope="col" className="p-2 text-start">{t('score')}</th>
                <th scope="col" className="p-2 text-start">{t('statusCol')}</th>
                <th scope="col" className="p-2 text-start">{t('offerExpiry')}</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map((a, i) => (
                <tr key={a.id} className="border-b border-[--border]">
                  <td className="p-2 font-accent">{a.rank_position ?? i + 1}</td>
                  <td className="p-2">
                    {a.users ? localised(a.users, 'full_name', l) : '-'}
                    {a.waitlist_rank ? (
                      <span className="ms-2 text-xs text-[--foreground-muted]">
                        {t('waitlistRank', {rank: a.waitlist_rank})}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-2 font-accent">{a.readiness_score ?? '-'}</td>
                  <td className="p-2">
                    <MetaPill tone={a.status === 'OFFERED' ? 'accent' : 'default'}>
                      {tApp(`status.${a.status}`)}
                    </MetaPill>
                  </td>
                  <td className="p-2 text-xs text-[--foreground-muted]">
                    {a.offer_expires_at ? (
                      <time dateTime={isoDate(a.offer_expires_at)}>
                        {formatDateTime(a.offer_expires_at, l)}
                      </time>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
