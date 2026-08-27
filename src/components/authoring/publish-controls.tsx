'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {Globe, Send, Undo2, XCircle} from 'lucide-react';
import {setPublicationStatus, type AuthoringState} from '@/lib/authoring/actions';

type Entity = 'projects' | 'events' | 'articles';
type Status = 'DRAFT' | 'PENDING_REVIEW' | 'SCHEDULED' | 'PUBLISHED' | 'REJECTED';

/**
 * Hoisted out of the component on purpose.
 *
 * Defined inside `PublishControls` this is a NEW component type on every render, so
 * React unmounts and remounts the form — losing the pending state of an in-flight
 * submit. `react-hooks/static-components` caught it once linting was working again.
 */
function TransitionButton({
  entity,
  id,
  next,
  label,
  icon: Icon,
  action,
  pending,
  primary = false,
}: {
  entity: Entity;
  id: string;
  next: Status;
  label: string;
  icon: typeof Globe;
  action: (formData: FormData) => void;
  pending: boolean;
  primary?: boolean;
}) {
  return (
    <form action={action} className="inline">
      <input type="hidden" name="entity" value={entity} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={next} />
      <button
        type="submit"
        disabled={pending}
        className={
          primary
            ? `inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-4 py-2
               text-sm font-semibold text-white hover:bg-hmk-red-hover disabled:opacity-60`
            : `inline-flex items-center gap-2 rounded-[--radius-control] border
               border-[--border] px-4 py-2 text-sm font-semibold hover:border-hmk-red
               hover:text-hmk-red disabled:opacity-60`
        }
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}

/**
 * BR-11 / D-08 — the publication transition.
 *
 * `mayApprove` hides the publish and reject buttons from someone who cannot use them.
 * That is COURTESY ONLY: migration 0025 gates the transition in the database on
 * `<module>.APPROVE` and stamps `published_at` itself. If this prop is ever wrong, the
 * database still refuses — which is the whole point of putting the rule there.
 *
 * Submitting for review and withdrawing to draft stay available to any editor, because
 * a drafter who cannot withdraw their own mistake will simply ask someone else to, and
 * the audit trail gets worse.
 */
export function PublishControls({
  entity,
  id,
  status,
  mayApprove,
}: {
  entity: Entity;
  id: string;
  status: Status;
  mayApprove: boolean;
}) {
  const t = useTranslations('authoring');
  const tErr = useTranslations('authoring.errors');
  const tStatus = useTranslations('enums.publicationStatus');
  const [state, action, pending] = useActionState<AuthoringState, FormData>(
    setPublicationStatus,
    undefined
  );

  const isLive = status === 'PUBLISHED';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-[--foreground-muted]">{t('currentState')}</span>
        <span
          className={`rounded-[--radius-control] border px-3 py-1 text-xs font-semibold ${
            isLive
              ? 'border-hmk-red bg-hmk-red-subtle text-hmk-red'
              : 'border-[--border] text-[--foreground-muted]'
          }`}
        >
          {tStatus(status)}
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        {status === 'DRAFT' || status === 'REJECTED' ? (
          <TransitionButton
            entity={entity}
            id={id}
            next="PENDING_REVIEW"
            label={t('submitForReview')}
            icon={Send}
            action={action}
            pending={pending}
          />
        ) : null}

        {status === 'PENDING_REVIEW' ? (
          <TransitionButton
            entity={entity}
            id={id}
            next="DRAFT"
            label={t('withdraw')}
            icon={Undo2}
            action={action}
            pending={pending}
          />
        ) : null}

        {mayApprove && !isLive ? (
          <TransitionButton
            entity={entity}
            id={id}
            next="PUBLISHED"
            label={t('publish')}
            icon={Globe}
            action={action}
            pending={pending}
            primary
          />
        ) : null}

        {mayApprove && status === 'PENDING_REVIEW' ? (
          <TransitionButton
            entity={entity}
            id={id}
            next="REJECTED"
            label={t('reject')}
            icon={XCircle}
            action={action}
            pending={pending}
          />
        ) : null}

        {mayApprove && isLive ? (
          <TransitionButton
            entity={entity}
            id={id}
            next="DRAFT"
            label={t('unpublish')}
            icon={Undo2}
            action={action}
            pending={pending}
          />
        ) : null}
      </div>

      {!mayApprove ? (
        <p className="text-xs text-[--foreground-muted]">{t('approveNote')}</p>
      ) : null}

      {isLive ? <p className="text-xs text-[--foreground-muted]">{t('liveNote')}</p> : null}

      {state?.error ? (
        <p role="alert" className="text-sm text-hmk-red">
          {tErr(state.error)}
        </p>
      ) : null}
    </div>
  );
}
