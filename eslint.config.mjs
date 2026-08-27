import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

/**
 * ESLint flat config.
 *
 * `npm run lint` had been broken since the repo was created: `next lint` was removed in
 * Next 16 and there was no config here at all, so the lint step of `npm run verify`
 * could never pass. An earlier attempt to bridge the old shareable config through
 * `FlatCompat` failed with a circular-structure error — which was the wrong approach
 * anyway: `eslint-config-next@16` exports native flat config arrays directly, so no
 * compatibility layer is needed.
 *
 * Every rule relaxed below is relaxed for a stated reason. A gate that passes because
 * it was turned off is worse than no gate, because it reports safety it never checked.
 */
const config = [
  ...nextCoreWebVitals,
  ...nextTypeScript,

  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'next-env.d.ts',
      'playwright-report/**',
      'test-results/**',
      // Generated from the live database by `npm run db:types`. Linting it would flag
      // style choices nobody can fix without editing a generated file.
      'src/lib/supabase/database.types.ts',
    ],
  },

  {
    rules: {
      // Supabase responses and Server Action payloads are legitimately dynamic at the
      // seams. Warn so they stay visible without failing the gate on correct code.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        // `_prev` is required by the useActionState signature and is genuinely unused in
        // every action; naming it is clearer than omitting it.
        {argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
      ],
    },
  },

  {
    // `react-hooks/purity` forbids reading the clock during render. That is right for
    // client components and wrong for async Server Components, which render once per
    // request and legitimately compare `starts_at` against "now" to split upcoming from
    // past. ESLint cannot tell the two apart, and route files here are Server Components
    // unless they carry 'use client' — which none of these do.
    files: ['src/app/**/page.tsx', 'src/app/**/layout.tsx', 'src/app/**/route.ts'],
    rules: {'react-hooks/purity': 'off'},
  },

  {
    // Playwright fixtures use a `use()` callback that the React plugin mistakes for a
    // hook. These files never run in React.
    files: ['e2e/**'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/purity': 'off',
    },
  },

  {
    // The next-themes hydration guard: theme is unknowable during SSR, so the control
    // renders a placeholder until mount. It is one setState on mount, deliberate and
    // documented at the call site. Left as a WARNING rather than silenced, so it stays
    // visible if someone finds a cleaner pattern.
    files: ['src/components/theme-toggle.tsx'],
    rules: {'react-hooks/set-state-in-effect': 'warn'},
  },
];

export default config;
