import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeNextRun, type RecurringFrequency, type RecurringTemplate } from '@/lib/recurring'

let lastSweep = 0

/**
 * Posts an order for every active schedule whose next_run_at has passed.
 * Each schedule is claimed by advancing next_run_at in a conditional update,
 * so overlapping sweeps can never post the same run twice.
 */
export async function runRecurringSweep({ throttleMs = 0 }: { throttleMs?: number } = {}) {
  const now = Date.now()
  if (throttleMs && now - lastSweep < throttleMs) return { skipped: true, created: 0 }
  lastSweep = now

  const db = createAdminClient()
  const { data: due } = await db
    .from('recurring_deliveries')
    .select('id, business_id, location_id, template, frequency, days_of_week, time_of_day, timezone, next_run_at')
    .eq('active', true)
    .lte('next_run_at', new Date(now).toISOString())
    .limit(100)

  let created = 0
  for (const s of due ?? []) {
    const next = computeNextRun(s.frequency as RecurringFrequency, s.days_of_week ?? [], s.time_of_day, s.timezone, new Date(now))
    const { data: claimed } = await db
      .from('recurring_deliveries')
      .update({ next_run_at: next.toISOString(), last_run_at: new Date(now).toISOString() })
      .eq('id', s.id)
      .eq('next_run_at', s.next_run_at)
      .select('id')
    if (!claimed?.length || !s.location_id) continue

    const { data: loc } = await db
      .from('business_locations')
      .select('address, area, lat, lng')
      .eq('id', s.location_id)
      .maybeSingle<{ address: string; area: string; lat: number | null; lng: number | null }>()
    if (!loc) continue

    const t = s.template as RecurringTemplate
    const { error } = await db.from('deliveries').insert({
      business_id: s.business_id,
      location_id: s.location_id,
      status: 'posted',
      pickup_address: loc.address,
      pickup_area: loc.area,
      pickup_lat: loc.lat,
      pickup_lng: loc.lng,
      dropoff_address: t.dropoffAddress,
      dropoff_area: t.dropoffArea,
      dropoff_postal_code: t.dropoffPostalCode ?? null,
      dropoff_lat: t.dropoffLat ?? null,
      dropoff_lng: t.dropoffLng ?? null,
      recipient_name: t.recipientName ?? null,
      recipient_phone: t.recipientPhone ?? null,
      recipient_note: t.recipientNote ?? null,
      is_rush: !!t.isRush,
      is_urgent: !!t.isRush,
      is_out_of_town: false,
      require_signature: !!t.requireSignature,
      require_photo: true,
      require_pin: !!t.requirePin,
      handoff_rule: 'door',
      handoff_set_by: 'business',
      recurring_id: s.id,
      posted_at: new Date(now).toISOString(),
      retry_count: 0,
    })
    if (error) console.error('recurring insert failed', s.id, error.message)
    else created++
  }
  return { skipped: false, created }
}
