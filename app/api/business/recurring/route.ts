import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeNextRun, type RecurringFrequency, type RecurringTemplate } from '@/lib/recurring'

async function businessAuth(req: NextRequest) {
  const auth = await requireAuth(req)
  if (isAuthError(auth)) return auth
  if (auth.profile.role !== 'business' || !auth.profile.business_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return auth
}

export async function GET(req: NextRequest) {
  const auth = await businessAuth(req)
  if (isAuthError(auth)) return auth
  const { data, error } = await createAdminClient()
    .from('recurring_deliveries')
    .select('id, name, location_id, template, frequency, days_of_week, time_of_day, timezone, active, next_run_at, last_run_at, created_at')
    .eq('business_id', auth.profile.business_id!)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ schedules: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await businessAuth(req)
  if (isAuthError(auth)) return auth
  const body = (await req.json().catch(() => null)) as {
    name?: string; locationId?: string; frequency?: RecurringFrequency; daysOfWeek?: number[]
    timeOfDay?: string; template?: RecurringTemplate
  } | null
  const t = body?.template
  if (!body?.name?.trim() || !body.locationId || !t?.dropoffAddress?.trim() || !t.dropoffArea?.trim()) {
    return NextResponse.json({ error: 'Name, pickup location and drop-off address are required' }, { status: 400 })
  }
  if (!['daily', 'weekdays', 'weekly'].includes(body.frequency ?? '')) {
    return NextResponse.json({ error: 'Invalid frequency' }, { status: 400 })
  }
  const time = /^\d{2}:\d{2}$/.test(body.timeOfDay ?? '') ? body.timeOfDay! : '09:00'
  const days = (body.daysOfWeek ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  if (body.frequency === 'weekly' && !days.length) {
    return NextResponse.json({ error: 'Pick at least one day' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data: loc } = await db
    .from('business_locations')
    .select('id, business_id')
    .eq('id', body.locationId)
    .maybeSingle<{ id: string; business_id: string }>()
  if (!loc || loc.business_id !== auth.profile.business_id) {
    return NextResponse.json({ error: 'Unknown location' }, { status: 400 })
  }

  const tz = 'America/Toronto'
  const template: RecurringTemplate = {
    dropoffAddress: t.dropoffAddress.trim().slice(0, 300),
    dropoffArea: t.dropoffArea.trim().slice(0, 100),
    dropoffPostalCode: t.dropoffPostalCode ?? null,
    dropoffLat: typeof t.dropoffLat === 'number' ? t.dropoffLat : null,
    dropoffLng: typeof t.dropoffLng === 'number' ? t.dropoffLng : null,
    recipientName: t.recipientName?.slice(0, 120) ?? null,
    recipientPhone: t.recipientPhone?.slice(0, 30) ?? null,
    recipientNote: t.recipientNote?.slice(0, 500) ?? null,
    isRush: !!t.isRush,
    requireSignature: !!t.requireSignature,
    requirePin: !!t.requirePin,
  }
  const { data, error } = await db
    .from('recurring_deliveries')
    .insert({
      business_id: auth.profile.business_id,
      location_id: loc.id,
      name: body.name.trim().slice(0, 120),
      template,
      frequency: body.frequency,
      days_of_week: days,
      time_of_day: time,
      timezone: tz,
      next_run_at: computeNextRun(body.frequency!, days, time, tz).toISOString(),
      created_by: auth.user.id,
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}

export async function PATCH(req: NextRequest) {
  const auth = await businessAuth(req)
  if (isAuthError(auth)) return auth
  const body = (await req.json().catch(() => null)) as { id?: string; active?: boolean } | null
  if (!body?.id || typeof body.active !== 'boolean') return NextResponse.json({ error: 'id and active required' }, { status: 400 })
  const db = createAdminClient()
  const { data: row } = await db
    .from('recurring_deliveries')
    .select('frequency, days_of_week, time_of_day, timezone')
    .eq('id', body.id)
    .eq('business_id', auth.profile.business_id!)
    .maybeSingle<{ frequency: RecurringFrequency; days_of_week: number[]; time_of_day: string; timezone: string }>()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { error } = await db
    .from('recurring_deliveries')
    .update({
      active: body.active,
      next_run_at: body.active ? computeNextRun(row.frequency, row.days_of_week, row.time_of_day, row.timezone).toISOString() : null,
    })
    .eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const auth = await businessAuth(req)
  if (isAuthError(auth)) return auth
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await createAdminClient()
    .from('recurring_deliveries')
    .delete()
    .eq('id', id)
    .eq('business_id', auth.profile.business_id!)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
