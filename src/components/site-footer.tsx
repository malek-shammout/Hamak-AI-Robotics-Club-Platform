import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {BinaryBar} from './binary-bar';

export async function SiteFooter() {
  const t = await getTranslations('footer');
  const tVerify = await getTranslations('verify');
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-[--border] bg-[--surface]">
      <BinaryBar />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-sm text-[--foreground-muted]">
        <p>
          {year} {t('rights')}
        </p>
        {/* BR-10 — certificate verification is a public, unauthenticated entry point.
            It belongs in the footer where a third party checking a credential will
            look for it, not buried in the member navigation. */}
        <Link href="/verify" className="ms-auto hover:text-hmk-red">
          {tVerify('title')}
        </Link>
      </div>
    </footer>
  );
}
