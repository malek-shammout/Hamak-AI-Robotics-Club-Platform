'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {Plus} from 'lucide-react';
import {addEventSession, type AuthoringState} from '@/lib/authoring/actions';

const field =
  'w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm';

/**
 * Adds a session to an event.
 *
 * `EX_SESSION_ROOM_OVERLAP` is a GiST exclusion constraint: the same room cannot hold
 * two sessions at once. The action translates that into ROOM_DOUBLE_BOOKED, because a
 * raw constraint name tells an organiser nothing about what to change.
 */
export function SessionForm({eventId}: {eventId: string}) {
  const t = useTranslations('authoring');
  const tErr = useTranslations('authoring.errors');
  const [state, action, pending] = useActionState<AuthoringState, FormData>(
    addEventSession,
    undefined
  );

  return (
    <form action={action} className="hmk-card space-y-4 p-6">
      <input type="hidden" name="eventId" value={eventId} />

      <div className="space-y-1.5">
        <label htmlFor="sessionTitle" className="block text-xs font-medium">
          {t('sessionTitle')}
        </label>
        <input id="sessionTitle" name="title" required maxLength={200} className={field} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="sessionStarts" className="block text-xs font-medium">
            {t('startsAt')}
          </label>
          <input
            id="sessionStarts"
            name="startsAt"
            type="datetime-local"
            required
            dir="ltr"
            className={field}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="sessionEnds" className="block text-xs font-medium">
            {t('endsAt')}
          </label>
          <input
            id="sessionEnds"
            name="endsAt"
            type="datetime-local"
            required
            dir="ltr"
            className={field}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="room" className="block text-xs font-medium">
            {t('room')}
          </label>
          <input id="room" name="room" maxLength={120} className={field} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="track" className="block text-xs font-medium">
            {t('track')}
          </label>
          <input id="track" name="track" maxLength={120} className={field} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="speakerName" className="block text-xs font-medium">
            {t('speaker')}
          </label>
          <input id="speakerName" name="speakerName" maxLength={200} className={field} />
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
        {pending ? t('saving') : t('addSession')}
      </button>

      {state?.error ? (
        <p role="alert" className="text-sm text-hmk-red">
          {tErr(state.error)}
        </p>
      ) : null}
    </form>
  );
}
