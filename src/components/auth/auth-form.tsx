'use client';

import {useActionState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import type {AuthState} from '@/lib/auth/actions';

type Action = (prev: AuthState, formData: FormData) => Promise<AuthState>;

/**
 * Shared shell for sign-in and sign-up.
 *
 * The locale travels in a hidden field because a Server Action has no route context -
 * without it the post-submit redirect would always land on the default locale.
 */
export function AuthForm({
  action,
  submitLabel,
  children,
}: {
  action: Action;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const locale = useLocale();
  const t = useTranslations('auth.errors');
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, undefined);

  return (
    <form action={formAction} className="hmk-card max-w-md space-y-4 p-6">
      <input type="hidden" name="locale" value={locale} />

      {state?.error ? (
        <p
          role="alert"
          className="border-s-2 border-hmk-red bg-hmk-red-subtle px-4 py-2 text-sm"
        >
          {t(state.error)}
        </p>
      ) : null}

      {children}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[--radius-control] bg-hmk-red px-5 py-2.5 text-sm font-semibold
                   text-white transition-colors hover:bg-hmk-red-hover
                   disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </form>
  );
}

export function Field({
  name,
  label,
  type = 'text',
  autoComplete,
  hint,
  required = true,
  dir,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  required?: boolean;
  /** Force a direction for fields whose CONTENT has a script, regardless of UI locale. */
  dir?: 'ltr' | 'rtl';
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        aria-describedby={hintId}
        // Email and password are Latin-script regardless of UI language; an explicit
        // `dir` covers content-script fields like an English name on an Arabic page.
        dir={dir ?? (type === 'email' || type === 'password' ? 'ltr' : undefined)}
        className="w-full rounded-[--radius-control] border border-[--border] bg-[--surface]
                   px-3 py-2 text-sm"
      />
      {hint ? (
        <p id={hintId} className="text-xs text-[--foreground-muted]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
