import {getTranslations, setRequestLocale} from 'next-intl/server';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {CardGrid} from '@/components/public/card-grid';
import {ContentCard} from '@/components/public/content-card';
import {MetaPill} from '@/components/public/meta-pill';
import {getPublishedCourses} from '@/lib/queries/public';
import {localised} from '@/lib/utils';
import type {Locale} from '@/i18n/routing';

export default async function CoursesPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('courses');
  const tEnum = await getTranslations('enums');
  const l = locale as Locale;

  const courses = await getPublishedCourses();

  return (
    <>
      <PageHeading title={t('title')} lead={t('lead')} />

      {courses.length === 0 ? (
        <EmptyState message={t('empty')} />
      ) : (
        <CardGrid>
          {courses.map((c) => (
            <ContentCard
              key={c.id}
              href={`/courses/${c.code}`}
              title={localised(c, 'title', l)}
              description={localised(c, 'description', l)}
              meta={
                <>
                  <MetaPill tone="accent">{tEnum(`track.${c.track}`)}</MetaPill>
                  <MetaPill>{tEnum(`level.${c.level}`)}</MetaPill>
                  {c.requires_screening ? <MetaPill>{t('screeningRequired')}</MetaPill> : null}
                </>
              }
              footer={
                <span>
                  {c.session_count ? `${c.session_count} ${t('sessions')}` : null}
                  {c.session_count && c.duration_hours ? ' · ' : null}
                  {c.duration_hours ? `${c.duration_hours} ${t('hours')}` : null}
                </span>
              }
            />
          ))}
        </CardGrid>
      )}
    </>
  );
}
