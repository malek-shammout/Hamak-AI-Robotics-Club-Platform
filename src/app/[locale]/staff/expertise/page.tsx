import {getTranslations, setRequestLocale} from 'next-intl/server';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {MetaPill} from '@/components/public/meta-pill';
import {
  DomainForm,
  DomainActiveToggle,
  CurateExpertiseForm,
  RemoveExpertiseButton,
} from '@/components/consultations/curation-forms';
import {requireUser} from '@/lib/auth/session';
import {
  getAllExpertiseDomains,
  getAllMemberExpertise,
  getCurationCandidates,
} from '@/lib/queries/consultations';
import {localised} from '@/lib/utils';
import type {Locale} from '@/i18n/routing';

/**
 * A4's expertise catalogue (D-06).
 *
 * Without this screen M2 cannot function at all: `suggest_experts` ranks over
 * `member_expertise`, so with nothing curated every consultation reaches triage and
 * then has nobody to go to. Curation is the half of D-06 the club owns; the member
 * owns only the availability flag, which is why there is no control for it here.
 */
export default async function StaffExpertisePage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  await requireUser(l);

  const t = await getTranslations('curation');
  const tProf = await getTranslations('enums.proficiency');

  const [domains, expertise, members] = await Promise.all([
    getAllExpertiseDomains(),
    getAllMemberExpertise(),
    getCurationCandidates(),
  ]);

  const activeDomains = domains.filter((d) => d.is_active);

  return (
    <>
      <PageHeading title={t('title')} lead={t('lead')} />

      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold">{t('domainsTitle')}</h2>

        {domains.length === 0 ? (
          <EmptyState message={t('emptyDomains')} />
        ) : (
          <ul className="mb-6 space-y-2">
            {domains.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-[--border] p-4"
              >
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-medium">{localised(d, 'name', l)}</span>
                  <span className="font-accent text-xs text-[--foreground-muted]" dir="ltr">
                    {d.code}
                  </span>
                </div>
                <DomainActiveToggle
                  domainId={d.id}
                  active={d.is_active}
                  label={t('toggleDomainFor', {domain: localised(d, 'name', l)})}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="hmk-card p-6">
          <h3 className="mb-4 text-sm font-semibold">{t('addDomain')}</h3>
          <DomainForm />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">{t('expertiseTitle')}</h2>

        {expertise.length === 0 ? (
          <EmptyState message={t('emptyExpertise')} />
        ) : (
          <ul className="mb-6 space-y-2">
            {expertise.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-[--border] p-4"
              >
                <div className="space-y-1">
                  <p className="font-medium">
                    {e.users ? localised(e.users, 'full_name', l) : ''}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[--foreground-muted]">
                    <span>{e.expertise_domains ? localised(e.expertise_domains, 'name', l) : ''}</span>
                    <MetaPill>{tProf(e.proficiency)}</MetaPill>
                    <span dir="ltr" className="font-accent">
                      {e.max_concurrent_load}
                    </span>
                    {/* Availability is shown, not editable — it belongs to the member. */}
                    <span>{e.is_available ? t('memberAvailable') : t('memberUnavailable')}</span>
                  </div>
                </div>
                <RemoveExpertiseButton
                  expertiseId={e.id}
                  label={t('removeFor', {
                    name: e.users ? localised(e.users, 'full_name', l) : '',
                  })}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="hmk-card p-6">
          <h3 className="mb-4 text-sm font-semibold">{t('addExpertise')}</h3>
          <CurateExpertiseForm
            members={members.map((m) => ({id: m.id, name: localised(m, 'full_name', l)}))}
            domains={activeDomains.map((d) => ({id: d.id, name: localised(d, 'name', l)}))}
          />
        </div>
      </section>
    </>
  );
}
