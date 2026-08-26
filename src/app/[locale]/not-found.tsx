import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('errors');
  return (
    <div className="py-20 text-center">
      <p className="font-accent text-6xl text-hmk-red">404</p>
      <h1 className="mt-4 text-2xl font-bold">{t('notFoundTitle')}</h1>
      <p className="mt-2 text-[--foreground-muted]">{t('notFoundBody')}</p>
      <Link href="/" className="mt-6 inline-block font-medium text-hmk-red hover:underline">
        {t('backHome')}
      </Link>
    </div>
  );
}
