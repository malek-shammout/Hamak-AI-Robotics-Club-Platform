'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {Save} from 'lucide-react';
import {setProjectTechnologies, type AuthoringState} from '@/lib/authoring/actions';

/**
 * The project's technology tags.
 *
 * Submits the COMPLETE intended set rather than a diff — the action replaces the rows
 * wholesale, so unticking everything genuinely means "none", which a diff-based form
 * makes surprisingly hard to express.
 */
export function TechnologyPicker({
  projectId,
  technologies,
  selected,
}: {
  projectId: string;
  technologies: {id: string; name: string; category: string | null}[];
  selected: string[];
}) {
  const t = useTranslations('authoring');
  const tErr = useTranslations('authoring.errors');
  const [state, action, pending] = useActionState<AuthoringState, FormData>(
    setProjectTechnologies,
    undefined
  );

  if (technologies.length === 0) {
    return <p className="text-sm text-[--foreground-muted]">{t('noTechnologies')}</p>;
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      <div className="flex flex-wrap gap-2">
        {technologies.map((tech) => (
          <label
            key={tech.id}
            className="inline-flex cursor-pointer items-center gap-2 rounded-[--radius-control]
                       border border-[--border] px-3 py-1.5 text-sm
                       has-[:checked]:border-hmk-red has-[:checked]:text-hmk-red"
          >
            <input
              type="checkbox"
              name="technology"
              value={tech.id}
              defaultChecked={selected.includes(tech.id)}
              className="accent-[--hmk-red]"
            />
            {tech.name}
          </label>
        ))}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-[--radius-control] border border-[--border]
                   px-4 py-2 text-sm font-semibold hover:border-hmk-red hover:text-hmk-red
                   disabled:opacity-60"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        {pending ? t('saving') : t('save')}
      </button>

      {state?.error ? (
        <p role="alert" className="text-sm text-hmk-red">
          {tErr(state.error)}
        </p>
      ) : null}
    </form>
  );
}
