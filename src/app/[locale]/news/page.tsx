import {getTranslations, setRequestLocale} from 'next-intl/server';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {CardGrid} from '@/components/public/card-grid';
import {ContentCard} from '@/components/public/content-card';
import {MetaPill} from '@/components/public/meta-pill';
import {getPublishedArticles} from '@/lib/queries/public';
import {localised} from '@/lib/utils';
import {formatDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function NewsPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('news');
  const l = locale as Locale;

  const articles = await getPublishedArticles(l);

  return (
    <>
      <PageHeading title={t('title')} lead={t('lead')} />

      {articles.length === 0 ? (
        <EmptyState message={t('empty')} />
      ) : (
        <CardGrid>
          {articles.map((a) => (
            <ContentCard
              key={a.id}
              href={`/news/${a.slug}`}
              title={a.title}
              description={a.summary}
              meta={
                a.article_categories ? (
                  <MetaPill tone="accent">
                    {localised(a.article_categories, 'name', l)}
                  </MetaPill>
                ) : null
              }
              footer={a.published_at ? `${t('publishedOn')} ${formatDate(a.published_at, l)}` : null}
            />
          ))}
        </CardGrid>
      )}
    </>
  );
}
