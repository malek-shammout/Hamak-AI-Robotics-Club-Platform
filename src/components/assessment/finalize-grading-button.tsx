'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {CheckCheck} from 'lucide-react';
import {finalizeGrading, type GradingState} from '@/lib/assessment/grading-actions';

export function FinalizeGradingButton({attemptId}: {attemptId: string}) {
  const t = useTranslations('grading');
  const tErr = useTranslations('grading.errors');
  const [state, formAction, pending] = useActionState<GradingState, FormData>(
    finalizeGrading,
    undefined
  );

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="attemptId" value={attemptId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-5 py-2.5
                     text-sm font-semibold text-white hover:bg-hmk-red-hover disabled:opacity-60"
        >
          <CheckCheck className="h-4 w-4" aria-hidden="true" />
          {pending ? t('finalizing') : t('finalize')}
        </button>
      </form>
      <p className="text-xs text-[--foreground-muted]">{t('finalizeHint')}</p>
      {state?.error ? (
        <p role="alert" className="text-sm text-hmk-red">{tErr(state.error)}</p>
      ) : null}
    </div>
  );
}
