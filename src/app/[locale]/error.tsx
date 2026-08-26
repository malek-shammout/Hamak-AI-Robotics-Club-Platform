'use client';

import {useTranslations} from 'next-intl';

export default function Error({reset}: {error: Error; reset: () => void}) {
  const t = useTranslations('errors');
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold">{t('genericTitle')}</h1>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-[--radius-control] bg-hmk-red px-5 py-2.5 text-sm
                   font-semibold text-white hover:bg-hmk-red-hover"
      >
        {t('retry')}
      </button>
    </div>
  );
}
