'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {setSessionStatus, type LmsState} from '@/lib/lms/actions';

export function SessionStatusForm({
  sessionId,
  current,
}: {
  sessionId: string;
  current: string;
}) {
  const t = useTranslations('lms');
  const [state, formAction, pending] = useActionState<LmsState, FormData>(
    setSessionStatus,
    undefined
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="sessionId" value={sessionId} />
      <label htmlFor={`status-${sessionId}`} className="sr-only">{t('sessionStatus')}</label>
      <select
        id={`status-${sessionId}`}
        name="status"
        defaultValue={current}
        className="rounded-[--radius-control] border border-[--border] bg-[--surface] px-2 py-1 text-xs"
      >
        {['PLANNED', 'HELD', 'CANCELLED'].map((s) => (
          <option key={s} value={s}>{t(`sessionStates.${s}`)}</option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-[--foreground-muted] hover:text-hmk-red disabled:opacity-60"
      >
        {t('apply')}
      </button>
      {state?.ok ? <span className="text-xs text-[--foreground-muted]">{t('saved')}</span> : null}
    </form>
  );
}
