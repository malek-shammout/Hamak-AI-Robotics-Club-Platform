'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {createSession, type LmsState} from '@/lib/lms/actions';

export function CreateSessionForm({cohortId, nextNo}: {cohortId: string; nextNo: number}) {
  const t = useTranslations('lms');
  const tErr = useTranslations('lms.errors');
  const [state, formAction, pending] = useActionState<LmsState, FormData>(
    createSession,
    undefined
  );

  return (
    <form action={formAction} className="hmk-card space-y-4 p-5">
      <input type="hidden" name="cohortId" value={cohortId} />
      <h2 className="text-sm font-semibold">{t('addSession')}</h2>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1.5">
          <label htmlFor="sessionNo" className="block text-xs font-medium">{t('sessionNo')}</label>
          <input id="sessionNo" name="sessionNo" type="number" min="1" defaultValue={nextNo}
            required dir="ltr"
            className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="scheduledAt" className="block text-xs font-medium">{t('scheduledAt')}</label>
          <input id="scheduledAt" name="scheduledAt" type="datetime-local" required dir="ltr"
            className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="durationMinutes" className="block text-xs font-medium">{t('duration')}</label>
          <input id="durationMinutes" name="durationMinutes" type="number" min="1" defaultValue="90"
            required dir="ltr"
            className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="location" className="block text-xs font-medium">{t('location')}</label>
        <input id="location" name="location"
          className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm" />
      </div>

      <button type="submit" disabled={pending}
        className="rounded-[--radius-control] bg-hmk-red px-4 py-2 text-sm font-semibold text-white
                   hover:bg-hmk-red-hover disabled:opacity-60">
        {pending ? t('saving') : t('addSession')}
      </button>

      {state?.error ? <p role="alert" className="text-sm text-hmk-red">{tErr(state.error)}</p> : null}
      {state?.ok ? <p role="status" className="text-sm text-[--foreground-muted]">{t('sessionCreated')}</p> : null}
    </form>
  );
}
