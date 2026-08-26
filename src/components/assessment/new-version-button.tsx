'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {GitBranch} from 'lucide-react';
import {newQuestionVersion, type AuthoringState} from '@/lib/assessment/authoring-actions';

export function NewVersionButton({questionId}: {questionId: string}) {
  const t = useTranslations('bank');
  const [state, formAction, pending] = useActionState<AuthoringState, FormData>(
    newQuestionVersion,
    undefined
  );

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="questionId" value={questionId} />
      <button
        type="submit"
        disabled={pending}
        title={t('newVersionHint')}
        className="inline-flex items-center gap-1.5 text-xs text-[--foreground-muted]
                   hover:text-hmk-red disabled:opacity-60"
      >
        <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
        {t('newVersion')}
      </button>
      {state?.ok ? <span className="text-xs text-[--foreground-muted]">{t('versioned')}</span> : null}
    </form>
  );
}
