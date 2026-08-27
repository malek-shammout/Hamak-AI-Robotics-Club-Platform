'use client';

import {useActionState, useRef, useEffect} from 'react';
import {useTranslations} from 'next-intl';
import {SendHorizontal} from 'lucide-react';
import {postMessage, type ConsultationState} from '@/lib/consultations/actions';

/**
 * Posting into a thread.
 *
 * The insert goes through RLS rather than a SECURITY DEFINER wrapper, on purpose: the
 * `participants_send_messages` policy is the boundary that a stranger once walked
 * straight through, so exercising it in the normal path keeps it honest.
 */
export function MessageForm({requestId}: {requestId: string}) {
  const t = useTranslations('consultations');
  const tErr = useTranslations('consultations.errors');
  const [state, action, pending] = useActionState<ConsultationState, FormData>(
    postMessage,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      <label htmlFor="body" className="block text-xs font-medium">
        {t('replyLabel')}
      </label>
      <textarea
        id="body"
        name="body"
        rows={4}
        required
        maxLength={8000}
        className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface]
                   px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-4 py-2
                   text-sm font-semibold text-white hover:bg-hmk-red-hover disabled:opacity-60"
      >
        <SendHorizontal className="h-4 w-4" aria-hidden="true" />
        {pending ? t('sending') : t('send')}
      </button>
      {state?.error ? (
        <p role="alert" className="text-sm text-hmk-red">
          {tErr(state.error)}
        </p>
      ) : null}
    </form>
  );
}
