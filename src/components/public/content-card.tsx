import {Link} from '@/i18n/navigation';
import {cn} from '@/lib/utils';

/**
 * Bold-minimalist card (claude.md 8): flat surface, 2px radius, clear border,
 * red only on the hover/active edge. No heavy shadows.
 *
 * The whole card is a single link - one tab stop, one target, no nested
 * interactive elements to trip over with a keyboard.
 */
export function ContentCard({
  href,
  title,
  description,
  meta,
  footer,
  className,
}: {
  href: string;
  title: string;
  description?: string | null;
  meta?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'hmk-card group flex flex-col gap-3 p-5 transition-colors',
        'hover:border-hmk-red focus-visible:border-hmk-red',
        className
      )}
    >
      {meta ? <div className="flex flex-wrap gap-2">{meta}</div> : null}

      <h2 className="text-lg font-semibold leading-snug transition-colors group-hover:text-hmk-red">
        {title}
      </h2>

      {description ? (
        <p className="line-clamp-3 text-sm text-[--foreground-muted]">{description}</p>
      ) : null}

      {footer ? (
        <div className="mt-auto pt-2 text-xs text-[--foreground-muted]">{footer}</div>
      ) : null}
    </Link>
  );
}
