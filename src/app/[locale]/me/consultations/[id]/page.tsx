import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {MetaPill} from '@/components/public/meta-pill';
import {MessageForm} from '@/components/consultations/message-form';
import {ResolveForm} from '@/components/consultations/resolve-form';
import {requireUser} from '@/lib/auth/session';
import {getConsultation, getThread} from '@/lib/queries/consultations';
import {localised} from '@/lib/utils';
import {formatDate, formatDateTime, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function ConsultationThreadPage({
  params,
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await requireUser(l);

  // RLS decides visibility. A non-participant gets no row, which is a 404 — not a 403,
  // because confirming that an id exists is itself a disclosure.
  const request = await getConsultation(id);
  if (!request) notFound();

  const t = await getTranslations('consultations');
  const tStatus = await getTranslations('enums.consultationStatus');
  const tSupport = await getTranslations('enums.supportType');
  const tOutcome = await getTranslations('enums.consultationOutcome');

  const messages = await getThread(id);

  const closed = request.status === 'RESOLVED' || request.status === 'REJECTED';
  const acceptedAssignment = (request.consultation_assignments ?? []).find(
    (a) => a.state === 'ACCEPTED'
  );
  const isAssignedExpert = acceptedAssignment?.expert_user_id === user.id;

  return (
    <>
      <Link href="/me/consultations" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToMine')}
      </Link>

      <PageHeading title={request.title} />

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <MetaPill>{tStatus(request.status)}</MetaPill>
        <MetaPill>{tSupport(request.support_type)}</MetaPill>
        <span className="font-accent text-xs text-[--foreground-muted]" dir="ltr">
          {request.reference_no}
        </span>
      </div>

      {request.abstract ? (
        <section className="hmk-card mb-8 p-5">
          <h2 className="mb-2 text-sm font-semibold">{t('fieldAbstract')}</h2>
          <p className="whitespace-pre-wrap text-sm text-[--foreground-muted]">
            {request.abstract}
          </p>
        </section>
      ) : null}

      {(request.consultation_request_domains ?? []).length > 0 ? (
        <ul className="mb-8 flex flex-wrap gap-2">
          {(request.consultation_request_domains ?? []).map((d, i) =>
            d.expertise_domains ? (
              <li
                key={i}
                className="rounded-[--radius-control] border border-[--border] px-3 py-1 text-xs"
              >
                {localised(d.expertise_domains, 'name', l)}
              </li>
            ) : null
          )}
        </ul>
      ) : null}

      {request.status === 'RESOLVED' && request.outcome_category ? (
        <section className="mb-8 border-s-2 border-hmk-red bg-hmk-red-subtle px-4 py-3">
          <p className="text-sm font-medium">{tOutcome(request.outcome_category)}</p>
          {request.outcome_summary ? (
            <p className="mt-1 whitespace-pre-wrap text-sm text-[--foreground-muted]">
              {request.outcome_summary}
            </p>
          ) : null}
          {request.closed_at ? (
            <time
              dateTime={isoDate(request.closed_at)}
              className="mt-2 block text-xs text-[--foreground-muted]"
            >
              {formatDate(request.closed_at, l)}
            </time>
          ) : null}
        </section>
      ) : null}

      <section className="mb-8 space-y-4">
        <h2 className="text-lg font-semibold">{t('threadTitle')}</h2>

        {messages.length === 0 ? (
          <p className="text-sm text-[--foreground-muted]">{t('emptyThread')}</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => {
              const mine = m.sender_user_id === user.id;
              return (
                <li
                  key={m.id}
                  className={`border-s-2 p-4 ${
                    mine ? 'border-hmk-red bg-hmk-red-subtle' : 'border-[--border] bg-[--surface]'
                  }`}
                >
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">
                      {/* Names come from get_consultation_participants, not a join —
                          `users` is self-scoped, so a join renders the counterpart blank. */}
                      {m.sender ? localised(m.sender, 'full_name', l) : t('unknownSender')}
                    </span>
                    <time
                      dateTime={isoDate(m.sent_at)}
                      className="text-xs text-[--foreground-muted]"
                    >
                      {formatDateTime(m.sent_at, l)}
                    </time>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{m.body}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {closed ? (
        <p className="text-sm text-[--foreground-muted]">{t('threadClosed')}</p>
      ) : (
        <MessageForm requestId={id} />
      )}

      {/* AD-7: the accepted expert records the outcome. The RPC also accepts M2.APPROVE,
          but a staff member closing someone else's case belongs on the staff screen. */}
      {isAssignedExpert && !closed ? <ResolveForm requestId={id} /> : null}
    </>
  );
}
