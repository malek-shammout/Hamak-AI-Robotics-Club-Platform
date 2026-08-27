import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {Plus, Languages, TriangleAlert} from 'lucide-react';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {MetaPill} from '@/components/public/meta-pill';
import {requireUser} from '@/lib/auth/session';
import {getStaffArticles} from '@/lib/queries/authoring';
import {formatDate, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

/**
 * M9 authoring — the article list, grouped by translation group.
 *
 * Articles are row-per-locale (claude.md §5), so the unit a writer thinks in is the
 * GROUP, not the row. Listing rows flat would make a half-translated piece look like two
 * unrelated articles, which is exactly how one language quietly ships without the other.
 */
export default async function StaffArticlesPage({
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

  const articles = await getStaffArticles();

  const groups = new Map<string, typeof articles>();
  for (const a of articles) {
    const key = a.translation_group_id ?? a.id;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }

  return (
    <>
      <PageHeading title={t('articlesTitle')} lead={t('articlesLead')} />

      <Link
        href="/staff/articles/new"
        className="mb-10 inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-5
                   py-2.5 text-sm font-semibold text-white hover:bg-hmk-red-hover"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t('newArticle')}
      </Link>

      {groups.size === 0 ? (
        <EmptyState message={t('noArticles')} />
      ) : (
        <ul className="space-y-3">
          {[...groups.entries()].map(([group, rows]) => {
            const locales = rows.map((r) => r.locale);
            const missing = (['ar', 'en'] as const).filter((x) => !locales.includes(x));
            const anyPublished = rows.some((r) => r.publication_status === 'PUBLISHED');

            return (
              <li key={group} className="hmk-card space-y-3 p-5">
                <ul className="space-y-2">
                  {rows.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <Link
                          href={`/staff/articles/${a.id}`}
                          className="font-semibold hover:text-hmk-red"
                          lang={a.locale}
                          dir={a.locale === 'ar' ? 'rtl' : 'ltr'}
                        >
                          {a.title}
                        </Link>
                        <p className="font-accent text-xs text-[--foreground-muted]" dir="ltr">
                          {a.locale} · {a.slug}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {a.published_at ? (
                          <time
                            dateTime={isoDate(a.published_at)}
                            className="text-xs text-[--foreground-muted]"
                          >
                            {formatDate(a.published_at, l)}
                          </time>
                        ) : null}
                        <MetaPill>{tPub(a.publication_status)}</MetaPill>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* A published article existing in only one language is a real defect for
                    half the audience, so it is surfaced here rather than discovered by a
                    visitor hitting a dead end. */}
                {missing.length > 0 ? (
                  <p
                    className={`flex items-center gap-2 text-xs ${
                      anyPublished ? 'text-hmk-red' : 'text-[--foreground-muted]'
                    }`}
                  >
                    {anyPublished ? (
                      <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Languages className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {anyPublished
                      ? t('publishedWithoutTranslation', {locale: missing.join(', ')})
                      : t('missingTranslation', {locale: missing.join(', ')})}
                    <Link
                      href={`/staff/articles/new?group=${group}&locale=${missing[0]}`}
                      className="underline hover:text-hmk-red"
                    >
                      {t('addTranslation')}
                    </Link>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
