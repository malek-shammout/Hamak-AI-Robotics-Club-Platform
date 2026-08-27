import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {Languages} from 'lucide-react';
import {PageHeading} from '@/components/public/page-heading';
import {MetaPill} from '@/components/public/meta-pill';
import {ArticleForm} from '@/components/authoring/article-form';
import {PublishControls} from '@/components/authoring/publish-controls';
import {requireUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {getStaffArticle, getArticleCategories} from '@/lib/queries/authoring';
import {localised} from '@/lib/utils';
import type {Locale} from '@/i18n/routing';

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{locale: string; id: string}>;
}) {
  const {locale, id} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  await requireUser(l);

  const article = await getStaffArticle(id);
  if (!article) notFound();

  const t = await getTranslations('authoring');
  const tPub = await getTranslations('enums.publicationStatus');
  const [categories, mayApprove] = await Promise.all([
    getArticleCategories(),
    hasPermission('M9.APPROVE'),
  ]);

  const otherLocale = article.locale === 'ar' ? 'en' : 'ar';
  const sibling = article.siblings.find((s) => s.locale === otherLocale);

  return (
    <>
      <Link href="/staff/articles" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToArticles')}
      </Link>

      <PageHeading title={article.title} />

      <section className="hmk-card mb-8 p-6">
        <h2 className="mb-4 text-lg font-semibold">{t('publication')}</h2>
        <PublishControls
          entity="articles"
          id={article.id}
          status={article.publication_status}
          mayApprove={mayApprove}
        />
      </section>

      {/* The sibling locale is surfaced beside the publish control on purpose: this is
          the moment someone is about to make a piece public, and it is the last chance
          to notice the other language does not exist yet. */}
      <section className="mb-8 border-s-2 border-[--border] bg-[--surface] px-4 py-3">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Languages className="h-4 w-4 text-hmk-red" aria-hidden="true" />
          {sibling ? (
            <>
              <span>{t('translationExists', {locale: otherLocale})}</span>
              <Link href={`/staff/articles/${sibling.id}`} className="underline hover:text-hmk-red">
                {sibling.title}
              </Link>
              <MetaPill>{tPub(sibling.publication_status)}</MetaPill>
            </>
          ) : (
            <>
              <span className="text-hmk-red">{t('missingTranslation', {locale: otherLocale})}</span>
              <Link
                href={`/staff/articles/new?group=${article.translation_group_id}&locale=${otherLocale}`}
                className="underline hover:text-hmk-red"
              >
                {t('addTranslation')}
              </Link>
            </>
          )}
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">{t('details')}</h2>
        <ArticleForm
          defaults={article}
          categories={categories.map((c) => ({id: c.id, name: localised(c, 'name', l)}))}
        />
      </section>
    </>
  );
}
