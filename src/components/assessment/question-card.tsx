'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {saveAnswer, type AssessmentState} from '@/lib/assessment/actions';
import type {PaperQuestion} from '@/lib/queries/assessment';

export function QuestionCard({
  attemptId,
  question,
  index,
}: {
  attemptId: string;
  question: PaperQuestion;
  index: number;
}) {
  const t = useTranslations('screening');
  const tErr = useTranslations('screening.errors');
  const [state, formAction, pending] = useActionState<AssessmentState, FormData>(
    saveAnswer,
    undefined
  );

  const name = `q-${question.question_id}`;

  return (
    <li className="hmk-card p-5">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="attemptId" value={attemptId} />
        <input type="hidden" name="questionId" value={question.question_id} />

        <fieldset className="space-y-3">
          <legend className="flex items-baseline gap-3">
            <span className="font-accent text-hmk-red">{index + 1}</span>
            <span className="font-medium">{question.stem}</span>
            <span className="ms-auto text-xs text-[--foreground-muted]">
              {t('points', {points: question.weight})}
            </span>
          </legend>

          {(question.options ?? []).map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="radio"
                name="selectedOptionId"
                value={o.id}
                defaultChecked={question.saved_option_id === o.id}
                className="h-4 w-4 accent-[--color-hmk-red]"
              />
              <span>{o.text}</span>
            </label>
          ))}
        </fieldset>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-[--radius-control] border border-[--border] px-4 py-1.5 text-xs
                       font-semibold transition-colors hover:border-hmk-red hover:text-hmk-red
                       disabled:opacity-60"
          >
            {t('saveAnswer')}
          </button>
          {state?.ok ? (
            <span role="status" className="text-xs text-[--foreground-muted]">
              {t('saved')}
            </span>
          ) : null}
          {state?.error ? (
            <span role="alert" className="text-xs text-hmk-red">
              {tErr(state.error)}
            </span>
          ) : null}
        </div>
      </form>
    </li>
  );
}
