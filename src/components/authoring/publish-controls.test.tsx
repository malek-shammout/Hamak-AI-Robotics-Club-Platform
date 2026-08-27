import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@/test/render';

/**
 * BR-11 / D-08 — the publication transition, from the UI side.
 *
 * The database is the boundary (migration 0025 gates the transition on
 * `<module>.APPROVE`), so these tests are not asserting security — they are asserting
 * that the UI does not OFFER an action the database will refuse, and that it does not
 * hide an action a drafter legitimately needs. Both failures are real: the first
 * produces an error the user cannot act on, the second means a drafter cannot withdraw
 * their own mistake and has to ask someone else, which makes the audit trail worse.
 */

vi.mock('@/lib/authoring/actions', () => ({
  setPublicationStatus: vi.fn(),
}));

const {PublishControls} = await import('./publish-controls');

function statusesOffered(container: HTMLElement) {
  return [...container.querySelectorAll('input[name="status"]')].map((i) =>
    i.getAttribute('value')
  );
}

describe('PublishControls (BR-11)', () => {
  it('hides publish from someone without approval rights', () => {
    const {container} = render(
      <PublishControls entity="projects" id="p-1" status="DRAFT" mayApprove={false} />
    );
    expect(statusesOffered(container)).not.toContain('PUBLISHED');
    expect(statusesOffered(container)).not.toContain('REJECTED');
  });

  it('still lets a drafter submit for review', () => {
    const {container} = render(
      <PublishControls entity="projects" id="p-1" status="DRAFT" mayApprove={false} />
    );
    // Without this a drafting role can do nothing at all with its own work.
    expect(statusesOffered(container)).toContain('PENDING_REVIEW');
  });

  it('lets a drafter withdraw their own submission', () => {
    const {container} = render(
      <PublishControls entity="articles" id="a-1" status="PENDING_REVIEW" mayApprove={false} />
    );
    expect(statusesOffered(container)).toContain('DRAFT');
  });

  it('explains why publishing is unavailable rather than just hiding it', () => {
    render(<PublishControls entity="projects" id="p-1" status="DRAFT" mayApprove={false} />);
    expect(screen.getByText(/publishing needs approval rights/i)).toBeInTheDocument();
  });

  it('offers publish and reject to an approver reviewing a submission', () => {
    const {container} = render(
      <PublishControls entity="events" id="e-1" status="PENDING_REVIEW" mayApprove={true} />
    );
    const offered = statusesOffered(container);
    expect(offered).toContain('PUBLISHED');
    expect(offered).toContain('REJECTED');
  });

  it('offers unpublish, not publish, on something already live', () => {
    const {container} = render(
      <PublishControls entity="events" id="e-1" status="PUBLISHED" mayApprove={true} />
    );
    const offered = statusesOffered(container);
    expect(offered).not.toContain('PUBLISHED');
    expect(offered).toContain('DRAFT');
  });

  it('warns that a published entity is live right now', () => {
    render(<PublishControls entity="events" id="e-1" status="PUBLISHED" mayApprove={true} />);
    expect(screen.getByText(/live on the public site right now/i)).toBeInTheDocument();
  });

  it('never sends published_at — the stamp is the database to set', () => {
    const {container} = render(
      <PublishControls entity="projects" id="p-1" status="PENDING_REVIEW" mayApprove={true} />
    );
    const names = [...container.querySelectorAll('input')].map((i) => i.name);
    // A timestamp the client dictates is not evidence; migration 0025 stamps it.
    expect(names).not.toContain('published_at');
    expect(names).not.toContain('publishedAt');
  });

  it('carries the entity so one action can serve all three modules', () => {
    const {container} = render(
      <PublishControls entity="articles" id="a-9" status="DRAFT" mayApprove={true} />
    );
    const first = container.querySelector('form')!;
    const fields = Object.fromEntries(
      [...first.querySelectorAll('input')].map((i) => [i.name, i.value])
    );
    expect(fields).toMatchObject({entity: 'articles', id: 'a-9'});
  });

  it('renders the approval note in Arabic', () => {
    render(
      <PublishControls entity="projects" id="p-1" status="DRAFT" mayApprove={false} />,
      {locale: 'ar'}
    );
    expect(screen.getByText(/النشر يحتاج صلاحية الموافقة/)).toBeInTheDocument();
  });
});
