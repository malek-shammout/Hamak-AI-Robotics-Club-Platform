import {cn} from '@/lib/utils';

/**
 * The signature HMK motif (claude.md 8): a 010101 divider used as a header/footer rule.
 *
 * It is DECORATION, never content - hence aria-hidden. A screen reader announcing
 * three hundred ones and zeros would be a serious accessibility defect.
 *
 * The pattern is deterministic rather than random so server and client markup match
 * and React does not report a hydration mismatch.
 */
const PATTERN = '01001000 01001101 01001011 ';

export function BinaryBar({className}: {className?: string}) {
  return (
    <div
      aria-hidden="true"
      role="presentation"
      className={cn('hmk-binary-bar w-full py-1', className)}
    >
      {PATTERN.repeat(24)}
    </div>
  );
}
