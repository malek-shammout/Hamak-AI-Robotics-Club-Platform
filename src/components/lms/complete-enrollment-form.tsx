'use client';

import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';
import {completeEnrollment, type LmsState} from '@/lib/lms/actions';

export function CompleteEnrollmentForm({
  enrollmentId,
  meetsAttendance,
  canOverride,
}: {
  enrollmentId: string;
  meetsAttendance: boolean;
  canOverride: boolean;
}) {
  const t = useTranslations('lms');
  const tErr = useTranslations('lms.errors');
  const [attested, setAttested] = useState(false);
  const [state, formAction, pending] = useActionState<LmsState, FormData>(
    completeEnrollment,
    undefined
  );

  // BR-05 needs BOTH halves. If either fails, the only route is the A7 override,
  // so the reason field appears rather than leaving a disabled button unexplained.
  const satisfied = meetsAttendance && attested;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="evaluationsPassed"
          checked={attested}
          onChange={(e) => setAttested(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[--color-hmk-red]"
        />
        <span>
          {t('attestEvaluations')}
          <span className="block text-xs text-[--foreground-muted]">{t('attestHint')}</span>
        </span>
      </label>

      {!satisfied && canOverride ? (
        <div className="space-y-1.5">
          <label htmlFor={`ovr-${enrollmentId}`} className="block text-xs font-medium">
            {t('overrideReason')}
          </label>
          <input
            id={`ovr-${enrollmentId}`}
            name="overrideReason"
            required
            placeholder={t('overridePlaceholder')}
            className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm"
          />
          <p className="text-xs text-[--foreground-muted]">{t('overrideHint')}</p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending || (!satisfied && !canOverride)}
        className="rounded-[--radius-control] bg-hmk-red px-4 py-2 text-xs font-semibold text-white
                   hover:bg-hmk-red-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {satisfied ? t('markComplete') : t('markCompleteOverride')}
      </button>

      {state?.error ? <p role="alert" className="text-xs text-hmk-red">{tErr(state.error)}</p> : null}
      {state?.ok ? <p role="status" className="text-xs text-[--foreground-muted]">{t('completed')}</p> : null}
    </form>
  );
}
