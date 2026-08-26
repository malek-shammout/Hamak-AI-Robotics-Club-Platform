'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {ClipboardCheck} from 'lucide-react';
import {startAttempt, type AssessmentState} from '@/lib/assessment/actions';

export function StartAttemptButton({applicationId}: {applicationId: string}) {
  const t = useTranslations('screening');
  const tErr = useTranslations('screening.errors');
  const [state, formAction, pending] = useActionState<AssessmentState, FormData>(
    startAttempt,
    undefined
  );

  return (
    <div className="space-y-1">
      <form action={formAction}>
        <input type="hidden" name="applicationId" value={applicationId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-4 py-1.5
                     text-xs font-semibold text-white hover:bg-hmk-red-hover disabled:opacity-60"
        >
          <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {t('startTest')}
        </button>
      </form>
      {state?.error ? (
        <p role="alert" className="text-xs text-hmk-red">
          {tErr(state.error)}
        </p>
      ) : null}
    </div>
  );
}
