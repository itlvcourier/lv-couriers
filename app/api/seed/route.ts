import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Admin-only seed endpoint. Creates demo auth users + core business/driver/rate card
 * data. Safe to run multiple times — uses upsert and ON CONFLICT DO NOTHING semantics.
 *
 * Call via: POST /api/seed with header `Authorization: Bearer <SEED_SECRET>`
 * Or via the /admin/seed UI page while logged in as an existing admin.
 */
const DEMO_PASSWORD = 'lvcourier2026'

const BUSINESSES = [
  {
    id: '11111111-1111-1111-1111-111111111001',
    name: 'FreshMart',
    billing_email: 'freshmart@lvcourier.ca',
    invoice_format: 'combined' as const,
    locations: [
      {
        id: '22222222-2222-2222-2222-222222222001',
        name: 'Shawnessy',
        address: '14, 250 Shawville Blvd SE, Calgary, AB',
        billing_email: 'freshmart@lvcourier.ca',
        rate: { rate_regular: 9, rate_big_double: 18, rate_oot_big: 25, rate_rush: 20, rate_rush_oot: 30 },
      },
      {
        id: '22222222-2222-2222-2222-222222222002',
        name: 'Signal Hill',
        address: '5708 Signal Hill Centre SW, Calgary, AB',
        billing_email: 'freshmart@lvcourier.ca',
        rate: { rate_regular: 9, rate_big_double: 18, rate_oot_big: 25, rate_rush: 20, rate_rush_oot: 30 },
      },
    ],
  },
  {
    id: '11111111-1111-1111-1111-111111111002',
    name: 'MedSupply Co',
    billing_email: 'medsupply@lvcourier.ca',
    invoice_format: 'separate' as const,
    locations: [
      {
        id: '22222222-2222-2222-2222-222222222003',
        name: 'Main Warehouse',
        address: '2520 23 St NE, Calgary, AB',
        billing_email: 'medsupply@lvcourier.ca',
        rate: { rate_regular: 12, rate_big_double: 24, rate_oot_big: 35, rate_rush: 22, rate_rush_oot: 32 },
      },
    ],
  },
  {
    id: '11111111-1111-1111-1111-111111111003',
    name: 'HomeGoods',
    billing_email: 'homegoods@lvcourier.ca',
    invoice_format: 'combined_breakdown' as const,
    locations: [
      {
        id: '22222222-2222-2222-2222-222222222004',
        name: 'Deerfoot',
        address: '901 64 Ave NE, Calgary, AB',
        billing_email: 'homegoods@lvcourier.ca',
        rate: { rate_regular: 9, rate_big_double: 18, rate_oot_big: 25, rate_rush: 20, rate_rush_oot: 30 },
      },
    ],
  },
]

const DRIVERS = [
  {
    id: '33333333-3333-3333-3333-333333333001',
    name: 'Marcus Chen',
    email: 'marcus@lvcourier.ca',
    phone: '403-555-0101',
  },
  {
    id: '33333333-3333-3333-3333-333333333002',
    name: 'Sarah Williams',
    email: 'sarah@lvcourier.ca',
    phone: '403-555-0102',
  },
  {
    id: '33333333-3333-3333-3333-333333333003',
    name: 'David Patel',
    email: 'david@lvcourier.ca',
    phone: '403-555-0103',
  },
]

const ADMINS = [
  { email: 'admin@lvcourier.ca', full_name: 'Lv Admin' },
]

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') || ''
  const providedSecret = authHeader.replace(/^Bearer\s+/i, '').trim()
  const expectedSecret = process.env.SEED_SECRET || process.env.CRON_SECRET

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Supabase admin env vars missing' }, { status: 500 })
  }

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const log: string[] = []

  try {
    // 1. Insert businesses + locations + rate cards
    for (const biz of BUSINESSES) {
      const { error: bizErr } = await admin.from('businesses').upsert({
        id: biz.id,
        name: biz.name,
        billing_email: biz.billing_email,
        invoice_format: biz.invoice_format,
        status: 'active',
      })
      if (bizErr) throw new Error(`business ${biz.name}: ${bizErr.message}`)

      for (const loc of biz.locations) {
        const { error: locErr } = await admin.from('business_locations').upsert({
          id: loc.id,
          business_id: biz.id,
          name: loc.name,
          address: loc.address,
          billing_email: loc.billing_email,
          is_default: true,
        })
        if (locErr) throw new Error(`location ${loc.name}: ${locErr.message}`)

        // Rate card is auto-seeded by migration 033 trigger; update it with custom rates.
        const { error: rcErr } = await admin
          .from('rate_cards')
          .update({
            ...loc.rate,
            gst_applicable: true,
            effective_date: new Date().toISOString().split('T')[0],
          })
          .eq('location_id', loc.id)
        if (rcErr) log.push(`rate_card update for ${loc.name}: ${rcErr.message}`)
      }
      log.push(`business ${biz.name} + ${biz.locations.length} locations ready`)
    }

    // 2. Insert drivers
    for (const drv of DRIVERS) {
      const { error } = await admin.from('drivers').upsert({
        id: drv.id,
        name: drv.name,
        email: drv.email,
        phone: drv.phone,
        status: 'available',
        total_deliveries: 0,
        today_deliveries: 0,
        month_deliveries: 0,
        invite_status: 'active',
      })
      if (error) throw new Error(`driver ${drv.name}: ${error.message}`)
    }
    log.push(`${DRIVERS.length} drivers ready`)

    // 3. Create auth users with metadata linking them to their profile records.
    const ensureUser = async (email: string, password: string, metadata: Record<string, string>) => {
      // Check if already exists by listing users (service role has access)
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      const existing = list?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
      if (existing) {
        // Update password + metadata in case they changed
        await admin.auth.admin.updateUserById(existing.id, {
          password,
          user_metadata: metadata,
        })
        // Upsert profile in case trigger didn't fire on existing users.
        await admin.from('profiles').upsert({
          id: existing.id,
          email,
          full_name: metadata.full_name,
          role: metadata.role,
          business_id: metadata.business_id || null,
          location_id: metadata.location_id || null,
          driver_id: metadata.driver_id || null,
        })
        return { email, status: 'updated', id: existing.id }
      }
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      })
      if (error) throw new Error(`auth user ${email}: ${error.message}`)
      return { email, status: 'created', id: data.user?.id }
    }

    const userResults: unknown[] = []

    for (const a of ADMINS) {
      userResults.push(await ensureUser(a.email, DEMO_PASSWORD, { full_name: a.full_name, role: 'admin' }))
    }
    for (const biz of BUSINESSES) {
      userResults.push(await ensureUser(biz.billing_email, DEMO_PASSWORD, {
        full_name: biz.name,
        role: 'business',
        business_id: biz.id,
        location_id: biz.locations[0].id,
      }))
    }
    for (const drv of DRIVERS) {
      const userRes = await ensureUser(drv.email, DEMO_PASSWORD, {
        full_name: drv.name,
        role: 'driver',
        driver_id: drv.id,
      })
      // Link driver.user_id back to the auth user
      if (userRes.id) {
        await admin.from('drivers').update({ user_id: userRes.id }).eq('id', drv.id)
      }
      userResults.push(userRes)
    }

    log.push(`${userResults.length} auth users ready (password: ${DEMO_PASSWORD})`)

    return NextResponse.json({
      ok: true,
      log,
      users: userResults,
      credentials: {
        admin: `admin@lvcourier.ca / ${DEMO_PASSWORD}`,
        business: `freshmart@lvcourier.ca / ${DEMO_PASSWORD}`,
        driver: `marcus@lvcourier.ca / ${DEMO_PASSWORD}`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message, log }, { status: 500 })
  }
}

// Convenience for manual testing in the browser
export async function GET(req: Request) {
  return POST(req)
}
