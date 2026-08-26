import {notFound} from 'next/navigation';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {MetaPill} from '@/components/public/meta-pill';
import {PreconditionList} from '@/components/clearance/precondition-list';
import {
  ReevaluateButton,
  ApproveClearanceForm,
  IssueCertificateButton,
} from '@/components/clearance/clearance-actions';
import {getSessionUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {getClearanceForEnrollment, type PreconditionSnapshot} from '@/lib/queries/clearance';
import {localised} from '@/lib/utils';
import {formatDateTime, isoDate} from '@/lib/format';
import type {Locale} from '@/i18n/routing';

export default async function ClearanceDetailPage({
  params,
}: {
  params: Promise<{locale: string; enrollmentId: string}>;
}) {
  const {locale, enrollmentId} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect({href: '/login', locale: l});
  if (!(await hasPermission('M6.READ'))) redirect({href: '/', locale: l});

  const t = await getTranslations('clearance');
  const data = await getClearanceForEnrollment(enrollmentId);
  if (!data) notFound();

  const {record, blockers, certificate} = data;
  const snapshot = record.precondition_snapshot as PreconditionSnapshot | null;
  const enabled = snapshot?.approval_enabled === true;
  const approved = record.status === 'APPROVED' || record.status === 'APPROVED_BY_OVERRIDE';

  const [mayApprove, mayIssue, canOverride] = await Promise.all([
    hasPermission('M6.APPROVE'),
    hasPermission('M6.CREATE'),
    hasPermission('M10.OVERRIDE'),
  ]);

  const e = record.enrollments;
  const open = blockers.filter((b) => !b.resolved_at);

  return (
    <article>
      <Link href="/staff/clearance" className="text-sm text-[--foreground-muted] hover:text-hmk-red">
        {t('backToQueue')}
      </Link>

      <PageHeading title={e?.users ? localised(e.users, 'full_name', l) : t('queueTitle')} />

      <div className="mb-6 flex flex-wrap gap-2">
        <MetaPill tone="accent">{e?.cohorts?.code}</MetaPill>
        {e?.cohorts?.courses ? (
          <MetaPill>{localised(e.cohorts.courses, 'title', l)}</MetaPill>
        ) : null}
        <MetaPill tone={approved ? 'accent' : 'default'}>{t(`statuses.${record.status}`)}</MetaPill>
      </div>

      <section className="hmk-card mb-6 space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{t('decisionTable')}</h2>
          {snapshot?.evaluated_at ? (
            <p className="text-xs text-[--foreground-muted]">
              {t('evaluatedAt')}{' '}
              <time dateTime={isoDate(snapshot.evaluated_at)}>
                {formatDateTime(snapshot.evaluated_at, l)}
              </time>
            </p>
          ) : null}
        </div>

        {/* A1 is shown to A3/A7 only, and clearly separated from C1..C5. */}
        <PreconditionList snapshot={snapshot} showAdvisory />

        <ReevaluateButton enrollmentId={enrollmentId} />
      </section>

      {open.length > 0 ? (
        <section className="hmk-card mb-6 p-6">
          <h2 className="mb-3 text-sm font-semibold">{t('openBlockers')}</h2>
          <ul className="space-y-2 text-sm">
            {open.map((b) => (
              <li key={b.id} className="text-[--foreground-muted]">
                <span className="font-accent text-xs text-hmk-red">{b.blocker_code}</span>
                {' — '}
                {l === 'ar' ? b.detail_ar : b.detail_en}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {record.is_override && record.override_justification ? (
        <p className="mb-6 max-w-2xl border-s-2 border-hmk-red bg-hmk-red-subtle px-4 py-2 text-sm">
          {t('approvedByOverride', {reason: record.override_justification})}
        </p>
      ) : null}

      {!approved && mayApprove ? (
        <section className="hmk-card mb-6 space-y-3 p-6">
          <h2 className="text-sm font-semibold">{t('approveTitle')}</h2>
          <ApproveClearanceForm
            enrollmentId={enrollmentId}
            enabled={enabled}
            canOverride={canOverride}
          />
        </section>
      ) : null}

      {approved ? (
        <section className="hmk-card space-y-3 p-6">
          <h2 className="text-sm font-semibold">{t('certificateTitle')}</h2>
          {certificate ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-[--foreground-muted]">{t('serialNo')}</dt>
                <dd className="mt-1 font-accent text-sm">{certificate.serial_no}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[--foreground-muted]">{t('issuedOn')}</dt>
                <dd className="mt-1">
                  <time dateTime={isoDate(certificate.issued_at)}>
                    {formatDateTime(certificate.issued_at, l)}
                  </time>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs uppercase text-[--foreground-muted]">{t('verificationCode')}</dt>
                <dd className="mt-1 font-accent text-xs" dir="ltr">{certificate.verification_code}</dd>
              </div>
            </dl>
          ) : mayIssue ? (
            <IssueCertificateButton enrollmentId={enrollmentId} />
          ) : (
            <p className="text-sm text-[--foreground-muted]">{t('noIssuePermission')}</p>
          )}
        </section>
      ) : null}
    </article>
  );
}
