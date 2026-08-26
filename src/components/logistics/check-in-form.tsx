'use client';

import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';
import {checkInLine, type LogisticsState} from '@/lib/logistics/actions';

export function CheckInForm({
  lineId,
  label,
  suggestedValue,
  currency,
}: {
  lineId: string;
  label: string;
  suggestedValue: number | null;
  currency: string | null;
}) {
  const t = useTranslations('desk');
  const tErr = useTranslations('desk.errors');
  const [condition, setCondition] = useState('HEALTHY');
  const [state, formAction, pending] = useActionState<LogisticsState, FormData>(
    checkInLine,
    undefined
  );

  // BR-06: Damaged or Lost opens a liability. Surface the assessed value here so the
  // clerk sets it deliberately instead of inheriting the catalogue price by accident.
  const opensLiability = condition !== 'HEALTHY';

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="lineId" value={lineId} />

      <fieldset className="flex flex-wrap items-center gap-4">
        <legend className="sr-only">{t('conditionFor', {item: label})}</legend>
        {['HEALTHY', 'DAMAGED', 'LOST'].map((c) => (
          <label key={c} className="flex cursor-pointer items-center gap-1.5 text-sm">
            <input
              type="radio"
              name="condition"
              value={c}
              checked={condition === c}
              onChange={() => setCondition(c)}
              className="h-4 w-4 accent-[--color-hmk-red]"
            />
            <span>{t(`conditions.${c}`)}</span>
          </label>
        ))}
      </fieldset>

      {opensLiability ? (
        <div className="space-y-2 border-s-2 border-hmk-red bg-hmk-red-subtle px-4 py-2">
          <p className="text-xs">{t('opensLiability')}</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label htmlFor={`val-${lineId}`} className="block text-xs font-medium">
                {t('assessedValue', {currency: currency ?? 'SYP'})}
              </label>
              <input
                id={`val-${lineId}`}
                name="assessedValue"
                type="number"
                min="0"
                step="0.01"
                defaultValue={suggestedValue ?? ''}
                dir="ltr"
                className="w-32 rounded-[--radius-control] border border-[--border] bg-[--surface] px-2 py-1 text-sm"
              />
            </div>
            <p className="text-xs text-[--foreground-muted]">{t('valueDefaultsToCost')}</p>
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor={`notes-${lineId}`} className="block text-xs font-medium">
          {t('inspectionNotes')}
        </label>
        <input
          id={`notes-${lineId}`}
          name="notes"
          required={opensLiability}
          className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-[--radius-control] bg-hmk-red px-4 py-1.5 text-xs font-semibold text-white
                   hover:bg-hmk-red-hover disabled:opacity-60"
      >
        {pending ? t('checkingIn') : t('checkIn')}
      </button>

      {state?.error ? (
        <p role="alert" className="text-xs text-hmk-red">{tErr(state.error)}</p>
      ) : null}
    </form>
  );
}
