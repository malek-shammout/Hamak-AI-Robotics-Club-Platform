import {getTranslations, setRequestLocale} from 'next-intl/server';
import {PageHeading} from '@/components/public/page-heading';
import {MetaPill} from '@/components/public/meta-pill';
import {CheckCircle2, XCircle, AlertTriangle} from 'lucide-react';
import {verifyCertificate} from '@/lib/queries/public';
import {localised} from '@/lib/utils';
import {formatDate, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

/**
 * BR-10 - public, unauthenticated certificate verification.
 *
 * The code arrives as a query param so a verifier can be handed a direct link
 * (or a QR code) that resolves without any typing. Backed by the SECURITY DEFINER
 * RPC from migration 0005, so no roster data is exposed.
 */
export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{code?: string}>;
}) {
  const {locale} = await params;
  const {code} = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('verify');
  const tEnum = await getTranslations('enums');
  const l = locale as Locale;

  const result = code ? await verifyCertificate(code) : null;
  const searched = Boolean(code);
  const revoked = result?.cert_status === 'REVOKED' || Boolean(result?.revoked_at);

  return (
    <>
      <PageHeading title={t('title')} lead={t('lead')} />

      <form method="get" className="mb-8 flex max-w-lg flex-wrap gap-2">
        <label htmlFor="code" className="sr-only">
          {t('placeholder')}
        </label>
        <input
          id="code"
          name="code"
          defaultValue={code ?? ''}
          placeholder={t('placeholder')}
          dir="ltr"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-[--radius-control] border border-[--border]
                     bg-[--surface] px-3 py-2 font-accent text-sm"
        />
        <button
          type="submit"
          className="rounded-[--radius-control] bg-hmk-red px-5 py-2 text-sm font-semibold
                     text-white transition-colors hover:bg-hmk-red-hover"
        >
          {t('submit')}
        </button>
      </form>

      {searched && !result ? (
        <div className="hmk-card flex items-center gap-3 p-5">
          <XCircle className="h-5 w-5 text-[--foreground-muted]" aria-hidden="true" />
          <p>{t('notFound')}</p>
        </div>
      ) : null}

      {result ? (
        <div className="hmk-card max-w-2xl p-6">
          <div className="flex items-center gap-3">
            {revoked ? (
              <AlertTriangle className="h-6 w-6 text-hmk-red" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-hmk-red" aria-hidden="true" />
            )}
            <h2 className="text-xl font-semibold">{revoked ? t('revoked') : t('valid')}</h2>
          </div>

          {revoked ? (
            <p className="mt-3 border-s-2 border-hmk-red bg-hmk-red-subtle px-4 py-2 text-sm">
              {t('revokedWarning')}
            </p>
          ) : null}

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-[--foreground-muted]">{t('holder')}</dt>
              <dd className="mt-1 font-medium">{localised(result, 'student_name', l)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-[--foreground-muted]">{t('course')}</dt>
              <dd className="mt-1 font-medium">
                {localised(result, 'course_title', l)}{' '}
                <MetaPill>{tEnum(`level.${result.course_level}`)}</MetaPill>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-[--foreground-muted]">{t('cohort')}</dt>
              <dd className="mt-1 font-accent text-sm">{result.cohort_code}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-[--foreground-muted]">{t('serialNo')}</dt>
              <dd className="mt-1 font-accent text-sm">{result.serial_no}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-[--foreground-muted]">{t('issuedOn')}</dt>
              <dd className="mt-1">
                <time dateTime={isoDate(result.issued_at)}>{formatDate(result.issued_at, l)}</time>
              </dd>
            </div>
            {result.revoked_at ? (
              <div>
                <dt className="text-xs uppercase text-[--foreground-muted]">{t('revokedOn')}</dt>
                <dd className="mt-1">
                  <time dateTime={isoDate(result.revoked_at)}>
                    {formatDate(result.revoked_at, l)}
                  </time>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}
    </>
  );
}
