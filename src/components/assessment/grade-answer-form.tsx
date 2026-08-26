'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {gradeAnswer, type GradingState} from '@/lib/assessment/grading-actions';

export function GradeAnswerForm({
  answerId,
  weight,
  currentScore,
  isOverride,
  originalScore,
}: {
  answerId: string;
  weight: number;
  currentScore: number | null;
  isOverride: boolean;
  originalScore: number | null;
}) {
  const t = useTranslations('grading');
  const tErr = useTranslations('grading.errors');
  const [state, formAction, pending] = useActionState<GradingState, FormData>(
    gradeAnswer,
    undefined
  );

  const amending = currentScore !== null;

  return (
    <form action={formAction} className="space-y-3 border-t border-[--border] pt-4">
      <input type="hidden" name="answerId" value={answerId} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor={`score-${answerId}`} className="block text-xs font-medium">
            {t('score', {max: weight})}
          </label>
          <input
            id={`score-${answerId}`}
            name="awardedScore"
            type="number"
            min="0"
            max={weight}
            step="0.5"
            defaultValue={currentScore ?? ''}
            required
            dir="ltr"
            className="w-28 rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm"
          />
        </div>

        <div className="min-w-[16rem] flex-1 space-y-1.5">
          <label htmlFor={`comment-${answerId}`} className="block text-xs font-medium">
            {amending ? t('amendReason') : t('comment')}
          </label>
          <input
            id={`comment-${answerId}`}
            name="comment"
            // BR-09: changing a recorded grade must be justified. The database enforces
            // this; requiring it here just avoids a pointless round-trip.
            required={amending}
            className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="rounded-[--radius-control] bg-hmk-red px-4 py-2 text-xs font-semibold text-white
                     hover:bg-hmk-red-hover disabled:opacity-60"
        >
          {amending ? t('amend') : t('saveGrade')}
        </button>
      </div>

      {isOverride && originalScore !== null ? (
        <p className="text-xs text-[--foreground-muted]">
          {t('amendedFrom', {original: originalScore})}
        </p>
      ) : null}

      {state?.error ? (
        <p role="alert" className="text-xs text-hmk-red">{tErr(state.error)}</p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="text-xs text-[--foreground-muted]">{t('graded')}</p>
      ) : null}
    </form>
  );
}
