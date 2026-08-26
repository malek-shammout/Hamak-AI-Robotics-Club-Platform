import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {getArticleBySlug} from '@/lib/queries/public';
import {formatDate, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function ArticlePage({
  params,
}: {
  params: Promise<{locale: string; slug: string}>;
}) {
  const {locale, slug} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('news');
  const tCommon = await getTranslations('common');
  const l = locale as Locale;

  const result = await getArticleBySlug(slug, l);
  if (!result) notFound();
  const {article, isFallback} = result;

  return (
    <article>
      <Link href="/news" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {tCommon('backToList')}
      </Link>

      <PageHeading title={article.title} />

      {/* claude.md 7 - row-per-locale means a translation may be missing. Say so
          explicitly and mark the element's real language for screen readers. */}
      {isFallback ? (
        <p
          lang={article.locale}
          className="mb-6 border-s-2 border-hmk-red bg-hmk-red-subtle px-4 py-2 text-sm"
        >
          {tCommon('translationFallback')}
        </p>
      ) : null}

      {article.published_at ? (
        <p className="mb-6 text-sm text-[--foreground-muted]">
          {t('publishedOn')}{' '}
          <time dateTime={isoDate(article.published_at)}>
            {formatDate(article.published_at, l)}
          </time>
        </p>
      ) : null}

      <div lang={article.locale} className="max-w-3xl space-y-4">
        {article.summary ? <p className="text-lg text-[--foreground-muted]">{article.summary}</p> : null}
        {article.body ? <p className="whitespace-pre-line">{article.body}</p> : null}
      </div>
    </article>
  );
}
