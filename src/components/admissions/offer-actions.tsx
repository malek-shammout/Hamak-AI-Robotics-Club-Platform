'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {respondToOffer, withdrawApplication, type ActionState} from '@/lib/admissions/actions';

export function OfferActions({applicationId}: {applicationId: string}) {
  const t = useTranslations('applications');
  const tErr = useTranslations('applications.errors');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    respondToOffer,
    undefined
  );

  return (
    <div className="space-y-2">
      <form action={formAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="applicationId" value={applicationId} />
        <button
          type="submit"
          name="accept"
          value="true"
          disabled={pending}
          className="rounded-[--radius-control] bg-hmk-red px-4 py-1.5 text-xs font-semibold
                     text-white hover:bg-hmk-red-hover disabled:opacity-60"
        >
          {t('accept')}
        </button>
        <button
          type="submit"
          name="accept"
          value="false"
          disabled={pending}
          className="rounded-[--radius-control] border border-[--border] px-4 py-1.5 text-xs
                     font-semibold hover:border-hmk-red hover:text-hmk-red disabled:opacity-60"
        >
          {t('decline')}
        </button>
      </form>
      {state?.error ? (
        <p role="alert" className="text-xs text-hmk-red">
          {tErr(state.error)}
        </p>
      ) : null}
    </div>
  );
}

export function WithdrawButton({applicationId}: {applicationId: string}) {
  const t = useTranslations('applications');
  const tErr = useTranslations('applications.errors');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    withdrawApplication,
    undefined
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="applicationId" value={applicationId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-[--foreground-muted] underline-offset-4 hover:text-hmk-red
                   hover:underline disabled:opacity-60"
      >
        {t('withdraw')}
      </button>
      {state?.error ? (
        <span role="alert" className="text-xs text-hmk-red">
          {tErr(state.error)}
        </span>
      ) : null}
    </form>
  );
}
