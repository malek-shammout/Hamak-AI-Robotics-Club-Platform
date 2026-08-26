import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {MetaPill} from '@/components/public/meta-pill';
import {ApplyButton} from '@/components/admissions/apply-button';
import {
  getCourseByCode,
  getCohortsForCourse,
  getPublicCourseModules,
} from '@/lib/queries/public';
import {getMyLiveCohortIds} from '@/lib/queries/admissions';
import {getSessionUser} from '@/lib/auth/session';
import {localised} from '@/lib/utils';
import {formatDate, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{locale: string; code: string}>;
}) {
  const {locale, code} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('courses');
  const tApp = await getTranslations('applications');
  const tCommon = await getTranslations('common');
  const tEnum = await getTranslations('enums');
  const l = locale as Locale;

  const course = await getCourseByCode(code);
  if (!course) notFound();

  const user = await getSessionUser();

  const [cohorts, modules, liveCohortIds] = await Promise.all([
    getCohortsForCourse(course.id),
    getPublicCourseModules(course.id),
    user ? getMyLiveCohortIds() : Promise.resolve(new Set<string>()),
  ]);

  return (
    <article>
      <Link href="/courses" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {tCommon('backToList')}
      </Link>

      <PageHeading title={localised(course, 'title', l)} />

      <div className="mb-8 flex flex-wrap gap-2">
        <MetaPill tone="accent">{tEnum(`track.${course.track}`)}</MetaPill>
        <MetaPill>{tEnum(`level.${course.level}`)}</MetaPill>
        {course.session_count ? (
          <MetaPill>{`${course.session_count} ${t('sessions')}`}</MetaPill>
        ) : null}
        {course.duration_hours ? (
          <MetaPill>{`${course.duration_hours} ${t('hours')}`}</MetaPill>
        ) : null}
        {course.requires_screening ? <MetaPill>{t('screeningRequired')}</MetaPill> : null}
      </div>

      <div className="space-y-8">
        {localised(course, 'description', l) ? (
          <p className="max-w-3xl text-[--foreground-muted]">
            {localised(course, 'description', l)}
          </p>
        ) : null}

        {course.learning_outcomes ? (
          <section>
            <h2 className="mb-2 text-xl font-semibold">{t('outcomes')}</h2>
            <p className="whitespace-pre-line text-[--foreground-muted]">
              {course.learning_outcomes}
            </p>
          </section>
        ) : null}

        {course.prerequisites_text ? (
          <section>
            <h2 className="mb-2 text-xl font-semibold">{t('prerequisites')}</h2>
            <p className="text-[--foreground-muted]">{course.prerequisites_text}</p>
          </section>
        ) : null}

        {modules.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xl font-semibold">{t('modules')}</h2>
            <ol className="space-y-2">
              {modules.map((m) => (
                <li key={m.id} className="hmk-card flex items-baseline gap-3 p-4">
                  <span className="font-accent text-hmk-red">{m.order_index + 1}</span>
                  <div>
                    <p className="font-medium">{m.title}</p>
                    {m.objectives ? (
                      <p className="text-sm text-[--foreground-muted]">{m.objectives}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <section>
          <h2 className="mb-3 text-xl font-semibold">{t('cohorts')}</h2>
          {cohorts.length === 0 ? (
            <p className="text-[--foreground-muted]">{t('noCohorts')}</p>
          ) : (
            <ul className="space-y-2">
              {cohorts.map((ch) => (
                <li key={ch.id} className="hmk-card flex flex-wrap items-center gap-4 p-4">
                  <span className="font-accent text-sm">{ch.code}</span>
                  {ch.starts_on ? (
                    <span className="text-sm text-[--foreground-muted]">
                      {t('startsOn')}{' '}
                      <time dateTime={isoDate(ch.starts_on)}>{formatDate(ch.starts_on, l)}</time>
                    </span>
                  ) : null}
                  <span className="text-sm text-[--foreground-muted]">
                    {t('capacity')}: {ch.capacity}
                  </span>
                  <MetaPill>{ch.status}</MetaPill>

                  {/* The apply control only appears for an OPEN cohort. The database
                      re-checks status and the application window anyway (migration
                      0009) - hiding the button is courtesy, not enforcement. */}
                  {ch.status === 'OPEN' ? (
                    <span className="ms-auto">
                      {!user ? (
                        <Link
                          href="/login"
                          className="text-xs font-medium text-hmk-red hover:underline"
                        >
                          {tApp('signInToApply')}
                        </Link>
                      ) : (
                        <ApplyButton
                          cohortId={ch.id}
                          disabled={liveCohortIds.has(ch.id)}
                          disabledLabel={tApp('alreadyApplied')}
                        />
                      )}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  );
}
