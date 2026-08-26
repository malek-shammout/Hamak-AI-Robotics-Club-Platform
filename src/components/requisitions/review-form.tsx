'use client';

import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';
import {CheckCheck, XCircle} from 'lucide-react';
import {
  approveRequisition,
  rejectRequisition,
  type RequisitionState,
} from '@/lib/requisitions/actions';

type Line = {
  id: string;
  label: string;
  requested: number;
  available: number | null;
  tracking: string;
};

export function ReviewRequisitionForm({
  requisitionId,
  lines,
  isRequester,
}: {
  requisitionId: string;
  lines: Line[];
  isRequester: boolean;
}) {
  const t = useTranslations('requisitions');
  const tErr = useTranslations('requisitions.errors');
  const [approved, setApproved] = useState<Record<string, number>>(
    Object.fromEntries(lines.map((l) => [l.id, l.requested]))
  );
  const [aState, approveAction, approving] = useActionState<RequisitionState, FormData>(
    approveRequisition,
    undefined
  );
  const [rState, rejectAction, rejecting] = useActionState<RequisitionState, FormData>(
    rejectRequisition,
    undefined
  );

  // D-18 is enforced in the database on IDENTITY, not role. Showing the reason here
  // spares the approver a rejected click and explains WHY.
  if (isRequester) {
    return (
      <div className="border-s-2 border-hmk-red bg-hmk-red-subtle px-4 py-3 text-sm">
        <p className="font-medium">{t('sodTitle')}</p>
        <p className="text-[--foreground-muted]">{t('sodBody')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form action={approveAction} className="space-y-4">
        <input type="hidden" name="requisitionId" value={requisitionId} />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[--border] text-xs uppercase text-[--foreground-muted]">
                <th scope="col" className="p-2 text-start">{t('item')}</th>
                <th scope="col" className="p-2 text-start">{t('requested')}</th>
                <th scope="col" className="p-2 text-start">{t('availableNow')}</th>
                <th scope="col" className="p-2 text-start">{t('approve')}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const short = l.available !== null && l.available < (approved[l.id] ?? 0);
                return (
                  <tr key={l.id} className="border-b border-[--border]">
                    <td className="p-2">{l.label}</td>
                    <td className="p-2 font-accent">{l.requested}</td>
                    <td className="p-2 font-accent">
                      {l.available ?? '-'}
                      {short ? (
                        <span className="ms-2 text-xs text-hmk-red">{t('short')}</span>
                      ) : null}
                    </td>
                    <td className="p-2">
                      <label htmlFor={`ap-${l.id}`} className="sr-only">
                        {t('approveFor', {item: l.label})}
                      </label>
                      <input
                        id={`ap-${l.id}`}
                        type="number"
                        min="0"
                        max={l.requested}
                        value={approved[l.id] ?? 0}
                        dir="ltr"
                        onChange={(e) =>
                          setApproved({...approved, [l.id]: Number(e.target.value)})
                        }
                        className="w-24 rounded-[--radius-control] border border-[--border]
                                   bg-[--surface] px-2 py-1 text-sm"
                      />
                      <input type="hidden" name="approval" value={`${l.id}:${approved[l.id] ?? 0}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* RR-1: approving reserves the stock. Say so, because the shelf figure moves. */}
        <p className="text-xs text-[--foreground-muted]">{t('reservationNote')}</p>

        <div className="space-y-1.5">
          <label htmlFor="note" className="block text-xs font-medium">{t('reviewNote')}</label>
          <input
            id="note"
            name="note"
            className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={approving}
          className="inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-5 py-2.5
                     text-sm font-semibold text-white hover:bg-hmk-red-hover disabled:opacity-60"
        >
          <CheckCheck className="h-4 w-4" aria-hidden="true" />
          {approving ? t('approving') : t('approveAndReserve')}
        </button>

        {aState?.error ? <p role="alert" className="text-sm text-hmk-red">{tErr(aState.error)}</p> : null}
      </form>

      <form action={rejectAction} className="space-y-2 border-t border-[--border] pt-4">
        <input type="hidden" name="requisitionId" value={requisitionId} />
        <label htmlFor="reason" className="block text-xs font-medium">{t('rejectReason')}</label>
        <div className="flex flex-wrap gap-3">
          <input
            id="reason"
            name="reason"
            required
            className="min-w-[18rem] flex-1 rounded-[--radius-control] border border-[--border]
                       bg-[--surface] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={rejecting}
            className="inline-flex items-center gap-2 rounded-[--radius-control] border
                       border-[--border] px-4 py-2 text-sm font-semibold hover:border-hmk-red
                       hover:text-hmk-red disabled:opacity-60"
          >
            <XCircle className="h-4 w-4" aria-hidden="true" />
            {t('reject')}
          </button>
        </div>
        {rState?.error ? <p role="alert" className="text-sm text-hmk-red">{tErr(rState.error)}</p> : null}
      </form>
    </div>
  );
}
