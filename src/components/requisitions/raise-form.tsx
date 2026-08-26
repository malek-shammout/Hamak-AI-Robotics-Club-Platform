'use client';

import {useActionState, useState} from 'react';
import {useTranslations} from 'next-intl';
import {ClipboardList} from 'lucide-react';
import {raiseRequisition, type RequisitionState} from '@/lib/requisitions/actions';

type Project = {id: string; code: string; label: string};
type AssetType = {id: string; label: string; tracking_mode: string; is_consumable: boolean};

export function RaiseRequisitionForm({
  projects,
  assetTypes,
}: {
  projects: Project[];
  assetTypes: AssetType[];
}) {
  const t = useTranslations('requisitions');
  const tErr = useTranslations('requisitions.errors');
  const [qty, setQty] = useState<Record<string, number>>({});
  const [state, formAction, pending] = useActionState<RequisitionState, FormData>(
    raiseRequisition,
    undefined
  );

  const due = new Date();
  due.setDate(due.getDate() + 14);

  return (
    <form action={formAction} className="hmk-card space-y-5 p-6">
      <div className="space-y-1.5">
        <label htmlFor="projectId" className="block text-sm font-medium">{t('project')}</label>
        <select
          id="projectId"
          name="projectId"
          required
          className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm"
        >
          <option value="">{t('selectProject')}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        {/* You may only raise against a project you belong to — the database asserts
            it with NOT_CONTEXT_OWNER, this list just avoids offering the impossible. */}
        <p className="text-xs text-[--foreground-muted]">{t('projectHint')}</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="requiredBy" className="block text-sm font-medium">{t('requiredBy')}</label>
        <input
          id="requiredBy"
          name="requiredBy"
          type="date"
          required
          defaultValue={due.toISOString().slice(0, 10)}
          dir="ltr"
          className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('items')}</legend>
        <p className="text-xs text-[--foreground-muted]">{t('itemsHint')}</p>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {assetTypes.map((a) => (
            <div key={a.id} className="flex items-center gap-3 text-sm">
              <label htmlFor={`q-${a.id}`} className="min-w-[16rem]">
                {a.label}
                <span className="ms-2 text-xs text-[--foreground-muted]">
                  {t(`tracking.${a.tracking_mode}`)}
                  {a.is_consumable ? ` · ${t('consumable')}` : ''}
                </span>
              </label>
              <input
                id={`q-${a.id}`}
                type="number"
                min="0"
                value={qty[a.id] ?? 0}
                dir="ltr"
                onChange={(e) => setQty({...qty, [a.id]: Number(e.target.value)})}
                className="w-24 rounded-[--radius-control] border border-[--border] bg-[--surface] px-2 py-1 text-sm"
              />
              {(qty[a.id] ?? 0) > 0 ? (
                <input type="hidden" name="line" value={`${a.id}:${qty[a.id]}`} />
              ) : null}
            </div>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-5 py-2.5
                   text-sm font-semibold text-white hover:bg-hmk-red-hover disabled:opacity-60"
      >
        <ClipboardList className="h-4 w-4" aria-hidden="true" />
        {pending ? t('raising') : t('raise')}
      </button>

      {state?.error ? <p role="alert" className="text-sm text-hmk-red">{tErr(state.error)}</p> : null}
      {state?.ok ? <p role="status" className="text-sm text-[--foreground-muted]">{t('raised')}</p> : null}
    </form>
  );
}
