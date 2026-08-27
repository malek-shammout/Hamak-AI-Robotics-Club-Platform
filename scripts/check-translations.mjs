#!/usr/bin/env node
/**
 * Message-catalogue parity check (claude.md §0.5 and §7).
 *
 * "Every user-facing string ships `ar` + `en`. A PR with an English-only label is
 * incomplete, not 'to be translated later'." This is what makes that enforceable rather
 * than aspirational — a missing key throws at render time in next-intl, so an untested
 * page with one absent Arabic label is a runtime crash waiting for an Arabic visitor.
 *
 * `npm run i18n:check` referenced this file for four sessions while it did not exist,
 * so the check silently never ran. It runs now.
 */
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(here, '..', 'src', 'messages');
const LOCALES = ['ar', 'en'];

function load(locale) {
  const path = join(messagesDir, `${locale}.json`);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error(`Cannot read ${path}: ${err.message}`);
    process.exit(1);
  }
}

/** Flattens to dotted leaf paths. Only leaves matter — a shared object with different
 *  children is exactly the drift this is looking for. */
function leaves(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return new Map([[prefix, value]]);
  }
  const out = new Map();
  for (const [key, child] of Object.entries(value)) {
    for (const [k, v] of leaves(child, prefix ? `${prefix}.${key}` : key)) out.set(k, v);
  }
  return out;
}

/** ICU placeholders must match, or a translated string silently drops a value. */
function placeholders(text) {
  if (typeof text !== 'string') return new Set();
  return new Set([...text.matchAll(/\{(\w+)/g)].map((m) => m[1]));
}

const catalogues = Object.fromEntries(LOCALES.map((l) => [l, leaves(load(l))]));
const [a, b] = LOCALES;
const problems = [];

for (const [locale, other] of [
  [a, b],
  [b, a],
]) {
  for (const key of catalogues[locale].keys()) {
    if (!catalogues[other].has(key)) {
      problems.push(`missing in ${other}.json: ${key}`);
    }
  }
}

for (const [key, valueA] of catalogues[a]) {
  if (!catalogues[b].has(key)) continue;
  const valueB = catalogues[b].get(key);

  if (typeof valueA === 'string' && valueA.trim() === '') {
    problems.push(`empty string in ${a}.json: ${key}`);
  }
  if (typeof valueB === 'string' && valueB.trim() === '') {
    problems.push(`empty string in ${b}.json: ${key}`);
  }

  const pa = placeholders(valueA);
  const pb = placeholders(valueB);
  const onlyA = [...pa].filter((p) => !pb.has(p));
  const onlyB = [...pb].filter((p) => !pa.has(p));
  if (onlyA.length || onlyB.length) {
    problems.push(
      `placeholder mismatch at ${key}: ${a} has {${[...pa].join(',')}}, ${b} has {${[...pb].join(',')}}`
    );
  }
}

if (problems.length > 0) {
  console.error(`Translation check FAILED — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(
  `Translation check passed: ${catalogues[a].size} keys, identical in ${LOCALES.join(' and ')}, placeholders aligned.`
);
