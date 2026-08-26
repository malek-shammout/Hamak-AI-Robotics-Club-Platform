import {getTranslations, setRequestLocale} from 'next-intl/server';
import {MailCheck} from 'lucide-react';
import {PageHeading} from '@/components/public/page-heading';

export default async function CheckEmailPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  return (
    <>
      <PageHeading title={t('checkEmailTitle')} />
      <div className="hmk-card flex max-w-md items-start gap-3 p-6">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-hmk-red" aria-hidden="true" />
        <p className="text-[--foreground-muted]">{t('checkEmailBody')}</p>
      </div>
    </>
  );
}
