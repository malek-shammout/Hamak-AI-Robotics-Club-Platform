import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {MetaPill} from '@/components/public/meta-pill';
import {CheckInForm} from '@/components/logistics/check-in-form';
import {getSessionUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {getCheckout} from '@/lib/queries/logistics';
import {localised} from '@/lib/utils';
import {formatDate, formatDateTime, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

const OUTSTANDING = ['ACTIVE', 'OVERDUE'];

export default async function CheckoutDetailPage({
  params,
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect({href: '/login', locale: l});
  if (!(await hasPermission('M5.READ'))) redirect({href: '/', locale: l});

  const t = await getTranslations('desk');
  const checkout = await getCheckout(id);
  if (!checkout) notFound();

  const mayCheckIn = await hasPermission('M5.UPDATE');
  const lines = checkout.checkout_lines ?? [];

  return (
    <article>
      <Link href="/staff/checkouts" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToOutstanding')}
      </Link>

      <PageHeading
        title={checkout.users ? localised(checkout.users, 'full_name', l) : checkout.checkout_no}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <MetaPill tone="accent">{checkout.checkout_no}</MetaPill>
        <MetaPill>{t(`checkoutStates.${checkout.status}`)}</MetaPill>
        <MetaPill>
          {t('due')}{' '}
          <time dateTime={isoDate(checkout.due_at)}>{formatDate(checkout.due_at, l)}</time>
        </MetaPill>
      </div>

      {checkout.issued_under_override && checkout.override_justification ? (
        <p className="mb-6 max-w-2xl border-s-2 border-hmk-red bg-hmk-red-subtle px-4 py-2 text-sm">
          {t('overrideNotice', {reason: checkout.override_justification})}
        </p>
      ) : null}

      <ul className="space-y-3">
        {lines.map((line) => {
          const outstanding = OUTSTANDING.includes(line.status);
          const label = [line.asset_types?.name, line.asset_units?.asset_tag]
            .filter(Boolean)
            .join(' · ');

          return (
            <li key={line.id} className="hmk-card space-y-3 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{line.asset_types?.name}</p>
                  <p className="mt-1 text-xs text-[--foreground-muted]">
                    {line.asset_units?.asset_tag ? (
                      <span className="font-accent">{line.asset_units.asset_tag}</span>
                    ) : (
                      t('quantity', {n: line.quantity})
                    )}
                    {/* RR-3: consumables are excluded from the BR-01 return obligation,
                        so the desk says so instead of leaving the clerk guessing. */}
                    {line.asset_types?.is_consumable ? ` · ${t('consumableExcluded')}` : ''}
                  </p>
                </div>
                <MetaPill tone={outstanding ? 'accent' : 'default'}>
                  {t(`lineStates.${line.status}`)}
                </MetaPill>
              </div>

              {!outstanding && line.returned_at ? (
                <p className="text-xs text-[--foreground-muted]">
                  {t('returnedOn')}{' '}
                  <time dateTime={isoDate(line.returned_at)}>
                    {formatDateTime(line.returned_at, l)}
                  </time>
                  {line.condition_at_return ? ` · ${t(`conditions.${line.condition_at_return}`)}` : ''}
                  {line.inspection_notes ? ` · ${line.inspection_notes}` : ''}
                </p>
              ) : null}

              {outstanding && mayCheckIn ? (
                <CheckInForm
                  lineId={line.id}
                  label={label}
                  suggestedValue={
                    line.asset_types?.unit_cost === null || line.asset_types?.unit_cost === undefined
                      ? null
                      : Number(line.asset_types.unit_cost)
                  }
                  currency={line.asset_types?.currency ?? null}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </article>
  );
}
