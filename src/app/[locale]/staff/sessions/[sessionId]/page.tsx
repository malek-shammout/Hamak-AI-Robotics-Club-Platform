import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {MetaPill} from '@/components/public/meta-pill';
import {AttendanceRow} from '@/components/lms/attendance-row';
import {getSessionUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {getSession, getSessionRoster} from '@/lib/queries/lms';
import {localised} from '@/lib/utils';
import {formatDateTime, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function SessionRegisterPage({
  params,
}: {
  params: Promise<{locale: string; sessionId: string}>;
}) {
  const {locale, sessionId} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect({href: '/login', locale: l});
  if (!(await hasPermission('M3.READ'))) redirect({href: '/', locale: l});

  const t = await getTranslations('lms');
  const session = await getSession(sessionId);
  if (!session) notFound();

  const [roster, mayMark] = await Promise.all([
    getSessionRoster(session.cohort_id, sessionId),
    hasPermission('M3.UPDATE'),
  ]);

  const marked = roster.filter((r) => r.mark).length;

  return (
    <article>
      <Link
        href={`/staff/cohorts/${session.cohorts?.code}/sessions`}
        className="text-sm text-[--foreground-muted] hover:text-hmk-red"
      >
        {t('backToSessions')}
      </Link>

      <PageHeading
        title={t('registerFor', {no: session.session_no})}
        lead={session.cohorts?.courses ? localised(session.cohorts.courses, 'title', l) : undefined}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <MetaPill tone="accent">{session.cohorts?.code}</MetaPill>
        <MetaPill>
          <time dateTime={isoDate(session.scheduled_at)}>
            {formatDateTime(session.scheduled_at, l)}
          </time>
        </MetaPill>
        <MetaPill>{t(`sessionStates.${session.status}`)}</MetaPill>
        <MetaPill>{t('markedCount', {marked, total: roster.length})}</MetaPill>
      </div>

      {session.status !== 'HELD' ? (
        <p className="mb-6 max-w-2xl border-s-2 border-hmk-red bg-hmk-red-subtle px-4 py-2 text-sm">
          {t('notHeldWarning')}
        </p>
      ) : null}

      {roster.length === 0 ? (
        <p className="text-[--foreground-muted]">{t('noEnrollments')}</p>
      ) : !mayMark ? (
        <p className="text-[--foreground-muted]">{t('noMarkPermission')}</p>
      ) : (
        <ul className="space-y-2">
          {roster.map((r) => (
            <AttendanceRow
              key={r.id}
              enrollmentId={r.id}
              sessionId={sessionId}
              name={r.users ? localised(r.users, 'full_name', l) : '-'}
              current={r.mark?.state ?? null}
              amendedAt={r.mark?.amended_at ?? null}
              amendmentReason={r.mark?.amendment_reason ?? null}
            />
          ))}
        </ul>
      )}
    </article>
  );
}
