import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

/**
 * Vitest owns unit and component tests only.
 *
 * Without this, vitest's default glob swept up `e2e/**` — those import from
 * `@playwright/test`, which throws outside a Playwright runner, so `npm run test`
 * reported ten failed suites and zero tests. That in turn broke `npm run verify`,
 * which is the gate D-16 points at. Playwright has its own runner and its own config.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
    // There are no component tests yet. Failing on an empty run would make `verify`
    // permanently red for a gap that is tracked honestly in claude.md §13 instead.
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
