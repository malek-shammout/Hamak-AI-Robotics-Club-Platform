'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {Save} from 'lucide-react';
import {createProject, updateProject, type AuthoringState} from '@/lib/authoring/actions';

const STATUSES = ['IDEA', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'] as const;

export type ProjectDefaults = {
  id?: string;
  code?: string;
  title_ar?: string;
  title_en?: string;
  abstract?: string | null;
  problem_statement?: string | null;
  status?: string;
  outcome?: string | null;
  start_on?: string | null;
  end_on?: string | null;
};

const field =
  'w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm';

export function ProjectForm({defaults}: {defaults?: ProjectDefaults}) {
  const t = useTranslations('authoring');
  const tErr = useTranslations('authoring.errors');
  const tStatus = useTranslations('enums.projectStatus');
  const editing = Boolean(defaults?.id);
  const [state, action, pending] = useActionState<AuthoringState, FormData>(
    editing ? updateProject : createProject,
    undefined
  );

  return (
    <form action={action} className="hmk-card space-y-5 p-6">
      {editing ? <input type="hidden" name="id" value={defaults!.id} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="code" className="block text-xs font-medium">
            {t('code')}
          </label>
          {/* Codes are Latin identifiers and stay LTR on the Arabic page. */}
          <input
            id="code"
            name="code"
            required
            maxLength={32}
            dir="ltr"
            defaultValue={defaults?.code}
            className={field}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="status" className="block text-xs font-medium">
            {t('projectStatus')}
          </label>
          <select
            id="status"
            name="status"
            required
            defaultValue={defaults?.status ?? 'IDEA'}
            className={field}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {tStatus(s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Both title forms are required. A project titled in one language renders blank
          on the other locale's public page (claude.md §0.5). */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="titleAr" className="block text-xs font-medium">
            {t('titleAr')}
          </label>
          <input
            id="titleAr"
            name="titleAr"
            required
            maxLength={200}
            dir="rtl"
            lang="ar"
            defaultValue={defaults?.title_ar}
            className={field}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="titleEn" className="block text-xs font-medium">
            {t('titleEn')}
          </label>
          <input
            id="titleEn"
            name="titleEn"
            required
            maxLength={200}
            dir="ltr"
            lang="en"
            defaultValue={defaults?.title_en}
            className={field}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="abstract" className="block text-xs font-medium">
          {t('abstract')}
        </label>
        <textarea
          id="abstract"
          name="abstract"
          rows={4}
          maxLength={4000}
          defaultValue={defaults?.abstract ?? ''}
          className={field}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="problemStatement" className="block text-xs font-medium">
          {t('problemStatement')}
        </label>
        <textarea
          id="problemStatement"
          name="problemStatement"
          rows={3}
          maxLength={4000}
          defaultValue={defaults?.problem_statement ?? ''}
          className={field}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="startOn" className="block text-xs font-medium">
            {t('startOn')}
          </label>
          <input
            id="startOn"
            name="startOn"
            type="date"
            dir="ltr"
            defaultValue={defaults?.start_on ?? ''}
            className={field}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="endOn" className="block text-xs font-medium">
            {t('endOn')}
          </label>
          <input
            id="endOn"
            name="endOn"
            type="date"
            dir="ltr"
            defaultValue={defaults?.end_on ?? ''}
            className={field}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="outcome" className="block text-xs font-medium">
          {t('outcome')}
        </label>
        <textarea
          id="outcome"
          name="outcome"
          rows={3}
          maxLength={4000}
          defaultValue={defaults?.outcome ?? ''}
          className={field}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-5 py-2.5
                   text-sm font-semibold text-white hover:bg-hmk-red-hover disabled:opacity-60"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        {pending ? t('saving') : editing ? t('save') : t('create')}
      </button>

      {/* Creating never publishes — say so, so nobody goes looking for the live page. */}
      {!editing ? <p className="text-xs text-[--foreground-muted]">{t('startsAsDraft')}</p> : null}

      {state?.error ? (
        <p role="alert" className="text-sm text-hmk-red">
          {tErr(state.error)}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="text-sm text-[--foreground-muted]">
          {t('saved')}
        </p>
      ) : null}
    </form>
  );
}
