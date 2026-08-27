import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {MetaPill} from '@/components/public/meta-pill';
import {TriageForm} from '@/components/consultations/triage-form';
import {AssignForm} from '@/components/consultations/assign-form';
import {requireUser} from '@/lib/auth/session';
import {
  getConsultation,
  getThread,
  getSuggestedExperts,
  getExpertiseDomains,
} from '@/lib/queries/consultations';
import {localised} from '@/lib/utils';
import {formatDate, formatDateTime, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function StaffConsultationPage({
  params,
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  await requireUser(l);

  const request = await getConsultation(id);
  if (!request) notFound();

  const t = await getTranslations('consultations');
  const tStatus = await getTranslations('enums.consultationStatus');
  const tSupport = await getTranslations('enums.supportType');
  const tState = await getTranslations('enums.assignmentState');

  // Candidates only matter once the request has been classified, so the fetch waits
  // for a state where assignment is legal — asking earlier would rank against domains
  // the triager has not confirmed yet.
  const assignable = request.status === 'TRIAGED' || request.status === 'ESCALATED';

  const [domains, thread, candidates] = await Promise.all([
    getExpertiseDomains(),
    getThread(id),
    assignable ? getSuggestedExperts(id) : Promise.resolve([]),
  ]);

  const selectedDomains = (request.consultation_request_domains ?? [])
    .map((d) => d.expertise_domains?.id)
    .filter((x): x is string => Boolean(x));

  const triageable = request.status === 'NEW' || request.status === 'ESCALATED';

  return (
    <>
      <Link
        href="/staff/consultations"
        className="text-sm text-[--foreground-muted] hover:text-hmk-red"
      >
        {t('backToQueue')}
      </Link>

      <PageHeading title={request.title} />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <MetaPill>{tStatus(request.status)}</MetaPill>
        <MetaPill>{tSupport(request.support_type)}</MetaPill>
        <span className="font-accent text-xs text-[--foreground-muted]" dir="ltr">
          {request.reference_no}
        </span>
        {request.sla_breached ? (
          <span className="text-xs font-semibold text-hmk-red">{t('slaBreached')}</span>
        ) : null}
      </div>

      <dl className="mb-8 grid gap-4 text-sm sm:grid-cols-2">
        {request.users ? (
          <div>
            <dt className="text-xs text-[--foreground-muted]">{t('requester')}</dt>
            <dd className="font-medium">{localised(request.users, 'full_name', l)}</dd>
          </div>
        ) : null}
        {request.supervisor_name ? (
          <div>
            <dt className="text-xs text-[--foreground-muted]">{t('fieldSupervisor')}</dt>
            <dd className="font-medium">{request.supervisor_name}</dd>
          </div>
        ) : null}
        {request.project_deadline_on ? (
          <div>
            <dt className="text-xs text-[--foreground-muted]">{t('fieldDeadline')}</dt>
            <dd className="font-medium">
              <time dateTime={isoDate(request.project_deadline_on)}>
                {formatDate(request.project_deadline_on, l)}
              </time>
            </dd>
          </div>
        ) : null}
        {request.sla_due_at ? (
          <div>
            <dt className="text-xs text-[--foreground-muted]">{t('slaDue')}</dt>
            <dd className="font-medium">
              <time dateTime={isoDate(request.sla_due_at)}>
                {formatDateTime(request.sla_due_at, l)}
              </time>
            </dd>
          </div>
        ) : null}
      </dl>

      {request.abstract ? (
        <section className="hmk-card mb-8 p-5">
          <h2 className="mb-2 text-sm font-semibold">{t('fieldAbstract')}</h2>
          <p className="whitespace-pre-wrap text-sm text-[--foreground-muted]">
            {request.abstract}
          </p>
        </section>
      ) : null}

      {triageable ? (
        <section className="hmk-card mb-8 space-y-4 p-6">
          <h2 className="text-lg font-semibold">{t('triageTitle')}</h2>
          <TriageForm
            requestId={id}
            domains={domains.map((d) => ({id: d.id, code: d.code, name: localised(d, 'name', l)}))}
            selected={selectedDomains}
            priority={request.priority}
            complexity={request.complexity}
          />
        </section>
      ) : null}

      {assignable ? (
        <section className="hmk-card mb-8 space-y-4 p-6">
          <h2 className="text-lg font-semibold">{t('matchTitle')}</h2>
          <p className="text-sm text-[--foreground-muted]">{t('matchLead')}</p>
          <AssignForm
            requestId={id}
            candidates={(candidates ?? []).map((c) => ({
              expert_user_id: c.expert_user_id,
              name: localised(c, 'full_name', l),
              domain_overlap: c.domain_overlap,
              has_evidence: c.has_evidence,
              current_load: Number(c.current_load),
              max_concurrent_load: c.max_concurrent_load,
            }))}
          />
        </section>
      ) : null}

      {(request.consultation_assignments ?? []).length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">{t('assignmentsTitle')}</h2>
          <ul className="space-y-2">
            {(request.consultation_assignments ?? []).map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-[--border] p-4 text-sm"
              >
                <span className="font-medium">
                  {a.users ? localised(a.users, 'full_name', l) : ''}
                </span>
                <span className="flex flex-wrap items-center gap-3">
                  {a.decline_reason ? (
                    <span className="text-xs text-[--foreground-muted]">{a.decline_reason}</span>
                  ) : null}
                  <MetaPill>{tState(a.state)}</MetaPill>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('threadTitle')}</h2>
        {thread.length === 0 ? (
          <p className="text-sm text-[--foreground-muted]">{t('emptyThread')}</p>
        ) : (
          <ul className="space-y-3">
            {thread.map((m) => (
              <li key={m.id} className="border-s-2 border-[--border] bg-[--surface] p-4">
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    {m.sender ? localised(m.sender, 'full_name', l) : t('unknownSender')}
                  </span>
                  <time dateTime={isoDate(m.sent_at)} className="text-xs text-[--foreground-muted]">
                    {formatDateTime(m.sent_at, l)}
                  </time>
                </div>
                <p className="whitespace-pre-wrap text-sm">{m.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
