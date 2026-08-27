'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {UserCheck, BadgeCheck} from 'lucide-react';
import {assignExpert, type ConsultationState} from '@/lib/consultations/actions';

export type Candidate = {
  expert_user_id: string;
  name: string;
  domain_overlap: number;
  has_evidence: boolean;
  current_load: number;
  max_concurrent_load: number;
};

/**
 * AD-7 expert matching.
 *
 * The list is already ranked by the database — domain overlap, then evidence, then
 * lowest load. Showing the three factors rather than a single opaque score lets the
 * triager disagree with the ordering for a reason, which is the point of suggesting
 * rather than auto-assigning.
 */
export function AssignForm({
  requestId,
  candidates,
}: {
  requestId: string;
  candidates: Candidate[];
}) {
  const t = useTranslations('consultations');
  const tErr = useTranslations('consultations.errors');
  const [state, action, pending] = useActionState<ConsultationState, FormData>(
    assignExpert,
    undefined
  );

  if (candidates.length === 0) {
    return <p className="text-sm text-[--foreground-muted]">{t('noCandidates')}</p>;
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {candidates.map((c) => {
          const atCap = c.current_load >= c.max_concurrent_load;
          return (
            <li
              key={c.expert_user_id}
              className="flex flex-wrap items-center justify-between gap-3 border border-[--border]
                         p-4"
            >
              <div className="space-y-1">
                <p className="font-medium">{c.name}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[--foreground-muted]">
                  <span>{t('overlap', {count: c.domain_overlap})}</span>
                  <span className="font-accent" dir="ltr">
                    {c.current_load}/{c.max_concurrent_load}
                  </span>
                  {c.has_evidence ? (
                    <span className="inline-flex items-center gap-1 text-hmk-red">
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      {t('hasEvidence')}
                    </span>
                  ) : null}
                </div>
              </div>

              <form action={action}>
                <input type="hidden" name="requestId" value={requestId} />
                <input type="hidden" name="expertId" value={c.expert_user_id} />
                <button
                  type="submit"
                  disabled={pending || atCap}
                  className="inline-flex items-center gap-2 rounded-[--radius-control] border
                             border-[--border] px-4 py-2 text-sm font-semibold
                             hover:border-hmk-red hover:text-hmk-red disabled:opacity-60"
                >
                  <UserCheck className="h-4 w-4" aria-hidden="true" />
                  {atCap ? t('atCapacity') : t('assign')}
                </button>
              </form>
            </li>
          );
        })}
      </ul>

      {state?.error ? (
        <p role="alert" className="text-sm text-hmk-red">
          {tErr(state.error)}
        </p>
      ) : null}
    </div>
  );
}
