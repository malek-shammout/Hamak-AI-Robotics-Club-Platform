#!/usr/bin/env node
import fs from 'node:fs';
import {createClient} from '@supabase/supabase-js';

function loadLocalEnv() {
  const target = '.env.local';
  if (!fs.existsSync(target)) return;

  for (const line of fs.readFileSync(target, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const current = process.argv[i];
  if (!current.startsWith('--')) continue;

  const [rawName, rawValue] = current.split('=');
  const key = rawName.replace(/^--/, '').toLowerCase();

  if (rawValue !== undefined) {
    args.set(key, rawValue);
    continue;
  }

  const next = process.argv[i + 1];
  if (next && !next.startsWith('--')) {
    args.set(key, next);
    i += 1;
  } else {
    args.set(key, '');
  }
}

function envOrArg(name, fallback) {
  const aliases = {
    HMK_STAFF_EMAIL: ['HMK_STAFF_EMAIL', 'E2E_EMAIL', 'email'],
    HMK_STAFF_PASSWORD: ['HMK_STAFF_PASSWORD', 'E2E_PASSWORD', 'password'],
    HMK_STAFF_ROLE: ['HMK_STAFF_ROLE', 'role'],
  };

  const names = aliases[name] ?? [name];
  for (const candidate of names) {
    const directEnv = process.env[candidate];
    if (directEnv !== undefined && directEnv !== '') return directEnv;

    const directArg = args.get(candidate.toLowerCase());
    if (directArg !== undefined && directArg !== '') return directArg;
  }

  return fallback;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = envOrArg('HMK_STAFF_EMAIL', envOrArg('E2E_EMAIL', ''));
const password = envOrArg('HMK_STAFF_PASSWORD', envOrArg('E2E_PASSWORD', ''));
const roleCode = String(envOrArg('HMK_STAFF_ROLE', 'PROJECTS')).toUpperCase();

if (!url) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL. Add it to .env.local or export it in the shell.');
  process.exit(2);
}
if (!serviceKey) {
  console.error(
    'Missing SUPABASE_SERVICE_ROLE_KEY. Pass it for one run, or set it in .env.local:' +
      '\n  SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/bootstrap-staff-account.mjs'
  );
  process.exit(2);
}
if (!email || !password) {
  console.error(
    'Missing staff credentials. Provide them via HMK_STAFF_EMAIL / HMK_STAFF_PASSWORD or use:' +
      '\n  E2E_EMAIL=... E2E_PASSWORD=... node scripts/bootstrap-staff-account.mjs'
  );
  process.exit(2);
}

const allowedRoles = new Set(['ADMIN', 'TRAINING', 'LOGISTICS', 'PROJECTS', 'EVENTS', 'MEDIA', 'STUDENT']);
if (!allowedRoles.has(roleCode)) {
  console.error(`Unsupported role: ${roleCode}. Use one of: ${[...allowedRoles].join(', ')}`);
  process.exit(2);
}

const supabase = createClient(url, serviceKey, {auth: {persistSession: false}});

const normalizedEmail = email.trim().toLowerCase();
const passwordValue = password.trim();

const displayAr = 'عضو اختبار فريق';
const displayEn = 'Staff Test Member';

async function fetchJson(targetUrl, options = {}) {
  const response = await fetch(targetUrl, options);
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail = payload && typeof payload === 'object' ? payload.msg || payload.error || JSON.stringify(payload) : String(payload);
    throw new Error(`${response.status} ${detail || response.statusText}`);
  }

  return payload;
}

async function getPublicUserByEmail(targetEmail) {
  const encoded = encodeURIComponent(targetEmail);
  const rows = await fetchJson(
    `${url}/rest/v1/users?email=eq.${encoded}&select=id,email,full_name_en`,
    {
      method: 'GET',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

try {
  let effectiveUser = await getPublicUserByEmail(normalizedEmail);

  if (!effectiveUser) {
    const created = await fetchJson(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password: passwordValue,
        email_confirm: true,
        user_metadata: {
          full_name_ar: displayAr,
          full_name_en: displayEn,
          user_type: 'MEMBER',
          locale: 'ar',
        },
      }),
    });

    if (!created?.id) throw new Error('User creation succeeded but no user id was returned.');
    effectiveUser = {id: created.id, email: normalizedEmail};
    console.log(`Created auth user ${created.id} for ${normalizedEmail}`);
  } else {
    console.log(`Existing auth user found for ${normalizedEmail}: ${effectiveUser.id}`);
  }

  const {data: dept, error: deptErr} = await supabase
    .from('departments')
    .select('id, code')
    .eq('code', roleCode)
    .maybeSingle();
  if (deptErr) throw deptErr;
  if (!dept) throw new Error(`Department role ${roleCode} does not exist in the database.`);

  const {data: role, error: roleErr} = await supabase
    .from('roles')
    .select('id, code')
    .eq('code', roleCode)
    .maybeSingle();
  if (roleErr) throw roleErr;
  if (!role) throw new Error(`Role ${roleCode} is missing from public.roles.`);

  const {data: existingRole, error: existingRoleErr} = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', effectiveUser.id)
    .eq('role_id', role.id)
    .is('revoked_at', null)
    .maybeSingle();
  if (existingRoleErr) throw existingRoleErr;

  if (!existingRole) {
    const {error: assignErr} = await supabase.from('user_roles').insert({
      user_id: effectiveUser.id,
      role_id: role.id,
      department_id: dept.id,
      assigned_by: null,
      assigned_at: new Date().toISOString(),
      expires_at: null,
      revoked_at: null,
    });
    if (assignErr) throw assignErr;
    console.log(`Assigned role ${roleCode} to ${effectiveUser.id}`);
  } else {
    console.log(`Role ${roleCode} already present for ${effectiveUser.id}`);
  }

  const {data: memberProfile, error: memberErr} = await supabase
    .from('member_profiles')
    .select('user_id')
    .eq('user_id', effectiveUser.id)
    .maybeSingle();
  if (memberErr) throw memberErr;
  if (!memberProfile) {
    const {error: profileErr} = await supabase.from('member_profiles').insert({
      user_id: effectiveUser.id,
      primary_department_id: dept.id,
      joined_on: new Date().toISOString().slice(0, 10),
      membership_status: 'ACTIVE',
      bio_ar: 'Staff E2E account',
      bio_en: 'Staff E2E account',
    });
    if (profileErr) throw profileErr;
    console.log(`Created member profile for ${effectiveUser.id}`);
  }

  console.log('\nReady for Playwright:');
  console.log(`E2E_EMAIL=${normalizedEmail}`);
  console.log(`E2E_PASSWORD=${passwordValue}`);
  console.log('npm run test:e2e');
} catch (error) {
  console.error('Bootstrap failed:');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
