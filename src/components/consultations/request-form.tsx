'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {Send} from 'lucide-react';
import {submitConsultation, type ConsultationState} from '@/lib/consultations/actions';

type Domain = {id: string; code: string; name: string};

const SUPPORT_TYPES = [
  'TECHNICAL_ADVICE',
  'COMPONENT_SELECTION',
  'CODE_REVIEW',
  'MENTORSHIP',
  'OTHER',
] as const;

export function RequestForm({domains}: {domains: Domain[]}) {
  const t = useTranslations('consultations');
  const tErr = useTranslations('consultations.errors');
  const tEnum = useTranslations('enums.supportType');
  const [state, action, pending] = useActionState<ConsultationState, FormData>(
    submitConsultation,
    undefined
  );

  const field =
    'w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm';

  return (
    <form action={action} className="hmk-card space-y-5 p-6">
      <div className="space-y-1.5">
        <label htmlFor="title" className="block text-xs font-medium">
          {t('fieldTitle')}
        </label>
        <input id="title" name="title" required maxLength={300} className={field} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="abstract" className="block text-xs font-medium">
          {t('fieldAbstract')}
        </label>
        <textarea id="abstract" name="abstract" rows={5} required maxLength={4000} className={field} />
        <p className="text-xs text-[--foreground-muted]">{t('abstractHint')}</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="supportType" className="block text-xs font-medium">
            {t('fieldSupportType')}
          </label>
          <select id="supportType" name="supportType" required className={field}>
            {SUPPORT_TYPES.map((s) => (
              <option key={s} value={s}>
                {tEnum(s)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="deadline" className="block text-xs font-medium">
            {t('fieldDeadline')}
          </label>
          {/* Dates are always Western digits and LTR in both locales (claude.md §7). */}
          <input id="deadline" name="deadline" type="date" dir="ltr" className={field} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="supervisorName" className="block text-xs font-medium">
          {t('fieldSupervisor')}
        </label>
        <input id="supervisorName" name="supervisorName" maxLength={200} className={field} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium">{t('fieldDomains')}</legend>
        <p className="text-xs text-[--foreground-muted]">{t('domainsHint')}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {domains.map((d) => (
            <label
              key={d.id}
              className="inline-flex cursor-pointer items-center gap-2 rounded-[--radius-control]
                         border border-[--border] px-3 py-1.5 text-sm
                         has-[:checked]:border-hmk-red has-[:checked]:text-hmk-red"
            >
              <input type="checkbox" name="domain" value={d.id} className="accent-[--hmk-red]" />
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
        <Send className="h-4 w-4" aria-hidden="true" />
        {pending ? t('submitting') : t('submit')}
      </button>

      {/* BR-08: the reply clock starts the moment this is accepted, so say so up front. */}
      <p className="text-xs text-[--foreground-muted]">{t('slaNote')}</p>

      {state?.error ? (
        <p role="alert" className="text-sm text-hmk-red">
          {tErr(state.error)}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="text-sm text-[--foreground-muted]">
          {t('submitted')}
        </p>
      ) : null}
    </form>
  );
}
