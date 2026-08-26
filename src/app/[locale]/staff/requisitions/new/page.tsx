import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {RaiseRequisitionForm} from '@/components/requisitions/raise-form';
import {requireUser} from '@/lib/auth/session';
import {getMyProjects, getRequestableAssetTypes} from '@/lib/queries/requisitions';
import {localised} from '@/lib/utils';
import type {Locale} from '@/i18n/routing';

export default async function NewRequisitionPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await requireUser(l);

  const t = await getTranslations('requisitions');

  // No M5 permission is required to ASK — only membership of the project. D-18.
  const [projects, types] = await Promise.all([
    getMyProjects(user.id),
    getRequestableAssetTypes(),
  ]);

  return (
    <>
      <Link href="/staff/requisitions" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToList')}
      </Link>
      <PageHeading title={t('raise')} lead={t('raiseLead')} />

      {projects.length === 0 ? (
        <EmptyState message={t('noProjects')} />
      ) : (
        <RaiseRequisitionForm
          projects={projects.map((p) => ({
            id: p!.id,
            code: p!.code,
            label: `${localised(p!, 'title', l)} (${p!.code})`,
          }))}
          assetTypes={types.map((a) => ({
            id: a.id,
            label: [a.name, a.manufacturer, a.model].filter(Boolean).join(' · '),
            tracking_mode: a.tracking_mode,
            is_consumable: a.is_consumable,
          }))}
        />
      )}
    </>
  );
}
