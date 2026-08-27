'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {ListChecks} from 'lucide-react';
import {triageConsultation, type ConsultationState} from '@/lib/consultations/actions';

type Domain = {id: string; code: string; name: string};

const PRIORITY = ['LOW', 'NORMAL', 'HIGH'] as const;
const COMPLEXITY = ['LOW', 'MEDIUM', 'HIGH'] as const;

export function TriageForm({
  requestId,
  domains,
  selected,
  priority,
  complexity,
}: {
  requestId: string;
  domains: Domain[];
  selected: string[];
  priority: string | null;
  complexity: string | null;
}) {
  const t = useTranslations('consultations');
  const tErr = useTranslations('consultations.errors');
  const tP = useTranslations('enums.consultationPriority');
  const tC = useTranslations('enums.consultationComplexity');
  const [state, action, pending] = useActionState<ConsultationState, FormData>(
    triageConsultation,
    undefined
  );

  const field =
    'w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm';

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="requestId" value={requestId} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="priority" className="block text-xs font-medium">
            {t('fieldPriority')}
          </label>
          <select
            id="priority"
            name="priority"
            defaultValue={priority ?? 'NORMAL'}
            className={field}
          >
            {PRIORITY.map((p) => (
              <option key={p} value={p}>
                {tP(p)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="complexity" className="block text-xs font-medium">
            {t('fieldComplexity')}
          </label>
          <select
            id="complexity"
            name="complexity"
            defaultValue={complexity ?? 'MEDIUM'}
            className={field}
          >
            {COMPLEXITY.map((c) => (
              <option key={c} value={c}>
                {tC(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium">{t('fieldDomains')}</legend>
        {/* Leaving every box unticked keeps the student's own choice rather than wiping
            it — the action only sends the list when at least one is selected. */}
        <p className="text-xs text-[--foreground-muted]">{t('triageDomainsHint')}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {domains.map((d) => (
            <label
              key={d.id}
              className="inline-flex cursor-pointer items-center gap-2 rounded-[--radius-control]
                         border border-[--border] px-3 py-1.5 text-sm
                         has-[:checked]:border-hmk-red has-[:checked]:text-hmk-red"
            >
              <input
                type="checkbox"
                name="domain"
                value={d.id}
                defaultChecked={selected.includes(d.id)}
                className="accent-[--hmk-red]"
              />
              {d.name}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-5 py-2.5
                   text-sm font-semibold text-white hover:bg-hmk-red-hover disabled:opacity-60"
      >
        <ListChecks className="h-4 w-4" aria-hidden="true" />
        {pending ? t('triaging') : t('triage')}
      </button>

      {state?.error ? (
        <p role="alert" className="text-sm text-hmk-red">
          {tErr(state.error)}
        </p>
      ) : null}
    </form>
  );
}
