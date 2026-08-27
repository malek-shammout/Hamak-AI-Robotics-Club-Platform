'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {setAvailability, type ConsultationState} from '@/lib/consultations/actions';

/**
 * D-06: expertise is curated by A4; only availability belongs to the member.
 *
 * There is intentionally no control here for proficiency or evidence — the RPC updates
 * `is_available` and nothing else, so a control for them would be a button that always
 * fails. What a member can change and what they can see are different things.
 */
export function AvailabilityToggle({
  expertiseId,
  available,
  label,
}: {
  expertiseId: string;
  available: boolean;
  label: string;
}) {
  const t = useTranslations('consultations');
  const tErr = useTranslations('consultations.errors');
  const [state, action, pending] = useActionState<ConsultationState, FormData>(
    setAvailability,
    undefined
  );

  return (
    <form action={action} className="flex items-center gap-3">
      <input type="hidden" name="expertiseId" value={expertiseId} />
      <input type="hidden" name="available" value={available ? 'false' : 'true'} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={available}
        className={`rounded-[--radius-control] border px-3 py-1.5 text-xs font-semibold
                    transition-colors disabled:opacity-60 ${
                      available
                        ? 'border-hmk-red bg-hmk-red-subtle text-hmk-red'
                        : 'border-[--border] text-[--foreground-muted] hover:border-hmk-red'
                    }`}
      >
        {available ? t('available') : t('unavailable')}
      </button>
      <span className="sr-only">{label}</span>
      {state?.error ? (
        <span role="alert" className="text-xs text-hmk-red">
          {tErr(state.error)}
        </span>
      ) : null}
    </form>
  );
}
