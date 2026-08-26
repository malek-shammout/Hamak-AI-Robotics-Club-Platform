'use client';

import {ThemeProvider as NextThemesProvider} from 'next-themes';
import {useEffect} from 'react';
import {useTheme} from 'next-themes';
import {useUiStore} from '@/stores/ui-store';

/**
 * Mirrors next-themes' resolved theme into Zustand.
 * next-themes owns the `class` on <html>; Zustand is only a read-model for
 * components that need the value in JS. claude.md 6 - never two sources of truth.
 */
function ThemeMirror() {
  const {resolvedTheme} = useTheme();
  const setResolvedTheme = useUiStore((s) => s.setResolvedTheme);

  useEffect(() => {
    if (resolvedTheme === 'light' || resolvedTheme === 'dark') {
      setResolvedTheme(resolvedTheme);
    }
  }, [resolvedTheme, setResolvedTheme]);

  return null;
}

export function Providers({children}: {children: React.ReactNode}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <ThemeMirror />
      {children}
    </NextThemesProvider>
  );
}
