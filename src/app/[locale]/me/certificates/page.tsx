import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {Award, ShieldAlert} from 'lucide-react';
import {PageHeading} from '@/components/public/page-heading';
import {EmptyState} from '@/components/public/empty-state';
import {MetaPill} from '@/components/public/meta-pill';
import {getSessionUser} from '@/lib/auth/session';
import {getMyCertificates, getMyClearances, type PreconditionSnapshot} from '@/lib/queries/clearance';
import {localised} from '@/lib/utils';
import {formatDate, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function MyCertificatesPage({
  params,
}: {
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect({href: '/login', locale: l});

  const t = await getTranslations('myCerts');
  const [certificates, clearances] = await Promise.all([getMyCertificates(), getMyClearances()]);

  const pending = clearances.filter(
    (c) => c.status !== 'APPROVED' && c.status !== 'APPROVED_BY_OVERRIDE'
  );

  return (
    <>
      <PageHeading title={t('title')} lead={t('lead')} />

      {/* §B.2: the student sees their OWN blockers (C1..C5) and never the A1 advisory,
          which concerns other enrollments entirely. getMyClearances omits it. */}
      {pending.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">{t('pendingTitle')}</h2>
          <ul className="space-y-3">
            {pending.map((c) => {
              const snap = c.precondition_snapshot as PreconditionSnapshot | null;
              const course = c.enrollments?.cohorts?.courses;
              return (
                <li key={c.id} className="hmk-card space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {course ? localised(course, 'title', l) : c.enrollments?.cohorts?.code}
                      </p>
                      <p className="mt-1 font-accent text-xs text-[--foreground-muted]">
                        {c.enrollments?.cohorts?.code}
                      </p>
                    </div>
                    <MetaPill>{t(`statuses.${c.status}`)}</MetaPill>
                  </div>

                  {c.blockers.length > 0 ? (
                    <ul className="space-y-1.5">
                      {c.blockers.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-[--foreground-muted]">
                          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-hmk-red" aria-hidden="true" />
                          <span>{l === 'ar' ? b.detail_ar : b.detail_en}</span>
                        </li>
                      ))}
                    </ul>
                  ) : snap?.approval_enabled ? (
                    <p className="text-sm text-[--foreground-muted]">{t('awaitingApproval')}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <h2 className="mb-3 text-lg font-semibold">{t('issuedTitle')}</h2>
      {certificates.length === 0 ? (
        <EmptyState message={t('empty')} />
      ) : (
        <ul className="space-y-3">
          {certificates.map((c) => {
            const course = c.enrollments?.cohorts?.courses;
            const revoked = c.status === 'REVOKED';
            return (
              <li key={c.id} className="hmk-card space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <Award className="mt-0.5 h-5 w-5 shrink-0 text-hmk-red" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">
                        {course ? localised(course, 'title', l) : c.enrollments?.cohorts?.code}
                      </p>
                      <p className="mt-1 text-xs text-[--foreground-muted]">
                        <span className="font-accent">{c.serial_no}</span>
                        {' · '}
                        <time dateTime={isoDate(c.issued_at)}>{formatDate(c.issued_at, l)}</time>
                      </p>
                    </div>
                  </div>
                  <MetaPill tone={revoked ? 'default' : 'accent'}>
                    {t(`certStatuses.${c.status}`)}
                  </MetaPill>
                </div>

                <div className="space-y-1">
                  <p className="text-xs uppercase text-[--foreground-muted]">{t('verificationCode')}</p>
                  <p className="font-accent text-xs" dir="ltr">{c.verification_code}</p>
                  <Link
                    href={`/verify?code=${c.verification_code}`}
                    className="inline-block text-xs font-medium text-hmk-red hover:underline"
                  >
                    {t('verifyLink')}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
