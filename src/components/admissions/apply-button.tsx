'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {applyToCohort, type ActionState} from '@/lib/admissions/actions';

export function ApplyButton({
  cohortId,
  disabled,
  disabledLabel,
}: {
  cohortId: string;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const t = useTranslations('applications');
  const tErr = useTranslations('applications.errors');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    applyToCohort,
    undefined
  );

  if (disabled) {
    return (
      <span className="text-xs text-[--foreground-muted]">{disabledLabel}</span>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-3">
      <input type="hidden" name="cohortId" value={cohortId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-[--radius-control] bg-hmk-red px-4 py-1.5 text-xs font-semibold
                   text-white transition-colors hover:bg-hmk-red-hover
                   disabled:cursor-not-allowed disabled:opacity-60"
      >
        {t('apply')}
      </button>
      {state?.error ? (
        <span role="alert" className="text-xs text-hmk-red">
          {tErr(state.error)}
        </span>
      ) : null}
      {state?.ok ? (
        <span role="status" className="text-xs text-[--foreground-muted]">
          {t('applied')}
        </span>
      ) : null}
    </form>
  );
}
