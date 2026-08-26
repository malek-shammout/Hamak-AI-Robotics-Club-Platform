'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {ListOrdered} from 'lucide-react';
import {runAllocation, type AllocationState} from '@/lib/admissions/staff-actions';

export function RunAllocationButton({cohortId}: {cohortId: string}) {
  const t = useTranslations('staff');
  const [state, formAction, pending] = useActionState<AllocationState, FormData>(
    runAllocation,
    undefined
  );

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="cohortId" value={cohortId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-4 py-2
                     text-sm font-semibold text-white transition-colors hover:bg-hmk-red-hover
                     disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ListOrdered className="h-4 w-4" aria-hidden="true" />
          {pending ? t('allocating') : t('runAllocation')}
        </button>
      </form>

      {state && 'error' in state ? (
        <p role="alert" className="text-sm text-hmk-red">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}

      {state && 'ok' in state ? (
        <p role="status" className="text-sm text-[--foreground-muted]">
          {t('allocationResult', {
            offered: state.offered,
            waitlisted: state.waitlisted,
            rejected: state.rejected,
          })}
        </p>
      ) : null}
    </div>
  );
}
