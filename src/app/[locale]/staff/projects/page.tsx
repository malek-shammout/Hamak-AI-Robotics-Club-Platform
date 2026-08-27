import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {Plus} from 'lucide-react';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {MetaPill} from '@/components/public/meta-pill';
import {requireUser} from '@/lib/auth/session';
import {getStaffProjects} from '@/lib/queries/authoring';
import {localised} from '@/lib/utils';
import {formatDate, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

/**
 * M7 authoring — the project list.
 *
 * Unlike the public list this shows DRAFTS, which is the point of a staff view. RLS
 * (`staff_read` on M7.READ) decides what is visible; a caller without it sees an empty
 * list rather than an error.
 */
export default async function StaffProjectsPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  await requireUser(l);

  const t = await getTranslations('authoring');
  const tPub = await getTranslations('enums.publicationStatus');
  const tStatus = await getTranslations('enums.projectStatus');

  const projects = await getStaffProjects();
  const drafts = projects.filter((p) => p.publication_status !== 'PUBLISHED');
  const live = projects.filter((p) => p.publication_status === 'PUBLISHED');

  function Row({p}: {p: (typeof projects)[number]}) {
    return (
      <li className="hmk-card flex flex-wrap items-start justify-between gap-3 p-5">
        <div className="space-y-1">
          <Link href={`/staff/projects/${p.id}`} className="font-semibold hover:text-hmk-red">
            {localised(p, 'title', l)}
          </Link>
          <p className="font-accent text-xs text-[--foreground-muted]" dir="ltr">
            {p.code}
          </p>
          {p.start_on ? (
            <time dateTime={isoDate(p.start_on)} className="block text-xs text-[--foreground-muted]">
              {formatDate(p.start_on, l)}
            </time>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MetaPill>{tStatus(p.status)}</MetaPill>
          <MetaPill>{tPub(p.publication_status)}</MetaPill>
        </div>
      </li>
    );
  }

  return (
    <>
      <PageHeading title={t('projectsTitle')} lead={t('projectsLead')} />

      <Link
        href="/staff/projects/new"
        className="mb-10 inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-5
                   py-2.5 text-sm font-semibold text-white hover:bg-hmk-red-hover"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t('newProject')}
      </Link>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">{t('draftsTitle')}</h2>
        {drafts.length === 0 ? (
          <EmptyState message={t('noDrafts')} />
        ) : (
          <ul className="space-y-3">
            {drafts.map((p) => (
              <Row key={p.id} p={p} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{t('liveTitle')}</h2>
        {live.length === 0 ? (
          <EmptyState message={t('noLive')} />
        ) : (
          <ul className="space-y-3">
            {live.map((p) => (
              <Row key={p.id} p={p} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
