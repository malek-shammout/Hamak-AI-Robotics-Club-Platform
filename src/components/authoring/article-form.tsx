'use client';

import {useActionState} from 'react';
import {useTranslations} from 'next-intl';
import {Save} from 'lucide-react';
import {createArticle, updateArticle, type AuthoringState} from '@/lib/authoring/actions';

export type ArticleDefaults = {
  id?: string;
  slug?: string;
  locale?: string;
  title?: string;
  summary?: string | null;
  body?: string | null;
  article_category_id?: string | null;
};

const field =
  'w-full rounded-[--radius-control] border border-[--border] bg-[--surface] px-3 py-2 text-sm';

/**
 * One article row = one LOCALE of an article (claude.md §5: long-form content is
 * row-per-locale, joined by `translation_group_id`).
 *
 * `translationGroupId` is passed when adding the second language to an existing piece.
 * Without it a new group is started. Getting this wrong is how you end up with two
 * unrelated articles that look like a translation pair but never resolve as one.
 */
export function ArticleForm({
  defaults,
  categories,
  translationGroupId,
  lockedLocale,
}: {
  defaults?: ArticleDefaults;
  categories: {id: string; name: string}[];
  translationGroupId?: string;
  lockedLocale?: 'ar' | 'en';
}) {
  const t = useTranslations('authoring');
  const tErr = useTranslations('authoring.errors');
  const editing = Boolean(defaults?.id);
  const [state, action, pending] = useActionState<AuthoringState, FormData>(
    editing ? updateArticle : createArticle,
    undefined
  );

  const locale = lockedLocale ?? (defaults?.locale as 'ar' | 'en' | undefined) ?? 'ar';
  // The body direction follows the CONTENT language, not the UI language — an Arabic
  // article authored from the English admin page is still Arabic.
  const contentDir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <form action={action} className="hmk-card space-y-5 p-6">
      {editing ? <input type="hidden" name="id" value={defaults!.id} /> : null}
      {translationGroupId ? (
        <input type="hidden" name="translationGroupId" value={translationGroupId} />
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="locale" className="block text-xs font-medium">
            {t('contentLanguage')}
          </label>
          <select
            id="locale"
            name="locale"
            required
            defaultValue={locale}
            disabled={Boolean(lockedLocale)}
            className={field}
          >
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
          {lockedLocale ? (
            <>
              {/* A disabled select submits nothing, so the value travels in a hidden
                  field — otherwise the locale would silently arrive empty. */}
              <input type="hidden" name="locale" value={lockedLocale} />
              <p className="text-xs text-[--foreground-muted]">{t('lockedLocaleNote')}</p>
            </>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="slug" className="block text-xs font-medium">
            {t('slug')}
          </label>
          <input
            id="slug"
            name="slug"
            required
            maxLength={120}
            dir="ltr"
            pattern="[a-z0-9\-]+"
            defaultValue={defaults?.slug}
            className={field}
          />
          <p className="text-xs text-[--foreground-muted]">{t('slugHint')}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="title" className="block text-xs font-medium">
          {t('articleTitle')}
        </label>
        <input
          id="title"
          name="title"
          required
          maxLength={300}
          dir={contentDir}
          lang={locale}
          defaultValue={defaults?.title}
          className={field}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="summary" className="block text-xs font-medium">
          {t('summary')}
        </label>
        <textarea
          id="summary"
          name="summary"
          rows={2}
          maxLength={1000}
          dir={contentDir}
          lang={locale}
          defaultValue={defaults?.summary ?? ''}
          className={field}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="body" className="block text-xs font-medium">
          {t('body')}
        </label>
        <textarea
          id="body"
          name="body"
          rows={14}
          required
          dir={contentDir}
          lang={locale}
          defaultValue={defaults?.body ?? ''}
          className={field}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="categoryId" className="block text-xs font-medium">
          {t('category')}
        </label>
        <select
          id="categoryId"
          name="categoryId"
          defaultValue={defaults?.article_category_id ?? ''}
          className={field}
        >
          <option value="">{t('noCategory')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-[--radius-control] bg-hmk-red px-5 py-2.5
                   text-sm font-semibold text-white hover:bg-hmk-red-hover disabled:opacity-60"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        {pending ? t('saving') : editing ? t('save') : t('create')}
      </button>

      {!editing ? <p className="text-xs text-[--foreground-muted]">{t('startsAsDraft')}</p> : null}

      {state?.error ? (
        <p role="alert" className="text-sm text-hmk-red">
          {tErr(state.error)}
        </p>
      ) : null}
      {state?.ok ? (
        <p role="status" className="text-sm text-[--foreground-muted]">
          {t('saved')}
        </p>
      ) : null}
    </form>
  );
}
