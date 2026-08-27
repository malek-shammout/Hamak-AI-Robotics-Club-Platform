import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@/test/render';

/**
 * AD-7 expert matching.
 *
 * `suggest_experts` already ranks candidates and `assign_consultation_expert` re-checks
 * the cap, so the UI's job is to present the ranking honestly and not offer an action
 * the database will refuse. Both are pinned here: a member at capacity must not have a
 * live Assign button, and an empty candidate list must explain itself rather than
 * rendering an empty box — that emptiness is exactly what "M2 is inert" looks like.
 */

vi.mock('@/lib/consultations/actions', () => ({
  assignExpert: vi.fn(),
}));

const {AssignForm} = await import('./assign-form');

const CANDIDATE = {
  expert_user_id: 'u-1',
  name: 'Layla Haddad',
  domain_overlap: 2,
  has_evidence: true,
  current_load: 1,
  max_concurrent_load: 3,
};

describe('AssignForm (AD-7)', () => {
  it('shows the ranking factors, not just a name', () => {
    render(<AssignForm requestId="r-1" candidates={[CANDIDATE]} />);
    expect(screen.getByText('Layla Haddad')).toBeInTheDocument();
    expect(screen.getByText(/2 matching fields/i)).toBeInTheDocument();
    expect(screen.getByText(/has project evidence/i)).toBeInTheDocument();
    // Load is shown as a fraction so the triager can see headroom at a glance.
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });

  it('disables Assign for a member already at capacity', () => {
    render(
      <AssignForm
        requestId="r-1"
        candidates={[{...CANDIDATE, current_load: 3, max_concurrent_load: 3}]}
      />
    );
    const button = screen.getByRole('button');
    // The RPC would raise EXPERT_AT_CAPACITY; offering the click would just produce an
    // error the triager cannot act on.
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/at capacity/i);
  });

  it('keeps Assign live for a member with headroom', () => {
    render(<AssignForm requestId="r-1" candidates={[CANDIDATE]} />);
    expect(screen.getByRole('button')).toBeEnabled();
  });

  it('explains an empty candidate list instead of rendering nothing', () => {
    render(<AssignForm requestId="r-1" candidates={[]} />);
    expect(screen.getByText(/no available member matches/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('carries both ids so the action cannot assign to the wrong thread', () => {
    const {container} = render(<AssignForm requestId="r-42" candidates={[CANDIDATE]} />);
    const fields = Object.fromEntries(
      [...container.querySelectorAll('input')].map((i) => [i.name, i.value])
    );
    expect(fields).toMatchObject({requestId: 'r-42', expertId: 'u-1'});
  });

  it('renders the empty-state guidance in Arabic', () => {
    render(<AssignForm requestId="r-1" candidates={[]} />, {locale: 'ar'});
    expect(screen.getByText(/لا يوجد عضو متاح/)).toBeInTheDocument();
  });
});
