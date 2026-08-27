import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {AlarmClock, Flame} from 'lucide-react';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {MetaPill} from '@/components/public/meta-pill';
import {requireUser} from '@/lib/auth/session';
import {getTriageQueue} from '@/lib/queries/consultations';
import {localised} from '@/lib/utils';
import {formatDate, formatDateTime, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

/**
 * A4's triage queue (AD-7).
 *
 * `staff_read` gates the underlying table on M2.READ, so someone without it gets an
 * empty list rather than an error. That is the correct shape: the page is not the
 * boundary, RLS is.
 */
export default async function StaffConsultationsPage({
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
  const tPriority = await getTranslations('enums.consultationPriority');

  const queue = await getTriageQueue();

  const open = queue.filter((r) => !['RESOLVED', 'REJECTED'].includes(r.status));
  const awaiting = open.filter((r) => ['NEW', 'ESCALATED', 'TRIAGED'].includes(r.status));
  const inFlight = open.filter((r) => ['ASSIGNED', 'IN_PROGRESS'].includes(r.status));

  function Row({r}: {r: (typeof queue)[number]}) {
    const expert = (r.consultation_assignments ?? []).find(
      (a) => a.state === 'ACCEPTED' || a.state === 'PENDING_ACCEPTANCE'
    );
    return (
      <li className="hmk-card space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href={`/staff/consultations/${r.id}`}
              className="font-semibold hover:text-hmk-red"
            >
              {r.title}
            </Link>
            <p className="mt-1 font-accent text-xs text-[--foreground-muted]" dir="ltr">
              {r.reference_no}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* BR-08: a breach is staff-facing. The student is never shown it. */}
            {r.sla_breached ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-hmk-red">
                <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                {t('slaBreached')}
              </span>
            ) : null}
            <MetaPill>{tPriority(r.priority)}</MetaPill>
            <MetaPill>{tStatus(r.status)}</MetaPill>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-[--foreground-muted]">
          {r.users ? <span>{localised(r.users, 'full_name', l)}</span> : null}
          <time dateTime={isoDate(r.created_at)}>{formatDate(r.created_at, l)}</time>
          {r.sla_due_at ? (
            <span className="inline-flex items-center gap-1.5">
              <AlarmClock className="h-3.5 w-3.5" aria-hidden="true" />
              <time dateTime={isoDate(r.sla_due_at)}>{formatDateTime(r.sla_due_at, l)}</time>
            </span>
          ) : null}
          {expert?.users ? (
            <span>{t('assignedTo', {name: localised(expert.users, 'full_name', l)})}</span>
          ) : null}
        </div>

        {(r.consultation_request_domains ?? []).length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {(r.consultation_request_domains ?? []).map((d, i) =>
              d.expertise_domains ? (
                <li
                  key={i}
                  className="rounded-[--radius-control] border border-[--border] px-2.5 py-1 text-xs"
                >
                  {localised(d.expertise_domains, 'name', l)}
                </li>
              ) : null
            )}
          </ul>
        ) : null}
      </li>
    );
  }

  return (
    <>
      <PageHeading title={t('staffTitle')} lead={t('staffLead')} />

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">{t('awaitingTitle')}</h2>
        {awaiting.length === 0 ? (
          <EmptyState message={t('emptyQueue')} />
        ) : (
          <ul className="space-y-3">
            {awaiting.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>
        )}
      </section>

      {inFlight.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t('inFlightTitle')}</h2>
          <ul className="space-y-3">
            {inFlight.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
