#!/usr/bin/env node
/**
 * Verifies the certificate storage path end to end (RR-4).
 *
 * WHAT THIS PROVES, against the real bucket:
 *   1. a rendered PDF uploads to the PRIVATE `certificates` bucket via service-role
 *   2. `upsert: false` refuses to overwrite an existing object
 *   3. a short-lived signed URL downloads the bytes
 *   4. the downloaded bytes hash to EXACTLY the value recorded at upload
 *      (this is the tamper-evidence claim, actually exercised rather than asserted)
 *   5. the anon key CANNOT read the object, with or without a path guess
 *   6. cleanup removes the probe object
 *
 * The service-role key is read from the environment and never written to disk.
 * Run it as a one-shot, e.g.
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/verify-certificate-storage.mjs
 */

import {createHash, randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(2);
}
if (!serviceKey) {
  console.error(
    'Missing SUPABASE_SERVICE_ROLE_KEY.\n' +
      'It is deliberately absent from .env.local - a full-RLS-bypass credential should not\n' +
      'sit on disk. Pass it for one run instead:\n' +
      '  SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/verify-certificate-storage.mjs'
  );
  process.exit(2);
}

const service = createClient(url, serviceKey, {auth: {persistSession: false}});
const anon = createClient(url, anonKey, {auth: {persistSession: false}});

const BUCKET = 'certificates';
const key = `__probe__/${randomUUID()}.pdf`;

// A minimal but genuinely valid PDF, so the content type is not a lie.
const bytes = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n',
  'utf8'
);
const expectedHash = createHash('sha256').update(bytes).digest('hex');

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

console.log(`Verifying the ${BUCKET} storage path\n`);

try {
  // 1 — upload
  const {error: upErr} = await service.storage
    .from(BUCKET)
    .upload(key, bytes, {contentType: 'application/pdf', upsert: false});
  check('service-role uploads to the private bucket', !upErr, upErr?.message);

  // 2 — write-once at the storage layer
  const {error: dupErr} = await service.storage
    .from(BUCKET)
    .upload(key, Buffer.from('DIFFERENT BYTES'), {
      contentType: 'application/pdf',
      upsert: false,
    });
  check('upsert:false refuses to overwrite an existing object', Boolean(dupErr),
        dupErr ? `refused: ${dupErr.message}` : 'OVERWRITE SUCCEEDED — RR-4 lock 4 is gone');

  // 3 — signed URL
  const {data: signed, error: signErr} = await service.storage
    .from(BUCKET)
    .createSignedUrl(key, 120);
  check('a 120s signed URL is minted', Boolean(signed?.signedUrl) && !signErr, signErr?.message);

  // 4 — round-trip the bytes and re-hash
  if (signed?.signedUrl) {
    const res = await fetch(signed.signedUrl);
    const downloaded = Buffer.from(await res.arrayBuffer());
    const actualHash = createHash('sha256').update(downloaded).digest('hex');
    check('signed URL downloads the object', res.ok, `HTTP ${res.status}`);
    check('downloaded bytes hash to the recorded value', actualHash === expectedHash,
          actualHash === expectedHash ? expectedHash.slice(0, 16) + '…'
                                      : `expected ${expectedHash.slice(0,16)}… got ${actualHash.slice(0,16)}…`);
  }

  // 5 — the anon key must not reach it. This is RR-4 lock 1: the bucket has no client
  //     storage policy at all, so knowing the exact path must still not be enough.
  const {data: anonData, error: anonErr} = await anon.storage.from(BUCKET).download(key);
  check('anon CANNOT download the object even knowing its path',
        Boolean(anonErr) || !anonData,
        anonErr ? `refused: ${anonErr.message}` : 'ANON READ SUCCEEDED — RR-4 lock 1 is gone');

  const {data: anonList} = await anon.storage.from(BUCKET).list('__probe__');
  check('anon CANNOT list the bucket', !anonList || anonList.length === 0,
        anonList?.length ? `listed ${anonList.length} object(s)` : 'empty');

  // 6 — public URL must not serve it either (the bucket is private)
  const {data: pub} = service.storage.from(BUCKET).getPublicUrl(key);
  if (pub?.publicUrl) {
    const pubRes = await fetch(pub.publicUrl);
    check('the public URL does not serve a private object', !pubRes.ok, `HTTP ${pubRes.status}`);
  }
} finally {
  const {error: rmErr} = await service.storage.from(BUCKET).remove([key]);
  console.log(`\n  cleanup: ${rmErr ? 'FAILED — ' + rmErr.message : 'probe object removed'}`);
}

console.log(failures === 0 ? '\nAll storage checks passed.' : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
