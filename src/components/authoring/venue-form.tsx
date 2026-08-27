'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {Plus} from 'lucide-react';
import {createVenue, type AuthoringState} from '@/lib/authoring/actions';

const field =
  'w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm';

/**
 * Venues carry a single `name`, not an `_ar`/`_en` pair.
 *
 * That is what the schema says and it is deliberate — a venue is a physical place with
 * one name on the door. Do not "fix" this into a bilingual field to match the other
 * forms; that would be inventing schema (claude.md §0.1).
 */
export function VenueForm() {
  const t = useTranslations('authoring');
  const tErr = useTranslations('authoring.errors');
  const [state, action, pending] = useActionState<AuthoringState, FormData>(
    createVenue,
    undefined
  );

  return (
    <form action={action} className="hmk-card space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="venueName" className="block text-xs font-medium">
            {t('venueName')}
          </label>
          <input id="venueName" name="name" required maxLength={200} className={field} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="venueCapacity" className="block text-xs font-medium">
            {t('capacity')}
          </label>
          <input
            id="venueCapacity"
            name="capacity"
            type="number"
            min="1"
            dir="ltr"
            className={field}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="locationNote" className="block text-xs font-medium">
            {t('locationNote')}
          </label>
          <input id="locationNote" name="locationNote" maxLength={500} className={field} />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-[--radius-control] border border-[--border]
                   px-4 py-2 text-sm font-semibold hover:border-hmk-red hover:text-hmk-red
                   disabled:opacity-60"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {pending ? t('saving') : t('addVenue')}
      </button>

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
