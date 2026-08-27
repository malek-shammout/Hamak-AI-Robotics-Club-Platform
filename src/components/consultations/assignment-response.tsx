'use client';

import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Check, X} from 'lucide-react';
import {respondToAssignment, type ConsultationState} from '@/lib/consultations/actions';

/** The named expert answers for themselves — the RPC refuses anyone else outright. */
export function AssignmentResponse({assignmentId}: {assignmentId: string}) {
  const t = useTranslations('consultations');
  const tErr = useTranslations('consultations.errors');
  const [declining, setDeclining] = useState(false);
  const [state, action, pending] = useActionState<ConsultationState, FormData>(
    respondToAssignment,
    undefined
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />

      {declining ? (
        <div className="space-y-1.5">
          <label htmlFor="declineReason" className="block text-xs font-medium">
            {t('declineReason')}
          </label>
          {/* AD-7 sends a declined request back to triage, so the reason is what tells
              the triager whether to re-route or re-scope it. */}
          <input
            id="declineReason"
            name="declineReason"
            required
            className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface]
                       px-3 py-2 text-sm"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {declining ? (
          <>
            <button
              type="submit"
              name="accept"
              value="false"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-[--radius-control] border
                         border-[--border] px-4 py-2 text-sm font-semibold hover:border-hmk-red
                         hover:text-hmk-red disabled:opacity-60"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              {t('confirmDecline')}
            </button>
            <button
              type="button"
              onClick={() => setDeclining(false)}
              className="text-sm text-[--foreground-muted] hover:text-hmk-red"
            >
              {t('cancel')}
            </button>
          </>
        ) : (
          <>
            <button
              type="submit"
              name="accept"
              value="true"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red
                         px-5 py-2.5 text-sm font-semibold text-white hover:bg-hmk-red-hover
                         disabled:opacity-60"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {t('accept')}
            </button>
            <button
              type="button"
              onClick={() => setDeclining(true)}
              className="inline-flex items-center gap-2 rounded-[--radius-control] border
                         border-[--border] px-4 py-2 text-sm font-semibold hover:border-hmk-red
                         hover:text-hmk-red"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              {t('decline')}
            </button>
          </>
        )}
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-hmk-red">
          {tErr(state.error)}
        </p>
      ) : null}
    </form>
  );
}
