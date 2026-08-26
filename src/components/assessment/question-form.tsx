'use client';

import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';
import {createQuestion, type AuthoringState} from '@/lib/assessment/authoring-actions';

const CHOICE_TYPES = ['SINGLE_CHOICE', 'MULTI_CHOICE', 'TRUE_FALSE'];
const TYPES = ['SINGLE_CHOICE', 'MULTI_CHOICE', 'TRUE_FALSE', 'NUMERIC', 'SHORT_ANSWER', 'CODE'];
const SLOTS = [0, 1, 2, 3, 4, 5];

export function QuestionForm() {
  const t = useTranslations('bank');
  const tErr = useTranslations('bank.errors');
  const [type, setType] = useState('SINGLE_CHOICE');
  const [state, formAction, pending] = useActionState<AuthoringState, FormData>(
    createQuestion,
    undefined
  );

  const isChoice = CHOICE_TYPES.includes(type);
  const isMulti = type === 'MULTI_CHOICE';
  // Mirrors the server: auto_gradable is derived from type, so the rubric requirement
  // is derived too. Stated here only so the form can ask for it up front.
  const needsRubric = !isChoice;

  return (
    <form action={formAction} className="hmk-card max-w-2xl space-y-5 p-6">
      {state?.error ? (
        <p role="alert" className="border-s-2 border-hmk-red bg-hmk-red-subtle px-4 py-2 text-sm">
          {tErr(state.error)}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="border-s-2 border-hmk-red bg-hmk-red-subtle px-4 py-2 text-sm">
          {t('created')}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="type" className="block text-sm font-medium">{t('type')}</label>
        <select
          id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}
          className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm"
        >
          {TYPES.map((x) => (<option key={x} value={x}>{t(`types.${x}`)}</option>))}
        </select>
        <p className="text-xs text-[--foreground-muted]">
          {isChoice ? t('autoGraded') : t('manuallyGraded')}
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="stem" className="block text-sm font-medium">{t('stem')}</label>
        <textarea
          id="stem" name="stem" rows={3} required
          className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="difficulty" className="block text-sm font-medium">{t('difficulty')}</label>
          <select id="difficulty" name="difficulty" defaultValue="MEDIUM"
            className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm">
            {['EASY','MEDIUM','HARD'].map((d) => (<option key={d} value={d}>{t(`difficulties.${d}`)}</option>))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="maxScore" className="block text-sm font-medium">{t('maxScore')}</label>
          <input id="maxScore" name="maxScore" type="number" min="1" step="1" defaultValue="10" required dir="ltr"
            className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm" />
        </div>
      </div>

      {needsRubric ? (
        <div className="space-y-1.5">
          <label htmlFor="gradingRubric" className="block text-sm font-medium">{t('rubric')}</label>
          <textarea
            id="gradingRubric" name="gradingRubric" rows={3} required
            aria-describedby="rubric-hint"
            className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm"
          />
          <p id="rubric-hint" className="text-xs text-[--foreground-muted]">{t('rubricHint')}</p>
        </div>
      ) : null}

      {isChoice ? (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">{t('options')}</legend>
          <p className="text-xs text-[--foreground-muted]">
            {isMulti ? t('markAllCorrect') : t('markOneCorrect')}
          </p>
          {SLOTS.map((i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                type={isMulti ? 'checkbox' : 'radio'}
                name={isMulti ? `optionCorrect${i}` : 'correctIndex'}
                value={isMulti ? 'on' : String(i)}
                aria-label={t('markCorrect', {n: i + 1})}
                className="h-4 w-4 shrink-0 accent-[--color-hmk-red]"
              />
              <input
                name={`optionText${i}`}
                placeholder={t('optionN', {n: i + 1})}
                className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm"
              />
            </div>
          ))}
        </fieldset>
      ) : null}

      <button
        type="submit" disabled={pending}
        className="rounded-[--radius-control] bg-hmk-red px-5 py-2.5 text-sm font-semibold text-white
                   hover:bg-hmk-red-hover disabled:opacity-60"
      >
        {pending ? t('saving') : t('createQuestion')}
      </button>
    </form>
  );
}
