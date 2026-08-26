import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {MetaPill} from '@/components/public/meta-pill';
import {ReviewRequisitionForm} from '@/components/requisitions/review-form';
import {requireUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {getRequisition} from '@/lib/queries/requisitions';
import {localised} from '@/lib/utils';
import {formatDate, formatDateTime, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function RequisitionDetailPage({
  params,
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await requireUser(l);

  const t = await getTranslations('requisitions');
  const req = await getRequisition(id);
  if (!req) notFound();

  const mayApprove = await hasPermission('M5.APPROVE');
  const isRequester = req.requester_user_id === user.id;
  const pending = req.status === 'PENDING';

  return (
    <article>
      <Link href="/staff/requisitions" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToList')}
      </Link>

      <PageHeading
        title={req.projects ? localised(req.projects, 'title', l) : req.requisition_no}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <MetaPill tone="accent">{req.requisition_no}</MetaPill>
        <MetaPill>{t(`purposes.${req.purpose_type}`)}</MetaPill>
        <MetaPill tone={req.status === 'PENDING' ? 'accent' : 'default'}>
          {t(`statuses.${req.status}`)}
        </MetaPill>
        {req.required_by ? (
          <MetaPill>
            {t('by')}{' '}
            <time dateTime={isoDate(req.required_by)}>{formatDate(req.required_by, l)}</time>
          </MetaPill>
        ) : null}
      </div>

      <p className="mb-6 text-sm text-[--foreground-muted]">
        {t('raisedBy', {name: req.users ? localised(req.users, 'full_name', l) : '-'})}
      </p>

      {req.reviewed_at ? (
        <p className="mb-6 max-w-2xl border-s-2 border-[--border] bg-[--background] px-4 py-2 text-sm">
          {t('reviewedOn')}{' '}
          <time dateTime={isoDate(req.reviewed_at)}>{formatDateTime(req.reviewed_at, l)}</time>
          {req.review_reason ? ` — ${req.review_reason}` : ''}
        </p>
      ) : null}

      <section className="hmk-card p-6">
        <h2 className="mb-4 text-sm font-semibold">{t('items')}</h2>

        {pending && mayApprove ? (
          <ReviewRequisitionForm
            requisitionId={req.id}
            isRequester={isRequester}
            lines={(req.requisition_lines ?? []).map((line) => {
              const serialized = line.asset_types?.tracking_mode === 'SERIALIZED';
              const avail = serialized
                ? (line.availability?.serialized_available ?? null)
                : (line.availability?.bulk_available ?? null);
              return {
                id: line.id,
                label: [line.asset_types?.name, line.asset_types?.model]
                  .filter(Boolean)
                  .join(' · '),
                requested: line.quantity_requested,
                available: avail === null ? null : Number(avail),
                tracking: line.asset_types?.tracking_mode ?? 'BULK',
              };
            })}
          />
        ) : (
          <ul className="space-y-2 text-sm">
            {(req.requisition_lines ?? []).map((line) => (
              <li key={line.id} className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  {line.asset_types?.name}
                  {line.asset_types?.is_consumable ? (
                    <span className="ms-2 text-xs text-[--foreground-muted]">{t('consumable')}</span>
                  ) : null}
                </span>
                <span className="font-accent text-xs">
                  {t('requestedApproved', {
                    requested: line.quantity_requested,
                    approved: line.quantity_approved ?? 0,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
