'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {submitAttempt, type AssessmentState} from '@/lib/assessment/actions';

export function SubmitAttempt({attemptId}: {attemptId: string}) {
  const t = useTranslations('screening');
  const tErr = useTranslations('screening.errors');
  const [state, formAction, pending] = useActionState<AssessmentState, FormData>(
    submitAttempt,
    undefined
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="attemptId" value={attemptId} />
      <p className="text-sm text-[--foreground-muted]">{t('submitWarning')}</p>
      <button
        type="submit"
        disabled={pending}
        className="rounded-[--radius-control] bg-hmk-red px-5 py-2.5 text-sm font-semibold
                   text-white transition-colors hover:bg-hmk-red-hover disabled:opacity-60"
      >
        {pending ? t('submitting') : t('submitTest')}
      </button>
      {state?.error ? (
        <p role="alert" className="text-sm text-hmk-red">
          {tErr(state.error)}
        </p>
      ) : null}
    </form>
  );
}
