import 'server-only';

import {createHash} from 'node:crypto';
import {buildCertificateHtml, type CertificateData} from './template';

export type RenderedCertificate = {
  bytes: Buffer;
  sha256: string;
  byteSize: number;
};

/**
 * Renders a certificate to PDF bytes and hashes them.
 *
 * REQUIRES the Playwright Chromium binary:  npx playwright install chromium
 * Playwright is already a devDependency; the browser download is separate.
 *
 * The hash is taken HERE, over the exact bytes that get uploaded — not re-derived
 * later from what storage returns. Hashing what you actually stored is the whole
 * point of RR-4's tamper evidence.
 */
export async function renderCertificatePdf(
  data: CertificateData
): Promise<RenderedCertificate> {
  const html = await buildCertificateHtml(data);

  // Imported lazily so that merely importing this module does not pull Chromium
  // into every server bundle that happens to touch certificates.
  const {chromium} = await import('playwright');

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, {waitUntil: 'load'});
    const bytes = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: {top: '0', right: '0', bottom: '0', left: '0'},
    });

    return {
      bytes,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      byteSize: bytes.byteLength,
    };
  } finally {
    await browser.close();
  }
}
