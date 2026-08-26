'use client';

import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';
import {PackageCheck, AlertTriangle} from 'lucide-react';
import {issueCheckout, type LogisticsState} from '@/lib/logistics/actions';

type Holder = {
  id: string;
  student_user_id: string;
  name: string;
  cohort: string;
  openLiabilities: number;
};
type Unit = {id: string; asset_type_id: string; asset_tag: string; label: string};
type BulkType = {id: string; label: string; is_consumable: boolean};

export function IssueForm({
  holders,
  units,
  bulkTypes,
  isAdmin,
  defaultLoanDays,
}: {
  holders: Holder[];
  units: Unit[];
  bulkTypes: BulkType[];
  isAdmin: boolean;
  defaultLoanDays: number;
}) {
  const t = useTranslations('desk');
  const tErr = useTranslations('desk.errors');
  const [holderId, setHolderId] = useState('');
  const [state, formAction, pending] = useActionState<LogisticsState, FormData>(
    issueCheckout,
    undefined
  );

  const holder = holders.find((h) => h.id === holderId);
  // BR-13 blocks new custody while any liability is unresolved. Warn at selection time
  // rather than letting the clerk fill in the whole form for a guaranteed rejection.
  const blocked = (holder?.openLiabilities ?? 0) > 0;

  const due = new Date();
  due.setDate(due.getDate() + defaultLoanDays);
  const dueDefault = due.toISOString().slice(0, 16);

  return (
    <form action={formAction} className="hmk-card space-y-5 p-6">
      <input type="hidden" name="holderUserId" value={holder?.student_user_id ?? ''} />

      <div className="space-y-1.5">
        <label htmlFor="enrollmentId" className="block text-sm font-medium">{t('holder')}</label>
        <select
          id="enrollmentId"
          name="enrollmentId"
          required
          value={holderId}
          onChange={(e) => setHolderId(e.target.value)}
          className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm"
        >
          <option value="">{t('selectHolder')}</option>
          {holders.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name} — {h.cohort}
              {h.openLiabilities > 0 ? ` (${t('liabilityCount', {n: h.openLiabilities})})` : ''}
            </option>
          ))}
        </select>
      </div>

      {blocked ? (
        <div className="flex items-start gap-3 border-s-2 border-hmk-red bg-hmk-red-subtle px-4 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-hmk-red" aria-hidden="true" />
          <div className="space-y-2 text-sm">
            <p>{t('br13Blocked')}</p>
            {isAdmin ? (
              <div className="space-y-1.5">
                <label htmlFor="overrideJustification" className="block text-xs font-medium">
                  {t('overrideReason')}
                </label>
                <input
                  id="overrideJustification"
                  name="overrideJustification"
                  required
                  className="w-full rounded-[--radius-control] border border-[--border]
                             bg-[--surface] px-3 py-2 text-sm"
                />
                <p className="text-xs text-[--foreground-muted]">{t('overrideHint')}</p>
              </div>
            ) : (
              <p className="text-xs text-[--foreground-muted]">{t('br13AdminOnly')}</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="dueAt" className="block text-sm font-medium">{t('dueAt')}</label>
        <input
          id="dueAt"
          name="dueAt"
          type="datetime-local"
          required
          defaultValue={dueDefault}
          dir="ltr"
          className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('serializedUnits')}</legend>
        {units.length === 0 ? (
          <p className="text-sm text-[--foreground-muted]">{t('noUnits')}</p>
        ) : (
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {units.map((u) => (
              <label key={u.id} className="flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="unit"
                  value={`${u.asset_type_id}:${u.id}`}
                  className="h-4 w-4 accent-[--color-hmk-red]"
                />
                <span className="font-accent text-xs">{u.asset_tag}</span>
                <span className="text-[--foreground-muted]">{u.label}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      {bulkTypes.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('bulkItems')}</legend>
          {/* RR-3: consumables are issued like anything else but are excluded from the
              BR-01 return obligation, so the desk labels them rather than hiding them. */}
          {bulkTypes.map((b) => (
            <div key={b.id} className="flex items-center gap-3 text-sm">
              <label htmlFor={`bulk-${b.id}`} className="min-w-[14rem]">
                {b.label}
                {b.is_consumable ? (
                  <span className="ms-2 text-xs text-[--foreground-muted]">{t('consumable')}</span>
                ) : null}
              </label>
              <input
                id={`bulk-${b.id}`}
                type="number"
                min="0"
                defaultValue="0"
                dir="ltr"
                className="w-24 rounded-[--radius-control] border border-[--border] bg-[--surface] px-2 py-1 text-sm"
                onChange={(e) => {
                  const hidden = document.getElementById(`bulkval-${b.id}`) as HTMLInputElement | null;
                  if (hidden) hidden.value = `${b.id}:${e.target.value}`;
                  if (hidden) hidden.disabled = Number(e.target.value) <= 0;
                }}
              />
              <input id={`bulkval-${b.id}`} type="hidden" name="bulk" value={`${b.id}:0`} disabled />
            </div>
          ))}
        </fieldset>
      ) : null}

      <button
        type="submit"
        disabled={pending || !holderId || (blocked && !isAdmin)}
        className="inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-5 py-2.5
                   text-sm font-semibold text-white hover:bg-hmk-red-hover
                   disabled:cursor-not-allowed disabled:opacity-60"
      >
        <PackageCheck className="h-4 w-4" aria-hidden="true" />
        {pending ? t('issuing') : t('issue')}
      </button>

      {state?.error ? (
        <p role="alert" className="text-sm text-hmk-red">{tErr(state.error)}</p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="text-sm text-[--foreground-muted]">{t('issued')}</p>
      ) : null}
    </form>
  );
}
