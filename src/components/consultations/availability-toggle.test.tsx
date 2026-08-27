import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@/test/render';

/**
 * D-06 — curated expertise, member-toggled availability.
 *
 * The invariant worth pinning is what this form SENDS. The toggle shows current state
 * but must submit the OPPOSITE, and it must carry no control for proficiency or
 * curation — those belong to A4, and the RPC behind it writes `is_available` alone.
 * A control for them would be a button that always fails.
 */

vi.mock('@/lib/consultations/actions', () => ({
  setAvailability: vi.fn(),
}));

const {AvailabilityToggle} = await import('./availability-toggle');

function fieldsOf(container: HTMLElement) {
  return Object.fromEntries(
    [...container.querySelectorAll('input')].map((i) => [i.name, i.value])
  );
}

describe('AvailabilityToggle (D-06)', () => {
  it('submits the OPPOSITE of the current state', () => {
    const {container} = render(
      <AvailabilityToggle expertiseId="e-1" available={true} label="Toggle Embedded" />
    );
    // Currently available -> the action must turn it off.
    expect(fieldsOf(container)).toMatchObject({expertiseId: 'e-1', available: 'false'});
  });

  it('submits true when the member is currently unavailable', () => {
    const {container} = render(
      <AvailabilityToggle expertiseId="e-2" available={false} label="Toggle ML" />
    );
    expect(fieldsOf(container)).toMatchObject({expertiseId: 'e-2', available: 'true'});
  });

  it('exposes pressed state to assistive tech, not just colour', () => {
    render(<AvailabilityToggle expertiseId="e-3" available={true} label="Toggle" />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers NO control over proficiency or curation', () => {
    const {container} = render(
      <AvailabilityToggle expertiseId="e-4" available={false} label="Toggle" />
    );
    const names = [...container.querySelectorAll('input, select')].map((el) =>
      el.getAttribute('name')
    );
    // If either of these ever appears here, D-06 has been broken in the UI.
    expect(names).not.toContain('proficiency');
    expect(names).not.toContain('curatedBy');
    expect(names).not.toContain('maxLoad');
  });

  it('renders the Arabic label from the real catalogue', () => {
    render(
      <AvailabilityToggle expertiseId="e-5" available={true} label="تبديل" />,
      {locale: 'ar'}
    );
    // Sourced from ar.json — a missing key would throw rather than render blank.
    expect(screen.getByRole('button')).toHaveTextContent('متاح');
  });
});
