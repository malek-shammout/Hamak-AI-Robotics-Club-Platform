import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {MetaPill} from '@/components/public/meta-pill';
import {getSessionUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {getAssetCatalogue} from '@/lib/queries/logistics';
import {localised} from '@/lib/utils';
import type {Locale} from '@/i18n/routing';

export default async function AssetCataloguePage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect({href: '/login', locale: l});
  if (!(await hasPermission('M5.READ'))) redirect({href: '/', locale: l});

  const t = await getTranslations('assets');
  const types = await getAssetCatalogue();

  return (
    <>
      <PageHeading title={t('title')} lead={t('lead')} />

      <Link href="/staff/desk" className="mb-6 inline-block text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToDesk')}
      </Link>

      {types.length === 0 ? (
        <EmptyState message={t('empty')} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[--border] text-xs uppercase text-[--foreground-muted]">
                <th scope="col" className="p-2 text-start">{t('item')}</th>
                <th scope="col" className="p-2 text-start">{t('category')}</th>
                <th scope="col" className="p-2 text-start">{t('tracking')}</th>
                <th scope="col" className="p-2 text-start">{t('available')}</th>
                <th scope="col" className="p-2 text-start">{t('unitCost')}</th>
              </tr>
            </thead>
            <tbody>
              {types.map((ty) => {
                const serialized = ty.tracking_mode === 'SERIALIZED';
                const avail = serialized
                  ? (ty.availability?.serialized_available ?? 0)
                  : (ty.availability?.bulk_available ?? 0);
                const low = !serialized && avail <= (ty.low_stock_threshold ?? 0);

                return (
                  <tr key={ty.id} className="border-b border-[--border]">
                    <td className="p-2">
                      {ty.name}
                      <span className="block text-xs text-[--foreground-muted]">
                        {[ty.manufacturer, ty.model].filter(Boolean).join(' · ')}
                      </span>
                    </td>
                    <td className="p-2 text-[--foreground-muted]">
                      {ty.asset_categories ? localised(ty.asset_categories, 'name', l) : '-'}
                    </td>
                    <td className="p-2">
                      <MetaPill>{t(`tracking_modes.${ty.tracking_mode}`)}</MetaPill>
                      {ty.is_consumable ? (
                        <MetaPill>{t('consumable')}</MetaPill>
                      ) : null}
                    </td>
                    <td className="p-2 font-accent">
                      {avail}
                      {low ? (
                        <span className="ms-2 text-xs text-hmk-red">{t('lowStock')}</span>
                      ) : null}
                    </td>
                    <td className="p-2 font-accent text-xs">
                      {ty.unit_cost ?? '-'} {ty.currency ?? ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
