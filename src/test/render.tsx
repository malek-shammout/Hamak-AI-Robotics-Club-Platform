import {render as rtlRender} from '@testing-library/react';
import {NextIntlClientProvider} from 'next-intl';
import type {ReactElement} from 'react';
import en from '@/messages/en.json';
import ar from '@/messages/ar.json';

/**
 * Renders a component inside the real message catalogue.
 *
 * Using the ACTUAL `en.json`/`ar.json` rather than a stub is deliberate: next-intl
 * throws on a missing key, so every component test doubles as a check that the strings
 * it asks for exist in the catalogue. A test with stubbed messages would happily pass
 * against a label that ships blank.
 */
export function render(ui: ReactElement, {locale = 'en'}: {locale?: 'ar' | 'en'} = {}) {
  const messages = locale === 'ar' ? ar : en;
  return rtlRender(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Damascus">
      {ui}
    </NextIntlClientProvider>
  );
}

export * from '@testing-library/react';
