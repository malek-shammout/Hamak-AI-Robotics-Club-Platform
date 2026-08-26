import {getTranslations} from 'next-intl/server';
import {CheckCircle2, XCircle, Info} from 'lucide-react';
import type {PreconditionSnapshot} from '@/lib/queries/clearance';

const CONDITIONS = [
  'C1_NOT_COMPLETED',
  'C2_ITEMS_OUTSTANDING',
  'C3_INSPECTION_PENDING',
  'C4_LIABILITY_OPEN',
  'C5_INCIDENT_OPEN',
] as const;

/**
 * The §B.2 decision table, rendered as it is defined.
 *
 * A1 is shown SEPARATELY and labelled non-blocking. It is not one of the five
 * conditions and must never be presented as though it were — D-04 Option C keeps
 * BR-01 purely per-enrollment.
 */
export async function PreconditionList({
  snapshot,
  showAdvisory,
}: {
  snapshot: PreconditionSnapshot | null;
  showAdvisory: boolean;
}) {
  const t = await getTranslations('clearance');
  if (!snapshot) return <p className="text-[--foreground-muted]">{t('notEvaluated')}</p>;

  const advisory = snapshot.A1_OUTSTANDING_ELSEWHERE?.advisory === true;

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {CONDITIONS.map((key) => {
          const entry = snapshot[key] as {pass?: boolean; count?: number} | undefined;
          const pass = entry?.pass === true;
          return (
            <li key={key} className="flex items-start gap-3 text-sm">
              {pass ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-hmk-red" aria-hidden="true" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[--foreground-muted]" aria-hidden="true" />
              )}
              <span className={pass ? '' : 'text-[--foreground-muted]'}>
                {t(`conditions.${key}`)}
                {!pass && typeof entry?.count === 'number' && entry.count > 0 ? (
                  <span className="ms-2 font-accent text-xs">{entry.count}</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      {showAdvisory && advisory ? (
        <div className="flex items-start gap-3 border-s-2 border-[--border] bg-[--background] px-4 py-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[--foreground-muted]" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-medium">{t('advisoryTitle')}</p>
            <p className="text-[--foreground-muted]">{t('advisoryBody')}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
