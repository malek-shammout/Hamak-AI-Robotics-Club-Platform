'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {Calculator} from 'lucide-react';
import {computeCohortReadiness, type ReadinessState} from '@/lib/admissions/readiness-actions';

export function ComputeReadinessButton({cohortId}: {cohortId: string}) {
  const t = useTranslations('staff');
  const [state, formAction, pending] = useActionState<ReadinessState, FormData>(
    computeCohortReadiness,
    undefined
  );

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="cohortId" value={cohortId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-[--radius-control] border
                     border-[--border] px-4 py-2 text-sm font-semibold transition-colors
                     hover:border-hmk-red hover:text-hmk-red disabled:opacity-60"
        >
          <Calculator className="h-4 w-4" aria-hidden="true" />
          {pending ? t('computing') : t('computeReadiness')}
        </button>
      </form>
      {state && 'error' in state ? (
        <p role="alert" className="text-sm text-hmk-red">{t(`errors.${state.error}`)}</p>
      ) : null}
      {state && 'ok' in state ? (
        <p role="status" className="text-sm text-[--foreground-muted]">
          {t('readinessResult', {scored: state.scored})}
        </p>
      ) : null}
    </div>
  );
}
