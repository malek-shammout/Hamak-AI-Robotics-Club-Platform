#!/usr/bin/env node
import {createClient} from '@supabase/supabase-js';

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
  const value = process.env[name] ?? args.get(name.toLowerCase()) ?? fallback;
  return value;
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

try {
  const {data: existing, error: lookupErr} = await supabase.auth.admin.listUsers();
  if (lookupErr) throw lookupErr;
  const match = existing.users.find((user) => user.email?.toLowerCase() === normalizedEmail);

  const userId = match?.id;

  if (!userId) {
    const {data: created, error: createErr} = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: passwordValue,
      email_confirm: true,
      user_metadata: {
        full_name_ar: displayAr,
        full_name_en: displayEn,
        user_type: 'MEMBER',
        locale: 'ar',
      },
    });

    if (createErr) throw createErr;
    if (!created.user) throw new Error('User creation returned no user record.');
    console.log(`Created auth user ${created.user.id} for ${normalizedEmail}`);
  } else {
    console.log(`Existing auth user found for ${normalizedEmail}: ${userId}`);
  }

  const {data: currentUser, error: userErr} = await supabase.auth.admin.listUsers();
  if (userErr) throw userErr;
  const effectiveUser = currentUser.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
  if (!effectiveUser) throw new Error(`Could not resolve the created user for ${normalizedEmail}`);

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
