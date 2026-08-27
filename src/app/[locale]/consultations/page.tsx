import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {MessagesSquare, Clock, UserCheck, ClipboardCheck} from 'lucide-react';
import {PageHeading} from '@/components/public/page-heading';
import {BinaryBar} from '@/components/binary-bar';
import {getExpertiseDomains} from '@/lib/queries/consultations';
import {localised} from '@/lib/utils';
import type {Locale} from '@/i18n/routing';

/**
 * M2's public face — the Graduation Project Gateway.
 *
 * Anonymous visitors can read what the service is and which fields the club can help
 * with (expertise_domains is public reference data), but raising a request needs an
 * account, so the CTA points at sign-in rather than at a form that would fail.
 */
export default async function ConsultationsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const t = await getTranslations('consultations');
  const domains = await getExpertiseDomains();

  const steps = [
    {icon: MessagesSquare, key: 'submit'},
    {icon: ClipboardCheck, key: 'triage'},
    {icon: UserCheck, key: 'assign'},
    {icon: Clock, key: 'resolve'},
  ] as const;

  return (
    <>
      <PageHeading title={t('publicTitle')} lead={t('publicLead')} />

      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold">{t('howTitle')}</h2>
        <ol className="grid gap-4 sm:grid-cols-2">
          {steps.map((s, i) => (
            <li key={s.key} className="hmk-card flex gap-4 p-5">
              <span
                className="font-accent text-2xl text-hmk-red"
                aria-hidden="true"
                dir="ltr"
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="space-y-1">
                <p className="flex items-center gap-2 font-medium">
                  <s.icon className="h-4 w-4 text-hmk-red" aria-hidden="true" />
                  {t(`steps.${s.key}.title`)}
                </p>
                <p className="text-sm text-[--foreground-muted]">{t(`steps.${s.key}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <BinaryBar />

      {domains.length > 0 ? (
        <section className="my-12">
          <h2 className="mb-4 text-lg font-semibold">{t('domainsTitle')}</h2>
          <ul className="flex flex-wrap gap-2">
            {domains.map((d) => (
              <li
                key={d.id}
                className="rounded-[--radius-control] border border-[--border] px-3 py-1.5 text-sm"
              >
                {localised(d, 'name', l)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4">
        {/* BR-08 is a promise to the student, so it belongs on the public page. */}
        <p className="text-sm text-[--foreground-muted]">{t('slaPublicNote')}</p>
        <Link
          href="/me/consultations/new"
          className="inline-block rounded-[--radius-control] bg-hmk-red px-5 py-2.5 text-sm
                     font-semibold text-white transition-colors hover:bg-hmk-red-hover"
        >
          {t('startRequest')}
        </Link>
      </section>
    </>
  );
}
