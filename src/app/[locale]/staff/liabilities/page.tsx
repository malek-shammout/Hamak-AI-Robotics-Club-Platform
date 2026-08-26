import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {MetaPill} from '@/components/public/meta-pill';
import {ResolveLiabilityForm} from '@/components/logistics/resolve-liability-form';
import {getSessionUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {getLiabilities} from '@/lib/queries/logistics';
import {localised} from '@/lib/utils';
import {formatDate, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

const OPEN = ['OPEN', 'UNDER_ASSESSMENT', 'PENDING_SETTLEMENT'];

export default async function LiabilitiesPage({
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

  const t = await getTranslations('liabilities');
  const [rows, mayResolve, isAdmin] = await Promise.all([
    getLiabilities(),
    hasPermission('M5.UPDATE'),
    hasPermission('M10.OVERRIDE'),
  ]);

  const open = rows.filter((r) => OPEN.includes(r.status));

  return (
    <>
      <PageHeading title={t('title')} lead={t('lead')} />

      <Link href="/staff/desk" className="mb-4 inline-block text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToDesk')}
      </Link>

      {/* BR-13 is why this queue matters operationally: every open row here is blocking
          that person from taking out anything else, anywhere in the club. */}
      <p className="mb-6 max-w-2xl border-s-2 border-hmk-red bg-hmk-red-subtle px-4 py-2 text-sm">
        {t('br13Note', {n: open.length})}
      </p>

      {rows.length === 0 ? (
        <EmptyState message={t('empty')} />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const isOpen = OPEN.includes(r.status);
            return (
              <li key={r.id} className="hmk-card space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {r.users ? localised(r.users, 'full_name', l) : '-'}
                    </p>
                    <p className="mt-1 text-xs text-[--foreground-muted]">
                      {r.checkout_lines?.asset_types?.name}
                      {r.checkout_lines?.asset_units?.asset_tag ? (
                        <> · <span className="font-accent">{r.checkout_lines.asset_units.asset_tag}</span></>
                      ) : null}
                      {' · '}
                      <time dateTime={isoDate(r.created_at)}>{formatDate(r.created_at, l)}</time>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <MetaPill>{t(`types.${r.liability_type}`)}</MetaPill>
                    <MetaPill tone={isOpen ? 'accent' : 'default'}>
                      {t(`statuses.${r.status}`)}
                    </MetaPill>
                    <MetaPill>
                      {r.assessed_value ?? 0} {r.currency ?? 'SYP'}
                    </MetaPill>
                  </div>
                </div>

                {r.status === 'RESOLVED_WAIVED' && r.waiver_justification ? (
                  <p className="text-xs text-[--foreground-muted]">
                    {t('waivedBecause', {reason: r.waiver_justification})}
                  </p>
                ) : r.resolution_note ? (
                  <p className="text-xs text-[--foreground-muted]">{r.resolution_note}</p>
                ) : null}

                {isOpen && mayResolve ? (
                  <ResolveLiabilityForm liabilityId={r.id} isAdmin={isAdmin} />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
