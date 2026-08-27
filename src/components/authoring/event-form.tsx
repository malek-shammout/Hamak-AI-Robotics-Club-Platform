'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {Save} from 'lucide-react';
import {createEvent, updateEvent, type AuthoringState} from '@/lib/authoring/actions';

const TYPES = ['WORKSHOP', 'EXHIBITION', 'HACKATHON', 'SEMINAR'] as const;
const ELIGIBILITY = ['PUBLIC', 'REGISTERED_STUDENTS', 'MEMBERS_ONLY'] as const;

export type EventDefaults = {
  id?: string;
  code?: string;
  title_ar?: string;
  title_en?: string;
  description?: string | null;
  type?: string;
  eligibility?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  venue_id?: string | null;
  capacity?: number | null;
};

const field =
  'w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm';

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` with no zone; the DB stores UTC. */
function forInput(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventForm({
  defaults,
  venues,
}: {
  defaults?: EventDefaults;
  venues: {id: string; name: string; capacity: number | null}[];
}) {
  const t = useTranslations('authoring');
  const tErr = useTranslations('authoring.errors');
  const tType = useTranslations('enums.eventType');
  const tElig = useTranslations('enums.eligibility');
  const editing = Boolean(defaults?.id);
  const [state, action, pending] = useActionState<AuthoringState, FormData>(
    editing ? updateEvent : createEvent,
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
          <label htmlFor="type" className="block text-xs font-medium">
            {t('eventType')}
          </label>
          <select id="type" name="type" required defaultValue={defaults?.type ?? 'WORKSHOP'} className={field}>
            {TYPES.map((v) => (
              <option key={v} value={v}>
                {tType(v)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="titleAr" className="block text-xs font-medium">
            {t('titleAr')}
          </label>
          <input id="titleAr" name="titleAr" required maxLength={200} dir="rtl" lang="ar"
                 defaultValue={defaults?.title_ar} className={field} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="titleEn" className="block text-xs font-medium">
            {t('titleEn')}
          </label>
          <input id="titleEn" name="titleEn" required maxLength={200} dir="ltr" lang="en"
                 defaultValue={defaults?.title_en} className={field} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="block text-xs font-medium">
          {t('description')}
        </label>
        <textarea id="description" name="description" rows={4} maxLength={4000}
                  defaultValue={defaults?.description ?? ''} className={field} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="startsAt" className="block text-xs font-medium">
            {t('startsAt')}
          </label>
          <input id="startsAt" name="startsAt" type="datetime-local" required dir="ltr"
                 defaultValue={forInput(defaults?.starts_at)} className={field} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="endsAt" className="block text-xs font-medium">
            {t('endsAt')}
          </label>
          <input id="endsAt" name="endsAt" type="datetime-local" required dir="ltr"
                 defaultValue={forInput(defaults?.ends_at)} className={field} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="venueId" className="block text-xs font-medium">
            {t('venue')}
          </label>
          <select id="venueId" name="venueId" defaultValue={defaults?.venue_id ?? ''} className={field}>
            <option value="">{t('noVenue')}</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.capacity ? ` (${v.capacity})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="capacity" className="block text-xs font-medium">
            {t('capacity')}
          </label>
          <input id="capacity" name="capacity" type="number" min="1" dir="ltr"
                 defaultValue={defaults?.capacity ?? ''} className={field} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="eligibility" className="block text-xs font-medium">
            {t('eligibility')}
          </label>
          <select id="eligibility" name="eligibility" required
                  defaultValue={defaults?.eligibility ?? 'PUBLIC'} className={field}>
            {ELIGIBILITY.map((v) => (
              <option key={v} value={v}>
                {tElig(v)}
              </option>
            ))}
          </select>
        </div>
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
