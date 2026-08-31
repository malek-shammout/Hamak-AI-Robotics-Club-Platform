#!/usr/bin/env node
/**
 * Removes only records created by the repository's documented demo/E2E markers.
 *
 * Dry-run is the default. Use `node scripts/cleanup-e2e-data.mjs --execute` to
 * apply the displayed deletions against the configured Supabase project.
 */

import fs from 'node:fs';
import {createClient} from '@supabase/supabase-js';

function loadLocalEnv() {
  const target = '.env.local';
  if (!fs.existsSync(target)) return;

  for (const line of fs.readFileSync(target, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadLocalEnv();

const execute = process.argv.includes('--execute');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}

const supabase = createClient(url, serviceKey, {auth: {persistSession: false}});

const markers = {
  projects: ['DEMO-', 'D2P-PROJECT-', 'EDITORIAL-PROJECT-'],
  events: ['D2P-EVENT-', 'EDITORIAL-EVENT-'],
  articles: ['d2p-article-', 'editorial-article-'],
};
const seededDemoEmails = [
  'layla.haddad@demo.hamak.invalid',
  'omar.nasser@demo.hamak.invalid',
  'rana.khoury@demo.hamak.invalid',
  'samer.aziz@demo.hamak.invalid',
];

async function findRows(table, column, prefixes) {
  const filters = prefixes.map((prefix) => `${column}.ilike.${prefix}%`).join(',');
  const {data, error} = await supabase.from(table).select(`id,${column}`).or(filters);
  if (error) throw new Error(`Could not inspect ${table}: ${error.message}`);
  return data ?? [];
}

async function findDemoUsers() {
  const {data, error} = await supabase
    .from('users')
    .select('id,email')
    .in('email', seededDemoEmails);
  if (error) throw new Error(`Could not inspect demo users: ${error.message}`);
  return data ?? [];
}

async function countDemoDependencies(userIds) {
  if (userIds.length === 0) return 0;
  const {count, error} = await supabase
    .from('consultation_requests')
    .select('id', {count: 'exact', head: true})
    .in('requester_user_id', userIds);
  if (error) throw new Error(`Could not inspect demo consultation dependencies: ${error.message}`);
  return count ?? 0;
}

async function deleteRows(table, column, prefixes) {
  for (const prefix of prefixes) {
    const {error} = await supabase.from(table).delete().ilike(column, `${prefix}%`);
    if (error) throw new Error(`Could not delete marked ${table} rows: ${error.message}`);
  }
}

async function main() {
  const [projects, events, articles, demoUsers] = await Promise.all([
    findRows('projects', 'code', markers.projects),
    findRows('events', 'code', markers.events),
    findRows('articles', 'slug', markers.articles),
    findDemoUsers(),
  ]);
  const demoConsultations = await countDemoDependencies(demoUsers.map((user) => user.id));

  console.log('Cleanup scope (exact documented markers only):');
  console.log(`  projects: ${projects.length}`);
  console.log(`  events: ${events.length}`);
  console.log(`  articles: ${articles.length}`);
  console.log(`  demo users: ${demoUsers.length}`);
  console.log(`  demo consultation dependencies: ${demoConsultations}`);

  if (demoConsultations > 0) {
    throw new Error('Refusing to delete demo users with consultation requests; resolve those records explicitly first.');
  }

  if (!execute) {
    console.log('\nDry run only. Re-run with --execute to apply this exact scope.');
    return;
  }

  await deleteRows('articles', 'slug', markers.articles);
  await deleteRows('events', 'code', markers.events);
  await deleteRows('projects', 'code', markers.projects);

  const demoUserIds = demoUsers.map((user) => user.id);
  if (demoUserIds.length > 0) {
    const {error: assignmentsError} = await supabase
      .from('consultation_assignments')
      .delete()
      .in('expert_user_id', demoUserIds);
    if (assignmentsError) throw new Error(`Could not delete demo consultation assignments: ${assignmentsError.message}`);

    const {error: expertiseError} = await supabase
      .from('member_expertise')
      .delete()
      .in('member_user_id', demoUserIds);
    if (expertiseError) throw new Error(`Could not delete demo expertise rows: ${expertiseError.message}`);
  }

  for (const user of demoUsers) {
    const {error} = await supabase.auth.admin.deleteUser(user.id);
    if (!error) continue;

    // Some old seed runs left only the public profile behind. Keep cleanup idempotent,
    // but only fall back after the exact id and reserved seed email are rechecked.
    const {data: orphan, error: orphanError} = await supabase
      .from('users')
      .select('id,email')
      .eq('id', user.id)
      .eq('email', user.email)
      .maybeSingle();
    if (orphanError || !orphan) {
      throw new Error(`Could not delete demo auth user ${user.email}: ${error.message}`);
    }

    const {error: profileError} = await supabase
      .from('users')
      .delete()
      .eq('id', user.id)
      .eq('email', user.email);
    if (profileError) {
      throw new Error(`Could not delete demo identity ${user.email}: ${error.message}; profile fallback: ${profileError.message}`);
    }
    console.log(`  removed orphaned public demo profile: ${user.email}`);
  }

  const [remainingProjects, remainingEvents, remainingArticles, remainingUsers] = await Promise.all([
    findRows('projects', 'code', markers.projects),
    findRows('events', 'code', markers.events),
    findRows('articles', 'slug', markers.articles),
    findDemoUsers(),
  ]);
  const remaining = remainingProjects.length + remainingEvents.length + remainingArticles.length + remainingUsers.length;
  if (remaining > 0) throw new Error(`Cleanup verification failed: ${remaining} marked rows remain.`);
  console.log('\nCleanup applied and verified: no marked E2E/demo rows remain.');
}

main().catch((error) => {
  console.error(`Cleanup failed: ${error.message}`);
  process.exit(1);
});
