import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {MetaPill} from '@/components/public/meta-pill';
import {OfferActions, WithdrawButton} from '@/components/admissions/offer-actions';
import {StartAttemptButton} from '@/components/assessment/start-attempt-button';
import {getSessionUser} from '@/lib/auth/session';
import {getMyApplications} from '@/lib/queries/admissions';
import {getMyAttemptsByApplication} from '@/lib/queries/assessment';
import {localised} from '@/lib/utils';
import {formatDate, formatDateTime, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

const WITHDRAWABLE = ['SUBMITTED', 'AWAITING_SCREENING', 'UNDER_EVALUATION', 'WAITLISTED'];
const SCREENING_STAGES = ['SUBMITTED', 'AWAITING_SCREENING', 'UNDER_EVALUATION'];

export default async function MyApplicationsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect({href: '/login', locale: l});

  const t = await getTranslations('applications');
  const tScreen = await getTranslations('screening');

  const [applications, attempts] = await Promise.all([
    getMyApplications(),
    getMyAttemptsByApplication(),
  ]);

  return (
    <>
      <PageHeading title={t('title')} lead={t('lead')} />

      {applications.length === 0 ? (
        <div className="space-y-4">
          <EmptyState message={t('empty')} />
          <Link href="/courses" className="inline-block text-sm font-medium text-hmk-red hover:underline">
            {t('browseCourses')}
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {applications.map((a) => {
            const course = a.cohorts?.courses;
            const attempt = attempts.get(a.id);
            const live =
              attempt?.state === 'IN_PROGRESS' && Date.parse(attempt.deadline_at) > Date.now();

            return (
              <li key={a.id} className="hmk-card space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">
                      {course ? localised(course, 'title', l) : a.cohorts?.code}
                    </h2>
                    <p className="mt-1 text-xs text-[--foreground-muted]">
                      <span className="font-accent">{a.cohorts?.code}</span>
                      {' · '}
                      {t('submittedOn')}{' '}
                      <time dateTime={isoDate(a.submitted_at)}>
                        {formatDate(a.submitted_at, l)}
                      </time>
                    </p>
                  </div>
                  <MetaPill tone={a.status === 'OFFERED' ? 'accent' : 'default'}>
                    {t(`status.${a.status}`)}
                  </MetaPill>
                </div>

                {a.status === 'WAITLISTED' && a.waitlist_rank ? (
                  <p className="text-xs text-[--foreground-muted]">#{a.waitlist_rank}</p>
                ) : null}

                {/* M4 screening. A live attempt is a link back into the paper; otherwise
                    offer to start one. The database decides whether starting is allowed
                    (eligibility, attempt limit, active test) - this only routes. */}
                {SCREENING_STAGES.includes(a.status) ? (
                  <div className="flex flex-wrap items-center gap-3">
                    {live ? (
                      <Link
                        href={`/me/screening/${attempt.id}`}
                        className="rounded-[--radius-control] bg-hmk-red px-4 py-1.5 text-xs
                                   font-semibold text-white hover:bg-hmk-red-hover"
                      >
                        {tScreen('title')}
                      </Link>
                    ) : attempt ? (
                      <span className="text-xs text-[--foreground-muted]">
                        {tScreen(`state.${attempt.state}`)}
                        {attempt.normalized_score !== null
                          ? ` · ${attempt.normalized_score}%`
                          : ''}
                      </span>
                    ) : (
                      <StartAttemptButton applicationId={a.id} />
                    )}
                  </div>
                ) : null}

                {a.status === 'OFFERED' ? (
                  <div className="space-y-2">
                    {a.offer_expires_at ? (
                      <p className="text-xs text-[--foreground-muted]">
                        {t('offerExpires')}{' '}
                        <time dateTime={isoDate(a.offer_expires_at)}>
                          {formatDateTime(a.offer_expires_at, l)}
                        </time>
                      </p>
                    ) : null}
                    <OfferActions applicationId={a.id} />
                  </div>
                ) : null}

                {WITHDRAWABLE.includes(a.status) ? (
                  <WithdrawButton applicationId={a.id} />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
