import {getTranslations, setRequestLocale} from 'next-intl/server';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {CardGrid} from '@/components/public/card-grid';
import {ContentCard} from '@/components/public/content-card';
import {MetaPill} from '@/components/public/meta-pill';
import {getPublishedProjects} from '@/lib/queries/public';
import {localised} from '@/lib/utils';
import type {Locale} from '@/i18n/routing';

export default async function ProjectsPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('projects');
  const tEnum = await getTranslations('enums');
  const l = locale as Locale;

  const projects = await getPublishedProjects();

  return (
    <>
      <PageHeading title={t('title')} lead={t('lead')} />

      {projects.length === 0 ? (
        <EmptyState message={t('empty')} />
      ) : (
        <CardGrid>
          {projects.map((p) => {
            const techs = (p.project_technologies ?? [])
              .map((pt) => pt.technologies?.name)
              .filter(Boolean) as string[];
            return (
              <ContentCard
                key={p.id}
                href={`/projects/${p.code}`}
                title={localised(p, 'title', l)}
                description={p.abstract}
                meta={<MetaPill tone="accent">{tEnum(`projectStatus.${p.status}`)}</MetaPill>}
                footer={techs.length > 0 ? techs.slice(0, 4).join(' · ') : null}
              />
            );
          })}
        </CardGrid>
      )}
    </>
  );
}
