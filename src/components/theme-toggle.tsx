'use client';

import {useSyncExternalStore} from 'react';
import {useTheme} from 'next-themes';
import {useTranslations} from 'next-intl';
import {Moon, Sun} from 'lucide-react';

export function ThemeToggle() {
  const t = useTranslations('actions');
  const {resolvedTheme, setTheme} = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Theme is unknowable during SSR. Render a same-size placeholder so the header
  // does not shift when the real control appears.
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={t('toggleTheme')}
      className="grid h-9 w-9 place-items-center rounded-[--radius-control]
                 border border-[--border] text-[--foreground] transition-colors
                 hover:border-hmk-red hover:text-hmk-red"
    >
      {!mounted ? (
        <span className="h-4 w-4" />
      ) : isDark ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
