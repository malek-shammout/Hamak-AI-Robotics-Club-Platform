import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {ClubMap} from '@/components/club-map';
import {BinaryBar} from '@/components/binary-bar';
import type {Locale} from '@/i18n/routing';

export default async function HomePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  return (
    <div className="space-y-14">
      <section className="space-y-5">
        <p className="font-accent text-xs tracking-[0.3em] text-hmk-red uppercase">
          {t('eyebrow')}
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          {t('headline')}
        </h1>
        <p className="max-w-2xl text-lg text-[--foreground-muted]">{t('subhead')}</p>

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/courses"
            className="rounded-[--radius-control] bg-hmk-red px-5 py-2.5 text-sm font-semibold
                       text-white transition-colors hover:bg-hmk-red-hover"
          >
            {t('ctaPrimary')}
          </Link>
          {/* This pointed at /projects while M2 was unbuilt, because the original
              /consultations target 404'd on every prefetch. M2 shipped in session 006,
              so the intended CTA is back. */}
          <Link
            href="/consultations"
            className="rounded-[--radius-control] border border-[--border] px-5 py-2.5
                       text-sm font-semibold transition-colors hover:border-hmk-red hover:text-hmk-red"
          >
            {t('ctaSecondaryConsultations')}
          </Link>
        </div>
      </section>

      <BinaryBar />

      <ClubMap locale={locale as Locale} />
    </div>
  );
}
