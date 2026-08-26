#!/usr/bin/env node
/**
 * Database test runner.
 *
 * Every business rule in this platform is enforced inside PostgreSQL, because
 * SECURITY DEFINER domain functions bypass RLS and must assert their own authorisation
 * (claude.md D-11). Testing them over HTTP would test the wrapper, not the rule.
 *
 * Each test in supabase/tests/ is a self-contained adversarial probe that ends with
 *   raise exception 'ALL_<AREA>_PASSED'
 * That raise aborts the transaction, so a test NEVER persists a row — pass or fail.
 * This runner therefore treats an error whose message matches /^ALL_[A-Z0-9_]+_PASSED$/
 * as success, and every other outcome as failure.
 *
 * A test that returns successfully is ALSO a failure: it means the final raise was
 * removed or never reached, so the assertions did not run to completion and rows may
 * have been left behind.
 */

import {readdir, readFile} from 'node:fs/promises';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const TESTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'tests');
const PASS_RE = /ALL_[A-Z0-9_]+_PASSED/;

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;

if (!token || !ref) {
  console.error(
    'Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF.\n' +
      'These are read from the environment and never from a file in the repo.'
  );
  process.exit(2);
}

const ENDPOINT = `https://api.supabase.com/v1/projects/${ref}/database/query`;

async function runOne(name, sql) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({query: sql}),
  });

  const text = await res.text();

  if (res.ok) {
    // The probe completed without raising. Its final assertion never fired.
    return {
      ok: false,
      detail:
        'test returned without raising — the closing ALL_..._PASSED is missing or unreachable, ' +
        'so assertions did not complete and rows may have been committed',
    };
  }

  if (PASS_RE.test(text)) return {ok: true};

  let detail = text;
  try {
    const parsed = JSON.parse(text);
    detail = parsed?.error?.message ?? parsed?.message ?? text;
  } catch {
    /* keep raw text */
  }
  return {ok: false, detail: String(detail).replace(/\s+/g, ' ').trim().slice(0, 400)};
}

const files = (await readdir(TESTS_DIR)).filter((f) => f.endsWith('.sql')).sort();

if (files.length === 0) {
  console.error(`No .sql tests found in ${TESTS_DIR}`);
  process.exit(2);
}

console.log(`Running ${files.length} database tests against project ${ref}\n`);

let passed = 0;
const failures = [];

for (const file of files) {
  const sql = await readFile(join(TESTS_DIR, file), 'utf8');
  process.stdout.write(`  ${file.padEnd(46)}`);

  let result;
  try {
    result = await runOne(file, sql);
  } catch (err) {
    result = {ok: false, detail: `runner error: ${err.message}`};
  }

  if (result.ok) {
    passed += 1;
    console.log('PASS');
  } else {
    console.log('FAIL');
    failures.push({file, detail: result.detail});
  }
}

console.log(`\n${passed}/${files.length} passed`);

if (failures.length > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`\n  ${f.file}\n    ${f.detail}`);
  process.exit(1);
}

console.log('All database rules verified. No rows persisted.');
