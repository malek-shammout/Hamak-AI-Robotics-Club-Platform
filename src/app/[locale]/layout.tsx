import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {NextIntlClientProvider, hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {routing, dirOf, type Locale} from '@/i18n/routing';
import {madani, minecraft} from '@/lib/fonts';
import {Providers} from '@/components/providers';
import {SiteHeader} from '@/components/site-header';
import {SiteFooter} from '@/components/site-footer';
import '@/styles/globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{locale: string}>;
}): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'meta'});

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
    title: {default: t('title'), template: `%s | ${t('shortTitle')}`},
    description: t('description'),
    robots: {index: true, follow: true},
    openGraph: {
      type: 'website',
      siteName: t('shortTitle'),
      title: t('title'),
      description: t('description'),
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
    },
    alternates: {
      languages: {ar: '/ar', en: '/en'},
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Enables static rendering for this locale segment.
  setRequestLocale(locale);

  const t = await getTranslations({locale, namespace: 'nav'});

  return (
    <html
      lang={locale}
      dir={dirOf(locale as Locale)}
      suppressHydrationWarning
      className={`${madani.variable} ${minecraft.variable}`}
    >
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          <Providers>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2
                         focus:bg-[--surface] focus:px-4 focus:py-2"
            >
              {t('skipToContent')}
            </a>
            <SiteHeader locale={locale as Locale} />
            <main id="main" className="mx-auto max-w-6xl px-4 py-10">
              {children}
            </main>
            <SiteFooter />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
