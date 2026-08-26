import 'server-only';

import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

export type CertificateData = {
  serialNo: string;
  verificationCode: string;
  studentNameAr: string;
  studentNameEn: string;
  courseTitleAr: string;
  courseTitleEn: string;
  cohortCode: string;
  issuedAt: string;
  issuedUnderOverride: boolean;
  verifyUrl: string;
};

/**
 * Builds the certificate as HTML, to be rendered by Chromium.
 *
 * WHY HTML AND NOT A PDF LIBRARY: pdf-lib and @react-pdf/renderer draw glyphs in the
 * order given. Arabic needs bidirectional reordering AND contextual shaping — the same
 * letter takes a different form initial, medial, final or isolated. Neither library
 * does either, so Arabic comes out as disconnected letters in reverse. Chromium's text
 * stack does both correctly, which is why the renderer is a browser.
 *
 * The Madani font is embedded as a data URI so the document renders identically
 * offline and on any machine — a certificate that depends on a network font is a
 * certificate that renders differently in five years.
 */
async function madaniDataUri(): Promise<string> {
  const path = join(process.cwd(), 'src', 'fonts', 'Madani-Bold.ttf');
  const buf = await readFile(path);
  return `data:font/ttf;base64,${buf.toString('base64')}`;
}

export async function buildCertificateHtml(d: CertificateData): Promise<string> {
  const font = await madaniDataUri();

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Madani';
    src: url('${font}') format('truetype');
    font-weight: 400 700;
  }
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Madani', 'Segoe UI', sans-serif;
    width: 297mm; height: 210mm;
    background: #ffffff; color: #14171a;
    display: flex; flex-direction: column;
    padding: 18mm 20mm;
    font-variant-numeric: lining-nums tabular-nums;
  }
  .rule { height: 3px; background: #e31e24; }
  .binary {
    font-family: 'Courier New', monospace; font-size: 7pt; letter-spacing: .28em;
    color: #6b7280; opacity: .35; overflow: hidden; white-space: nowrap; margin: 3mm 0;
    /* Without this the digit run inherits rtl and bidi reordering drags the trailing
       character to the front, so the bar renders as "1 01001000..." — visible as a
       defect on a formal document even though the element is decorative. */
    direction: ltr;
  }
  header { display: flex; justify-content: space-between; align-items: baseline; }
  .mark { font-family: 'Courier New', monospace; font-size: 20pt; letter-spacing: .3em; color: #e31e24; }
  .org { font-size: 10pt; color: #5b6470; text-align: left; direction: ltr; }
  main { flex: 1; display: flex; flex-direction: column; justify-content: center; text-align: center; }
  .kicker { font-size: 11pt; color: #5b6470; letter-spacing: .1em; }
  .name { font-size: 30pt; font-weight: 700; margin: 6mm 0 2mm; }
  .name-en { font-size: 14pt; color: #5b6470; direction: ltr; margin-bottom: 8mm; }
  .course { font-size: 17pt; font-weight: 700; }
  .course-en { font-size: 12pt; color: #5b6470; direction: ltr; margin-top: 1mm; }
  footer { display: flex; justify-content: space-between; align-items: flex-end; font-size: 9pt; }
  .meta { text-align: right; line-height: 1.7; }
  .meta .lbl { color: #6b7280; }
  .mono { font-family: 'Courier New', monospace; direction: ltr; unicode-bidi: embed; }
  .verify { text-align: left; direction: ltr; color: #5b6470; line-height: 1.7; }
  .override { margin-top: 4mm; font-size: 8pt; color: #6b7280; }
</style>
</head>
<body>
  <div class="rule"></div>
  <div class="binary">${'01001000 01001101 01001011 '.repeat(14)}</div>

  <header>
    <span class="mark">HMK</span>
    <span class="org">
      نادي الهمك للذكاء الصنعي والروبوتيك<br>
      HMK AI &amp; Robotics Club
    </span>
  </header>

  <main>
    <p class="kicker">تشهد إدارة النادي بأن</p>
    <p class="name">${esc(d.studentNameAr)}</p>
    <p class="name-en">${esc(d.studentNameEn)}</p>
    <p class="kicker">قد أتمّ بنجاح متطلبات دورة</p>
    <p class="course">${esc(d.courseTitleAr)}</p>
    <p class="course-en">${esc(d.courseTitleEn)}</p>
    ${d.issuedUnderOverride
      ? '<p class="override">صدرت هذه الشهادة باستثناء إداري موثّق.</p>'
      : ''}
  </main>

  <div class="binary">${'01001000 01001101 01001011 '.repeat(14)}</div>

  <footer>
    <div class="meta">
      <div><span class="lbl">الرقم التسلسلي:</span> <span class="mono">${esc(d.serialNo)}</span></div>
      <div><span class="lbl">الدفعة:</span> <span class="mono">${esc(d.cohortCode)}</span></div>
      <div><span class="lbl">تاريخ الإصدار:</span> <span class="mono">${esc(d.issuedAt)}</span></div>
    </div>
    <div class="verify">
      Verify at<br>
      <span class="mono">${esc(d.verifyUrl)}</span><br>
      <span class="mono">${esc(d.verificationCode)}</span>
    </div>
  </footer>
  <div class="rule"></div>
</body>
</html>`;
}

/** Certificate fields come from the database, but escaping is not optional anywhere. */
function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
