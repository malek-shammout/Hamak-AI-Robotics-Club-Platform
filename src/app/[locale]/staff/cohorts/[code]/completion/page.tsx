import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {MetaPill} from '@/components/public/meta-pill';
import {CompleteEnrollmentForm} from '@/components/lms/complete-enrollment-form';
import {getSessionUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {getCohortByCodeForStaff} from '@/lib/queries/staff';
import {getCohortEnrollments} from '@/lib/queries/lms';
import {localised} from '@/lib/utils';
import type {Locale} from '@/i18n/routing';

export default async function CohortCompletionPage({
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

  const t = await getTranslations('lms');
  const cohort = await getCohortByCodeForStaff(code);
  if (!cohort) notFound();

  const [enrollments, mayApprove, isAdmin] = await Promise.all([
    getCohortEnrollments(cohort.id),
    hasPermission('M3.APPROVE'),
    hasPermission('M10.OVERRIDE'),
  ]);

  const minPct = cohort.min_attendance_pct ?? 0;

  return (
    <article>
      <Link href={`/staff/cohorts/${code}`} className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToCohort')}
      </Link>

      <PageHeading title={t('completionTitle')} lead={t('completionLead', {pct: minPct})} />

      {/* The frozen model has no course-evaluation entity, so the evaluation half of
          BR-05 is an attestation by A2 rather than something the system can compute.
          Saying so plainly prevents anyone assuming the tick box is decorative. */}
      <p className="mb-6 max-w-2xl border-s-2 border-hmk-red bg-hmk-red-subtle px-4 py-2 text-sm">
        {t('br05Note')}
      </p>

      {enrollments.length === 0 ? (
        <p className="text-[--foreground-muted]">{t('noEnrollments')}</p>
      ) : (
        <ul className="space-y-3">
          {enrollments.map((e) => {
            const pct = Number(e.attendance?.attendance_pct ?? 0);
            const meets = (e.attendance?.sessions_held ?? 0) > 0 && pct >= minPct;
            const done = e.status !== 'ACTIVE';

            return (
              <li key={e.id} className="hmk-card space-y-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-medium">
                    {e.users ? localised(e.users, 'full_name', l) : '-'}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <MetaPill tone={meets ? 'accent' : 'default'}>
                      {t('attendancePct', {
                        pct,
                        attended: e.attendance?.sessions_attended ?? 0,
                        held: e.attendance?.sessions_held ?? 0,
                      })}
                    </MetaPill>
                    <MetaPill>{t(`enrollmentStates.${e.status}`)}</MetaPill>
                  </div>
                </div>

                {e.completion_overridden && e.completion_override_reason ? (
                  <p className="text-xs text-[--foreground-muted]">
                    {t('overriddenBecause', {reason: e.completion_override_reason})}
                  </p>
                ) : null}

                {!done && mayApprove ? (
                  <CompleteEnrollmentForm
                    enrollmentId={e.id}
                    meetsAttendance={meets}
                    canOverride={isAdmin}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
