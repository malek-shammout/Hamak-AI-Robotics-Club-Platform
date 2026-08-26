import {Inbox} from 'lucide-react';

/**
 * Shown when a published-content query legitimately returns nothing.
 * An empty club portal is a normal state, not an error - the copy says so rather
 * than implying something broke.
 */
export function EmptyState({message}: {message: string}) {
  return (
    <div className="hmk-card flex flex-col items-center gap-3 px-6 py-16 text-center">
      <Inbox className="h-8 w-8 text-[--foreground-muted]" aria-hidden="true" />
      <p className="text-[--foreground-muted]">{message}</p>
    </div>
  );
}
