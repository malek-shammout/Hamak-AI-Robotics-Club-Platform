import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@/test/render';

/**
 * The consultation request form (M2 / AD-7).
 *
 * Two classes of thing are pinned here, both of which have bitten this project before:
 *
 * 1. **Direction on content-script fields.** Session 002 shipped an English name field
 *    inheriting `dir=rtl` on the Arabic page. Dates and codes are Latin in both locales
 *    (claude.md §7), so they must be explicitly LTR.
 * 2. **Required-ness that matches the database.** `submit_consultation_request` takes
 *    `p_abstract` with no SQL default, so a form that let it be blank would fail at the
 *    RPC boundary with a type error rather than a message the student can act on.
 */

vi.mock('@/lib/consultations/actions', () => ({
  submitConsultation: vi.fn(),
}));

const {RequestForm} = await import('./request-form');

const DOMAINS = [
  {id: '11111111-1111-1111-1111-111111111111', code: 'EMB', name: 'Embedded'},
  {id: '22222222-2222-2222-2222-222222222222', code: 'ML', name: 'Machine learning'},
];

describe('RequestForm', () => {
  it('requires both the title and the abstract', () => {
    render(<RequestForm domains={DOMAINS} />);
    expect(screen.getByLabelText(/project title/i)).toBeRequired();
    // Required because the RPC has no default for it, and because a consultation with
    // no description cannot be triaged or matched to a field.
    expect(screen.getByLabelText(/^abstract$/i)).toBeRequired();
  });

  it('keeps the date field LTR on the Arabic page', () => {
    const {container} = render(<RequestForm domains={DOMAINS} />, {locale: 'ar'});
    const date = container.querySelector('input[type="date"]');
    expect(date).toHaveAttribute('dir', 'ltr');
  });

  it('renders one checkbox per expertise domain, none preselected', () => {
    const {container} = render(<RequestForm domains={DOMAINS} />);
    const boxes = [...container.querySelectorAll('input[name="domain"]')];
    expect(boxes).toHaveLength(2);
    expect(boxes.map((b) => b.getAttribute('value'))).toEqual(DOMAINS.map((d) => d.id));
    // The student's own selection drives the expert match, so nothing is chosen for them.
    boxes.forEach((b) => expect(b).not.toBeChecked());
  });

  it('renders no domain checkboxes when the catalogue is empty', () => {
    // M2 ships inert until A4 curates. The form must still render rather than crash —
    // the student can submit and let triage assign the fields.
    const {container} = render(<RequestForm domains={[]} />);
    expect(container.querySelectorAll('input[name="domain"]')).toHaveLength(0);
    expect(screen.getByLabelText(/project title/i)).toBeInTheDocument();
  });

  it('states the SLA commitment up front (BR-08)', () => {
    render(<RequestForm domains={DOMAINS} />);
    expect(screen.getByText(/starts the club's response clock/i)).toBeInTheDocument();
  });

  it('offers every support type the database enum allows', () => {
    render(<RequestForm domains={DOMAINS} />);
    const select = screen.getByLabelText(/what kind of help/i) as HTMLSelectElement;
    // Drift here means a student can pick something the enum will reject, or that a
    // valid option is unreachable.
    expect([...select.options].map((o) => o.value)).toEqual([
      'TECHNICAL_ADVICE',
      'COMPONENT_SELECTION',
      'CODE_REVIEW',
      'MENTORSHIP',
      'OTHER',
    ]);
  });

  it('renders in Arabic from the real catalogue', () => {
    render(<RequestForm domains={DOMAINS} />, {locale: 'ar'});
    expect(screen.getByLabelText(/عنوان المشروع/)).toBeRequired();
  });
});
