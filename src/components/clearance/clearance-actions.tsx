'use client';

import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';
import {RefreshCw, ShieldCheck, Award} from 'lucide-react';
import {
  reevaluateClearance,
  approveClearance,
  issueCertificate,
  type ClearanceState,
} from '@/lib/clearance/actions';

export function ReevaluateButton({enrollmentId}: {enrollmentId: string}) {
  const t = useTranslations('clearance');
  const [state, formAction, pending] = useActionState<ClearanceState, FormData>(
    reevaluateClearance,
    undefined
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-[--radius-control] border border-[--border]
                   px-4 py-2 text-sm font-semibold hover:border-hmk-red hover:text-hmk-red
                   disabled:opacity-60"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        {pending ? t('evaluating') : t('reevaluate')}
      </button>
      {state?.error ? <p role="alert" className="mt-2 text-xs text-hmk-red">{t(`errors.${state.error}`)}</p> : null}
    </form>
  );
}

export function ApproveClearanceForm({
  enrollmentId,
  enabled,
  canOverride,
}: {
  enrollmentId: string;
  enabled: boolean;
  canOverride: boolean;
}) {
  const t = useTranslations('clearance');
  const [state, formAction, pending] = useActionState<ClearanceState, FormData>(
    approveClearance,
    undefined
  );
  const [reason, setReason] = useState('');

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />

      {!enabled ? (
        canOverride ? (
          <div className="space-y-1.5">
            <label htmlFor={`ovr-${enrollmentId}`} className="block text-xs font-medium">
              {t('overrideReason')}
            </label>
            <input
              id={`ovr-${enrollmentId}`}
              name="overrideJustification"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm"
            />
            {/* UC-6.13: overriding clearance is reachable exclusively by A7 and is
                unconditionally audited. */}
            <p className="text-xs text-[--foreground-muted]">{t('overrideHint')}</p>
          </div>
        ) : (
          <p className="text-sm text-[--foreground-muted]">{t('cannotApprove')}</p>
        )
      ) : null}

      <button
        type="submit"
        disabled={pending || (!enabled && (!canOverride || reason.trim() === ''))}
        className="inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-5 py-2.5
                   text-sm font-semibold text-white hover:bg-hmk-red-hover
                   disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        {enabled ? t('approve') : t('approveByOverride')}
      </button>

      {state?.error ? <p role="alert" className="text-sm text-hmk-red">{t(`errors.${state.error}`)}</p> : null}
    </form>
  );
}

export function IssueCertificateButton({enrollmentId}: {enrollmentId: string}) {
  const t = useTranslations('clearance');
  const [state, formAction, pending] = useActionState<ClearanceState, FormData>(
    issueCertificate,
    undefined
  );
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-5 py-2.5
                   text-sm font-semibold text-white hover:bg-hmk-red-hover disabled:opacity-60"
      >
        <Award className="h-4 w-4" aria-hidden="true" />
        {pending ? t('issuing') : t('issueCertificate')}
      </button>
      <p className="text-xs text-[--foreground-muted]">{t('issueHint')}</p>
      {state?.error ? <p role="alert" className="text-sm text-hmk-red">{t(`errors.${state.error}`)}</p> : null}
    </form>
  );
}
