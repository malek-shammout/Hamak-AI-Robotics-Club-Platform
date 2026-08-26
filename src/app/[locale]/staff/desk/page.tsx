import {getTranslations, setRequestLocale} from 'next-intl/server';
import {redirect, Link} from '@/i18n/navigation';
import {PageHeading} from '@/components/public/page-heading';
import {IssueForm} from '@/components/logistics/issue-form';
import {getSessionUser} from '@/lib/auth/session';
import {hasPermission} from '@/lib/auth/permissions';
import {getEligibleHolders, getAvailableUnits, getBulkTypes} from '@/lib/queries/logistics';
import {createClient} from '@/lib/supabase/server';
import {localised} from '@/lib/utils';
import type {Locale} from '@/i18n/routing';

export default async function IssueDeskPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const l = locale as Locale;

  const user = await getSessionUser();
  if (!user) redirect({href: '/login', locale: l});
  if (!(await hasPermission('M5.CREATE'))) redirect({href: '/', locale: l});

  const t = await getTranslations('desk');

  const supabase = await createClient();
  const [holdersRaw, units, bulk, isAdmin, {data: policy}] = await Promise.all([
    getEligibleHolders(),
    getAvailableUnits(),
    getBulkTypes(),
    hasPermission('M10.OVERRIDE'),
    supabase.from('system_policies').select('value').eq('key', 'custody.default_loan_days').maybeSingle(),
  ]);

  const holders = holdersRaw.map((h) => ({
    id: h.id,
    student_user_id: h.student_user_id,
    name: h.users ? localised(h.users, 'full_name', l) : '-',
    cohort: h.cohorts?.code ?? '-',
    openLiabilities: h.openLiabilities,
  }));

  const unitOptions = units
    .filter((u) => u.asset_types?.tracking_mode === 'SERIALIZED')
    .map((u) => ({
      id: u.id,
      asset_type_id: u.asset_type_id,
      asset_tag: u.asset_tag,
      label: [u.asset_types?.name, u.asset_types?.manufacturer, u.asset_types?.model]
        .filter(Boolean)
        .join(' · '),
    }));

  const bulkOptions = bulk.map((b) => ({
    id: b.id,
    label: [b.name, b.manufacturer, b.model].filter(Boolean).join(' · '),
    is_consumable: b.is_consumable,
  }));

  const loanDays = Number(policy?.value ?? 14) || 14;

  return (
    <>
      <PageHeading title={t('issueTitle')} lead={t('issueLead')} />

      <nav className="mb-6 flex flex-wrap gap-4 text-sm">
        <Link href="/staff/checkouts" className="text-[--foreground-muted] hover:text-hmk-red">
          {t('outstandingLink')}
        </Link>
        <Link href="/staff/liabilities" className="text-[--foreground-muted] hover:text-hmk-red">
          {t('liabilitiesLink')}
        </Link>
        <Link href="/staff/assets" className="text-[--foreground-muted] hover:text-hmk-red">
          {t('catalogueLink')}
        </Link>
      </nav>

      <IssueForm
        holders={holders}
        units={unitOptions}
        bulkTypes={bulkOptions}
        isAdmin={isAdmin}
        defaultLoanDays={loanDays}
      />
    </>
  );
}
