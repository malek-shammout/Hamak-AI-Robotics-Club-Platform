'use client';

import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';
import {markAttendance, type LmsState} from '@/lib/lms/actions';

const STATES = ['PRESENT', 'LATE', 'EXCUSED', 'ABSENT'] as const;

export function AttendanceRow({
  enrollmentId,
  sessionId,
  name,
  current,
  amendedAt,
  amendmentReason,
}: {
  enrollmentId: string;
  sessionId: string;
  name: string;
  current: string | null;
  amendedAt: string | null;
  amendmentReason: string | null;
}) {
  const t = useTranslations('lms');
  const tErr = useTranslations('lms.errors');
  const [picked, setPicked] = useState<string | null>(current);
  const [state, formAction, pending] = useActionState<LmsState, FormData>(
    markAttendance,
    undefined
  );

  // Changing an existing mark is an amendment and the database demands a reason.
  // Reveal the field as soon as the choice differs, rather than after a failed submit.
  const amending = current !== null && picked !== current;

  return (
    <li className="hmk-card p-4">
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="enrollmentId" value={enrollmentId} />
        <input type="hidden" name="sessionId" value={sessionId} />

        <div className="flex flex-wrap items-center gap-4">
          <span className="min-w-[12rem] font-medium">{name}</span>

          <fieldset className="flex flex-wrap gap-3">
            <legend className="sr-only">{t('attendanceFor', {name})}</legend>
            {STATES.map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="state"
                  value={s}
                  checked={picked === s}
                  onChange={() => setPicked(s)}
                  className="h-4 w-4 accent-[--color-hmk-red]"
                />
                <span>{t(`states.${s}`)}</span>
              </label>
            ))}
          </fieldset>

          <button
            type="submit"
            disabled={pending || picked === null}
            className="ms-auto rounded-[--radius-control] border border-[--border] px-4 py-1.5
                       text-xs font-semibold hover:border-hmk-red hover:text-hmk-red
                       disabled:opacity-50"
          >
            {amending ? t('amend') : t('save')}
          </button>
        </div>

        {amending ? (
          <div className="space-y-1.5">
            <label htmlFor={`reason-${enrollmentId}`} className="block text-xs font-medium">
              {t('amendReason')}
            </label>
            <input
              id={`reason-${enrollmentId}`}
              name="amendmentReason"
              required
              className="w-full rounded-[--radius-control] border border-[--border]
                         bg-[--surface] px-3 py-2 text-sm"
            />
          </div>
        ) : null}

        {amendedAt && amendmentReason ? (
          <p className="text-xs text-[--foreground-muted]">
            {t('previouslyAmended', {reason: amendmentReason})}
          </p>
        ) : null}

        {state?.error ? (
          <p role="alert" className="text-xs text-hmk-red">{tErr(state.error)}</p>
        ) : null}
        {state?.ok ? (
          <p role="status" className="text-xs text-[--foreground-muted]">{t('marked')}</p>
        ) : null}
      </form>
    </li>
  );
}
