'use client';

import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';
import {resolveLiability, type LogisticsState} from '@/lib/logistics/actions';

const NON_TERMINAL = ['UNDER_ASSESSMENT', 'PENDING_SETTLEMENT'];
const TERMINAL = ['RESOLVED_REPAIRED', 'RESOLVED_REPLACED', 'RESOLVED_SETTLED'];

export function ResolveLiabilityForm({
  liabilityId,
  isAdmin,
}: {
  liabilityId: string;
  isAdmin: boolean;
}) {
  const t = useTranslations('liabilities');
  const tErr = useTranslations('desk.errors');
  const [status, setStatus] = useState('UNDER_ASSESSMENT');
  const [state, formAction, pending] = useActionState<LogisticsState, FormData>(
    resolveLiability,
    undefined
  );

  const waiving = status === 'RESOLVED_WAIVED';
  const replacing = status === 'RESOLVED_REPLACED';

  return (
    <form action={formAction} className="space-y-3 border-t border-[--border] pt-4">
      <input type="hidden" name="liabilityId" value={liabilityId} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor={`st-${liabilityId}`} className="block text-xs font-medium">
            {t('resolveAs')}
          </label>
          <select
            id={`st-${liabilityId}`}
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm"
          >
            {[...NON_TERMINAL, ...TERMINAL].map((s) => (
              <option key={s} value={s}>{t(`statuses.${s}`)}</option>
            ))}
            {/* BR-06 makes the waiver an A7 act. The database refuses it for anyone
                else (WAIVER_REQUIRES_ADMIN); hiding it here is courtesy, not the
                enforcement. See claude.md D-13. */}
            {isAdmin ? (
              <option value="RESOLVED_WAIVED">{t('statuses.RESOLVED_WAIVED')}</option>
            ) : null}
          </select>
        </div>

        <div className="min-w-[16rem] flex-1 space-y-1.5">
          <label htmlFor={`note-${liabilityId}`} className="block text-xs font-medium">
            {waiving ? t('waiverJustification') : t('note')}
          </label>
          <input
            id={`note-${liabilityId}`}
            name="note"
            required={waiving}
            className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm"
          />
        </div>

        {replacing ? (
          <div className="space-y-1.5">
            <label htmlFor={`rep-${liabilityId}`} className="block text-xs font-medium">
              {t('replacementUnitId')}
            </label>
            <input
              id={`rep-${liabilityId}`}
              name="replacementUnitId"
              required
              dir="ltr"
              className="w-72 rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm"
            />
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-[--radius-control] bg-hmk-red px-4 py-2 text-xs font-semibold text-white
                     hover:bg-hmk-red-hover disabled:opacity-60"
        >
          {pending ? t('saving') : t('apply')}
        </button>
      </div>

      {waiving ? (
        <p className="text-xs text-[--foreground-muted]">{t('waiverAudited')}</p>
      ) : null}
      {state?.error ? (
        <p role="alert" className="text-xs text-hmk-red">{tErr(state.error)}</p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="text-xs text-[--foreground-muted]">{t('resolved')}</p>
      ) : null}
    </form>
  );
}
