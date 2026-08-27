import {describe, it, expect, vi, beforeEach} from 'vitest';
import userEvent from '@testing-library/user-event';
import {render, screen} from '@/test/render';

/**
 * The language toggle — claude.md §7.
 *
 * This component earns the first component test in the repo because it is the one with a
 * PROVEN regression: Session 005's E2E run caught it dropping the query string, so a
 * visitor who had pasted a verification code into `/en/verify?code=…` lost the code on
 * toggle. E2E covers that end to end but takes a browser and a production build; this
 * pins the same contract in milliseconds, at the seam where it actually broke.
 */

const replace = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  usePathname: () => '/verify',
  useRouter: () => ({replace}),
}));

let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useParams: () => ({locale: 'en'}),
  useSearchParams: () => searchParams,
}));

// The profile write is fire-and-forget and must never gate the UI switch, so the test
// asserts the navigation happens regardless of what Supabase does.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {getUser: async () => ({data: {user: null}})},
    from: () => ({update: () => ({eq: async () => ({})})}),
  }),
}));

const {LanguageToggle} = await import('./language-toggle');

/** Returns the single navigation call, asserting it actually happened. */
function navigationCall() {
  const call = replace.mock.calls[0];
  expect(call, 'the toggle did not navigate at all').toBeDefined();
  return call as [{pathname: string; query: Record<string, string>}, {locale: string}];
}

describe('LanguageToggle', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
  });

  it('offers the OTHER locale, not the current one', () => {
    render(<LanguageToggle />, {locale: 'en'});
    const button = screen.getByRole('button');
    // An accessible name in the target language is what tells a screen-reader user
    // where the button goes.
    expect(button).toHaveAttribute('aria-label', 'التبديل إلى العربية');
    expect(button).toHaveAttribute('lang', 'ar');
  });

  it('preserves the query string when switching locale (regression, S005)', async () => {
    searchParams = new URLSearchParams('code=HMK-ABC-123&ref=poster');
    render(<LanguageToggle />, {locale: 'en'});

    await userEvent.click(screen.getByRole('button'));

    expect(replace).toHaveBeenCalledTimes(1);
    const [target, options] = navigationCall();
    expect(target).toMatchObject({
      pathname: '/verify',
      query: {code: 'HMK-ABC-123', ref: 'poster'},
    });
    expect(options).toEqual({locale: 'ar'});
  });

  it('keeps the route itself, not just the query', async () => {
    render(<LanguageToggle />, {locale: 'en'});
    await userEvent.click(screen.getByRole('button'));
    expect(navigationCall()[0]).toMatchObject({pathname: '/verify'});
  });

  it('switches back to English from the Arabic page', async () => {
    render(<LanguageToggle />, {locale: 'ar'});
    await userEvent.click(screen.getByRole('button'));
    expect(navigationCall()[1]).toEqual({locale: 'en'});
  });

  it('sends an empty query object when there is nothing to preserve', async () => {
    render(<LanguageToggle />, {locale: 'en'});
    await userEvent.click(screen.getByRole('button'));
    // Not undefined — the toggle should always pass a query, so the "no params" case
    // travels the same code path as the populated one.
    expect(navigationCall()[0].query).toEqual({});
  });
});
