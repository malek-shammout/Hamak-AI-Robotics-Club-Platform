'use client';

import {useLocale} from 'next-intl';
import {LogOut} from 'lucide-react';
import {signOut} from '@/lib/auth/actions';

export function SignOutButton({label}: {label: string}) {
  const locale = useLocale();
  return (
    <form action={signOut}>
      <input type="hidden" name="locale" value={locale} />
      <button
        type="submit"
        aria-label={label}
        title={label}
        className="grid h-9 w-9 place-items-center rounded-[--radius-control] border
                   border-[--border] transition-colors hover:border-hmk-red hover:text-hmk-red"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  );
}
