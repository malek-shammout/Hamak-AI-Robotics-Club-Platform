import '@testing-library/jest-dom/vitest';
import {cleanup} from '@testing-library/react';
import {afterEach, vi} from 'vitest';

/**
 * Global test setup.
 *
 * `cleanup` runs between tests so a component left mounted by one test cannot satisfy
 * another test's query — a false pass that is very hard to spot later.
 */
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
