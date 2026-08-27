import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {RequestForm} from '@/components/consultations/request-form';
import {requireUser} from '@/lib/auth/session';
import {getExpertiseDomains} from '@/lib/queries/consultations';
import {localised} from '@/lib/utils';
import type {Locale} from '@/i18n/routing';

export default async function NewConsultationPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  await requireUser(l);

  const t = await getTranslations('consultations');
  const domains = await getExpertiseDomains();

  return (
    <>
      <Link href="/me/consultations" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToMine')}
      </Link>

      <PageHeading title={t('newTitle')} lead={t('newLead')} />

      <RequestForm
        domains={domains.map((d) => ({id: d.id, code: d.code, name: localised(d, 'name', l)}))}
      />
    </>
  );
}
