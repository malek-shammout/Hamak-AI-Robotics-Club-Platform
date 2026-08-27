import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {ArticleForm} from '@/components/authoring/article-form';
import {requireUser} from '@/lib/auth/session';
import {getArticleCategories} from '@/lib/queries/authoring';
import {localised} from '@/lib/utils';
import type {Locale} from '@/i18n/routing';

/**
 * Creating one LOCALE of an article.
 *
 * `?group=<uuid>&locale=ar` arrives from the "add translation" link on the list, which
 * is how the second language joins an existing `translation_group_id` instead of
 * starting an orphan group that will never resolve as a pair.
 */
export default async function NewArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{group?: string; locale?: string}>;
}) {
  const {locale} = await params;
  const {group, locale: contentLocale} = await searchParams;
  setRequestLocale(locale);
  const l = locale as Locale;

  await requireUser(l);
  const t = await getTranslations('authoring');
  const categories = await getArticleCategories();

  const locked = contentLocale === 'ar' || contentLocale === 'en' ? contentLocale : undefined;

  return (
    <>
      <Link href="/staff/articles" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToArticles')}
      </Link>
      <PageHeading
        title={group ? t('addTranslation') : t('newArticle')}
        lead={group ? t('addTranslationLead') : t('newArticleLead')}
      />
      <ArticleForm
        categories={categories.map((c) => ({id: c.id, name: localised(c, 'name', l)}))}
        translationGroupId={group}
        lockedLocale={locked}
      />
    </>
  );
}
