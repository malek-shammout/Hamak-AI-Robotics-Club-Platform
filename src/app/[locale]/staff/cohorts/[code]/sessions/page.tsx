import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {MetaPill} from '@/components/public/meta-pill';
import {SessionStatusForm} from '@/components/lms/session-status-form';
import {CreateSessionForm} from '@/components/lms/create-session-form';
import {getSessionUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {getCohortByCodeForStaff} from '@/lib/queries/staff';
import {getCohortSessions} from '@/lib/queries/lms';
import {localised} from '@/lib/utils';
import {formatDateTime, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function CohortSessionsPage({
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

  const [sessions, mayCreate] = await Promise.all([
    getCohortSessions(cohort.id),
    hasPermission('M3.CREATE'),
  ]);

  const held = sessions.filter((s) => s.status === 'HELD').length;
  const nextNo = sessions.reduce((m, s) => Math.max(m, s.session_no), 0) + 1;

  return (
    <article>
      <Link href={`/staff/cohorts/${code}`} className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToCohort')}
      </Link>

      <PageHeading
        title={cohort.courses ? localised(cohort.courses, 'title', l) : cohort.code}
        lead={t('sessionsLead')}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <MetaPill tone="accent">{cohort.code}</MetaPill>
        <MetaPill>{t('sessionsHeld', {held, total: sessions.length})}</MetaPill>
        <MetaPill>{t('minAttendance', {pct: cohort.min_attendance_pct ?? 0})}</MetaPill>
      </div>

      {/* Only HELD sessions count toward BR-05. Stating it here stops A2 wondering why
          a cancelled session did not move anyone's percentage. */}
      <p className="mb-6 max-w-2xl border-s-2 border-hmk-red bg-hmk-red-subtle px-4 py-2 text-sm">
        {t('heldOnlyNote')}
      </p>

      {sessions.length === 0 ? (
        <p className="mb-6 text-[--foreground-muted]">{t('noSessions')}</p>
      ) : (
        <ul className="mb-8 space-y-2">
          {sessions.map((s) => (
            <li key={s.id} className="hmk-card flex flex-wrap items-center gap-4 p-4">
              <span className="font-accent text-sm">#{s.session_no}</span>
              <time dateTime={isoDate(s.scheduled_at)} className="text-sm">
                {formatDateTime(s.scheduled_at, l)}
              </time>
              {s.location ? (
                <span className="text-sm text-[--foreground-muted]">{s.location}</span>
              ) : null}
              <MetaPill tone={s.status === 'HELD' ? 'accent' : 'default'}>
                {t(`sessionStates.${s.status}`)}
              </MetaPill>

              <div className="ms-auto flex flex-wrap items-center gap-4">
                {mayCreate ? <SessionStatusForm sessionId={s.id} current={s.status} /> : null}
                <Link
                  href={`/staff/sessions/${s.id}`}
                  className="text-xs font-medium text-hmk-red hover:underline"
                >
                  {t('takeRegister')}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {mayCreate ? <CreateSessionForm cohortId={cohort.id} nextNo={nextNo} /> : null}
    </article>
  );
}
