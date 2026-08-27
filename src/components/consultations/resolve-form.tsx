'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {CheckCheck} from 'lucide-react';
import {resolveConsultation, type ConsultationState} from '@/lib/consultations/actions';

const OUTCOMES = ['ADVICE_GIVEN', 'ONGOING_MENTORSHIP', 'OUT_OF_SCOPE', 'UNRESPONSIVE'] as const;

/** AD-7: a case cannot be closed without an outcome category and a written summary. */
export function ResolveForm({requestId}: {requestId: string}) {
  const t = useTranslations('consultations');
  const tErr = useTranslations('consultations.errors');
  const tOut = useTranslations('enums.consultationOutcome');
  const [state, action, pending] = useActionState<ConsultationState, FormData>(
    resolveConsultation,
    undefined
  );

  const field =
    'w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm';

  return (
    <form action={action} className="space-y-4 border-t border-[--border] pt-5">
      <input type="hidden" name="requestId" value={requestId} />
      <h3 className="text-sm font-semibold">{t('resolveTitle')}</h3>

      <div className="space-y-1.5">
        <label htmlFor="outcome" className="block text-xs font-medium">
          {t('fieldOutcome')}
        </label>
        <select id="outcome" name="outcome" required className={field}>
          {OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {tOut(o)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="summary" className="block text-xs font-medium">
          {t('fieldSummary')}
        </label>
        <textarea id="summary" name="summary" rows={4} required maxLength={4000} className={field} />
        <p className="text-xs text-[--foreground-muted]">{t('summaryHint')}</p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-5 py-2.5
                   text-sm font-semibold text-white hover:bg-hmk-red-hover disabled:opacity-60"
      >
        <CheckCheck className="h-4 w-4" aria-hidden="true" />
        {pending ? t('resolving') : t('resolve')}
      </button>

      {/* Resolution closes the thread to new messages, which is not obvious from the UI. */}
      <p className="text-xs text-[--foreground-muted]">{t('resolveClosesNote')}</p>

      {state?.error ? (
        <p role="alert" className="text-sm text-hmk-red">
          {tErr(state.error)}
        </p>
      ) : null}
    </form>
  );
}
