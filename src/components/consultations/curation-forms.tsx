'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {Plus, Trash2} from 'lucide-react';
import {
  createExpertiseDomain,
  setDomainActive,
  curateMemberExpertise,
  removeMemberExpertise,
  type CurationState,
} from '@/lib/consultations/curation-actions';

const field =
  'w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm';
const PROFICIENCY = ['FAMILIAR', 'PROFICIENT', 'EXPERT'] as const;

function Error_({state}: {state: CurationState}) {
  const tErr = useTranslations('curation.errors');
  if (!state?.error) return null;
  return (
    <p role="alert" className="text-sm text-hmk-red">
      {tErr(state.error)}
    </p>
  );
}

export function DomainForm() {
  const t = useTranslations('curation');
  const [state, action, pending] = useActionState<CurationState, FormData>(
    createExpertiseDomain,
    undefined
  );

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="code" className="block text-xs font-medium">
            {t('code')}
          </label>
          {/* Codes are Latin identifiers, so they stay LTR on the Arabic page. */}
          <input id="code" name="code" required maxLength={32} dir="ltr" className={field} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="nameAr" className="block text-xs font-medium">
            {t('nameAr')}
          </label>
          <input id="nameAr" name="nameAr" required maxLength={120} dir="rtl" lang="ar" className={field} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="nameEn" className="block text-xs font-medium">
            {t('nameEn')}
          </label>
          <input id="nameEn" name="nameEn" required maxLength={120} dir="ltr" lang="en" className={field} />
        </div>
      </div>
      {/* Both name forms are mandatory: a domain named in one language renders blank on
          the other locale's page (claude.md §0.5). */}
      <p className="text-xs text-[--foreground-muted]">{t('bothNamesNote')}</p>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-4 py-2
                   text-sm font-semibold text-white hover:bg-hmk-red-hover disabled:opacity-60"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {pending ? t('saving') : t('addDomain')}
      </button>
      <Error_ state={state} />
    </form>
  );
}

export function DomainActiveToggle({
  domainId,
  active,
  label,
}: {
  domainId: string;
  active: boolean;
  label: string;
}) {
  const t = useTranslations('curation');
  const [state, action, pending] = useActionState<CurationState, FormData>(
    setDomainActive,
    undefined
  );

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="domainId" value={domainId} />
      <input type="hidden" name="active" value={active ? 'false' : 'true'} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={active}
        className={`rounded-[--radius-control] border px-3 py-1 text-xs font-semibold
                    disabled:opacity-60 ${
                      active
                        ? 'border-hmk-red bg-hmk-red-subtle text-hmk-red'
                        : 'border-[--border] text-[--foreground-muted] hover:border-hmk-red'
                    }`}
      >
        {active ? t('active') : t('retired')}
      </button>
      <span className="sr-only">{label}</span>
      <Error_ state={state} />
    </form>
  );
}

export function CurateExpertiseForm({
  members,
  domains,
}: {
  members: {id: string; name: string}[];
  domains: {id: string; name: string}[];
}) {
  const t = useTranslations('curation');
  const tProf = useTranslations('enums.proficiency');
  const [state, action, pending] = useActionState<CurationState, FormData>(
    curateMemberExpertise,
    undefined
  );

  if (members.length === 0 || domains.length === 0) {
    return <p className="text-sm text-[--foreground-muted]">{t('needMembersAndDomains')}</p>;
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <label htmlFor="memberId" className="block text-xs font-medium">
            {t('member')}
          </label>
          <select id="memberId" name="memberId" required className={field}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="domainId" className="block text-xs font-medium">
            {t('domain')}
          </label>
          <select id="domainId" name="domainId" required className={field}>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="proficiency" className="block text-xs font-medium">
            {t('proficiency')}
          </label>
          <select id="proficiency" name="proficiency" required className={field}>
            {PROFICIENCY.map((p) => (
              <option key={p} value={p}>
                {tProf(p)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="maxLoad" className="block text-xs font-medium">
            {t('maxLoad')}
          </label>
          <input
            id="maxLoad"
            name="maxLoad"
            type="number"
            min="1"
            max="20"
            defaultValue="3"
            dir="ltr"
            required
            className={field}
          />
        </div>
      </div>

      {/* D-06: curation records capability. Whether the member is taking work now is
          their own call, so a new entry starts unavailable. */}
      <p className="text-xs text-[--foreground-muted]">{t('startsUnavailableNote')}</p>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-4 py-2
                   text-sm font-semibold text-white hover:bg-hmk-red-hover disabled:opacity-60"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {pending ? t('saving') : t('addExpertise')}
      </button>
      <Error_ state={state} />
    </form>
  );
}

export function RemoveExpertiseButton({
  expertiseId,
  label,
}: {
  expertiseId: string;
  label: string;
}) {
  const t = useTranslations('curation');
  const [state, action, pending] = useActionState<CurationState, FormData>(
    removeMemberExpertise,
    undefined
  );

  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="expertiseId" value={expertiseId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-[--radius-control] border
                   border-[--border] px-3 py-1 text-xs font-semibold hover:border-hmk-red
                   hover:text-hmk-red disabled:opacity-60"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        {t('remove')}
        <span className="sr-only">{label}</span>
      </button>
      <Error_ state={state} />
    </form>
  );
}
