import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {AlarmClock} from 'lucide-react';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {MetaPill} from '@/components/public/meta-pill';
import {AssignmentResponse} from '@/components/consultations/assignment-response';
import {requireUser} from '@/lib/auth/session';
import {getMyConsultations, getMyAssignments} from '@/lib/queries/consultations';
import {formatDate, formatDateTime, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

/**
 * The signed-in view of M2, from both sides.
 *
 * A member can be a requester on one thread and the assigned expert on another, so
 * both lists live here rather than in separate areas — `consultation_requests` is
 * scoped by RLS to the caller's own threads, and `consultation_assignments` by
 * `self_read_own_assignments`.
 */
export default async function MyConsultationsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  await requireUser(l);

  const t = await getTranslations('consultations');
  const tStatus = await getTranslations('enums.consultationStatus');
  const tState = await getTranslations('enums.assignmentState');

  const [requests, assignments] = await Promise.all([getMyConsultations(), getMyAssignments()]);

  const pendingAssignments = assignments.filter((a) => a.state === 'PENDING_ACCEPTANCE');
  const activeAssignments = assignments.filter((a) => a.state === 'ACCEPTED');

  return (
    <>
      <PageHeading title={t('myTitle')} lead={t('myLead')} />

      <Link
        href="/me/consultations/new"
        className="mb-10 inline-block rounded-[--radius-control] bg-hmk-red px-5 py-2.5 text-sm
                   font-semibold text-white hover:bg-hmk-red-hover"
      >
        {t('startRequest')}
      </Link>

      {pendingAssignments.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">{t('invitationsTitle')}</h2>
          <ul className="space-y-3">
            {pendingAssignments.map((a) => (
              <li key={a.id} className="hmk-card space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{a.consultation_requests?.title}</p>
                    <p className="mt-1 font-accent text-xs text-[--foreground-muted]" dir="ltr">
                      {a.consultation_requests?.reference_no}
                    </p>
                  </div>
                  {a.response_due_at ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-[--foreground-muted]">
                      <AlarmClock className="h-3.5 w-3.5" aria-hidden="true" />
                      <time dateTime={isoDate(a.response_due_at)}>
                        {formatDateTime(a.response_due_at, l)}
                      </time>
                    </span>
                  ) : null}
                </div>
                <AssignmentResponse assignmentId={a.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {activeAssignments.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">{t('advisingTitle')}</h2>
          <ul className="space-y-3">
            {activeAssignments.map((a) => (
              <li key={a.id} className="hmk-card flex flex-wrap items-center justify-between gap-3 p-5">
                <Link
                  href={`/me/consultations/${a.consultation_request_id}`}
                  className="font-medium hover:text-hmk-red"
                >
                  {a.consultation_requests?.title}
                </Link>
                <MetaPill>{tState(a.state)}</MetaPill>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <h2 className="mb-3 text-lg font-semibold">{t('mineTitle')}</h2>
      {requests.length === 0 ? (
        <EmptyState message={t('emptyMine')} />
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r.id} className="hmk-card space-y-3 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/me/consultations/${r.id}`}
                    className="font-medium hover:text-hmk-red"
                  >
                    {r.title}
                  </Link>
                  <p className="mt-1 font-accent text-xs text-[--foreground-muted]" dir="ltr">
                    {r.reference_no}
                  </p>
                </div>
                <MetaPill>{tStatus(r.status)}</MetaPill>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-[--foreground-muted]">
                <time dateTime={isoDate(r.created_at)}>{formatDate(r.created_at, l)}</time>
                {/* The student sees the promise, not the breach flag — an escalation is
                    the club's internal problem to fix, not a status to explain away. */}
                {r.sla_due_at && r.status === 'NEW' ? (
                  <span>
                    {t('replyBy', {date: formatDate(r.sla_due_at, l)})}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
