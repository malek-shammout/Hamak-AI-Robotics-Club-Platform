import {cn} from '@/lib/utils';

export function MetaPill({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'accent';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[--radius-control] border px-2 py-0.5 text-xs font-medium',
        tone === 'accent'
          ? 'border-hmk-red/40 bg-hmk-red-subtle text-hmk-red'
          : 'border-[--border] text-[--foreground-muted]'
      )}
    >
      {children}
    </span>
  );
}
