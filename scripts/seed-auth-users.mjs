// Creates Supabase Auth users for every predefined account.
// Run with: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-auth-users.mjs
// Idempotent: if a user exists, it updates their password + profile metadata.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_SUPABASE_URL // Supabase integration shape
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  console.error('URL ok?', Boolean(SUPABASE_URL), '  KEY ok?', Boolean(SERVICE_KEY))
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEFAULT_PASSWORD = 'lvcourier2026'

const USERS = [
  // Admins
  { email: 'admin@lvcourier.ca',       role: 'admin',    name: 'Admin User' },
  { email: 'ops@lvcourier.ca',         role: 'admin',    name: 'Operations' },
  // Drivers
  { email: 'marcus@lvcourier.ca',      role: 'driver',   name: 'Marcus Chen',     driver_id: '33333333-3333-3333-3333-333333333001' },
  { email: 'sarah@lvcourier.ca',       role: 'driver',   name: 'Sarah Williams',  driver_id: '33333333-3333-3333-3333-333333333002' },
  { email: 'david@lvcourier.ca',       role: 'driver',   name: 'David Patel',     driver_id: '33333333-3333-3333-3333-333333333003' },
  // Businesses — main accounts
  { email: 'freshmart@lvcourier.ca',   role: 'business', name: 'FreshMart',       business_id: '11111111-1111-1111-1111-111111111001', location_id: '22222222-2222-2222-2222-222222222001' },
  { email: 'medsupply@lvcourier.ca',   role: 'business', name: 'MedSupply Co',    business_id: '11111111-1111-1111-1111-111111111002', location_id: '22222222-2222-2222-2222-222222222003' },
  { email: 'homegoods@lvcourier.ca',   role: 'business', name: 'HomeGoods',       business_id: '11111111-1111-1111-1111-111111111003', location_id: '22222222-2222-2222-2222-222222222004' },
]

async function upsertUser(u) {
  // Look up existing
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listErr) throw listErr
  const existing = list.users.find(x => x.email?.toLowerCase() === u.email.toLowerCase())

  const metadata = {
    full_name: u.name,
    role: u.role,
    ...(u.business_id ? { business_id: u.business_id } : {}),
    ...(u.location_id ? { location_id: u.location_id } : {}),
    ...(u.driver_id ? { driver_id: u.driver_id } : {}),
  }

  let userId
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: metadata,
    })
    if (error) throw error
    userId = data.user.id
    console.log(`[updated] ${u.email} (${u.role})`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: metadata,
    })
    if (error) throw error
    userId = data.user.id
    console.log(`[created] ${u.email} (${u.role})`)
  }

  // Ensure profile row is in sync (the trigger fires on insert; for existing
  // users we update directly to ensure the role/business/driver links are set).
  const { error: upErr } = await admin.from('profiles').upsert({
    id: userId,
    email: u.email,
    full_name: u.name,
    role: u.role,
    business_id: u.business_id || null,
    location_id: u.location_id || null,
    driver_id: u.driver_id || null,
  })
  if (upErr) throw upErr
}

for (const u of USERS) {
  try {
    await upsertUser(u)
  } catch (err) {
    console.error(`[failed] ${u.email}:`, err?.message || err)
    process.exitCode = 1
  }
}
console.log('\nDone. Password for every account: ' + DEFAULT_PASSWORD)
