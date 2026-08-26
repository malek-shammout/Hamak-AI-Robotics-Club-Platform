import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {MetaPill} from '@/components/public/meta-pill';
import {getSessionUser} from '@/lib/auth/session';
import {getMyEnrollments} from '@/lib/queries/lms';
import {localised} from '@/lib/utils';
import {formatDate, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function MyEnrollmentsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect({href: '/login', locale: l});

  const t = await getTranslations('lms');
  const enrollments = await getMyEnrollments();

  return (
    <>
      <PageHeading title={t('myEnrollments')} lead={t('myEnrollmentsLead')} />

      {enrollments.length === 0 ? (
        <div className="space-y-4">
          <EmptyState message={t('noMyEnrollments')} />
          <Link href="/courses" className="inline-block text-sm font-medium text-hmk-red hover:underline">
            {t('browseCourses')}
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {enrollments.map((e) => {
            const pct = Number(e.attendance?.attendance_pct ?? 0);
            const min = e.cohorts?.min_attendance_pct ?? 0;
            const meets = (e.attendance?.sessions_held ?? 0) > 0 && pct >= min;
            const course = e.cohorts?.courses;

            return (
              <li key={e.id} className="hmk-card space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">
                      {course ? localised(course, 'title', l) : e.cohorts?.code}
                    </h2>
                    <p className="mt-1 text-xs text-[--foreground-muted]">
                      <span className="font-accent">{e.cohorts?.code}</span>
                      {e.cohorts?.starts_on ? (
                        <>
                          {' · '}
                          <time dateTime={isoDate(e.cohorts.starts_on)}>
                            {formatDate(e.cohorts.starts_on, l)}
                          </time>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <MetaPill tone={e.status === 'COMPLETED' ? 'accent' : 'default'}>
                    {t(`enrollmentStates.${e.status}`)}
                  </MetaPill>
                </div>

                {/* Attendance is the half of BR-05 a student can actually see and act
                    on, so show the bar and the threshold, not just a number. */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[--foreground-muted]">
                      {t('attendancePct', {
                        pct,
                        attended: e.attendance?.sessions_attended ?? 0,
                        held: e.attendance?.sessions_held ?? 0,
                      })}
                    </span>
                    <span className={meets ? 'text-hmk-red' : 'text-[--foreground-muted]'}>
                      {t('requiredPct', {pct: min})}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t('attendanceProgress')}
                    className="h-1.5 w-full overflow-hidden bg-[--border]"
                  >
                    <div
                      className={meets ? 'h-full bg-hmk-red' : 'h-full bg-[--foreground-muted]'}
                      style={{width: `${Math.min(100, pct)}%`}}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
