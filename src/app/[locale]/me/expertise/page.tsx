import {getTranslations, setRequestLocale} from 'next-intl/server';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {MetaPill} from '@/components/public/meta-pill';
import {AvailabilityToggle} from '@/components/consultations/availability-toggle';
import {requireUser} from '@/lib/auth/session';
import {getMyExpertise} from '@/lib/queries/consultations';
import {localised} from '@/lib/utils';
import type {Locale} from '@/i18n/routing';

/**
 * D-06 — curated expertise, member-toggled availability.
 *
 * Proficiency and the load cap are shown but not editable: A4 curates them, and the
 * RPC behind the toggle writes `is_available` alone. Rendering them read-only is the
 * honest depiction of who owns what.
 */
export default async function MyExpertisePage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  await requireUser(l);

  const t = await getTranslations('consultations');
  const tProf = await getTranslations('enums.proficiency');
  const expertise = await getMyExpertise();

  return (
    <>
      <PageHeading title={t('expertiseTitle')} lead={t('expertiseLead')} />

      {expertise.length === 0 ? (
        <EmptyState message={t('emptyExpertise')} />
      ) : (
        <ul className="space-y-3">
          {expertise.map((e) => {
            const name = e.expertise_domains ? localised(e.expertise_domains, 'name', l) : '';
            return (
              <li
                key={e.id}
                className="hmk-card flex flex-wrap items-center justify-between gap-4 p-5"
              >
                <div className="space-y-1.5">
                  <p className="font-medium">{name}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[--foreground-muted]">
                    <MetaPill>{tProf(e.proficiency)}</MetaPill>
                    <span>{t('loadCap', {count: e.max_concurrent_load})}</span>
                  </div>
                </div>
                <AvailabilityToggle
                  expertiseId={e.id}
                  available={e.is_available}
                  label={t('toggleFor', {domain: name})}
                />
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-xs text-[--foreground-muted]">{t('curationNote')}</p>
    </>
  );
}
