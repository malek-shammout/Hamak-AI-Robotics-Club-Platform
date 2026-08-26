import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';

/**
 * claude.md 6 - Zustand holds client-only UI state: theme mirror, locale preference,
 * and shell state. It is NEVER a cache for server data; that belongs to RSC + Supabase.
 */
type UiState = {
  /** Mirrors next-themes so SSR-aware components can read it without a hydration flash. */
  resolvedTheme: 'light' | 'dark';
  setResolvedTheme: (t: 'light' | 'dark') => void;

  /** Last locale the user actively chose. Authoritative store is `users.locale` when signed in. */
  preferredLocale: 'ar' | 'en';
  setPreferredLocale: (l: 'ar' | 'en') => void;

  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      resolvedTheme: 'dark',
      setResolvedTheme: (resolvedTheme) => set({resolvedTheme}),

      preferredLocale: 'ar',
      setPreferredLocale: (preferredLocale) => set({preferredLocale}),

      sidebarOpen: false,
      toggleSidebar: () => set((s) => ({sidebarOpen: !s.sidebarOpen})),
      setSidebarOpen: (sidebarOpen) => set({sidebarOpen}),
    }),
    {
      name: 'hmk-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        preferredLocale: s.preferredLocale,
        resolvedTheme: s.resolvedTheme,
      }),
    }
  )
);
