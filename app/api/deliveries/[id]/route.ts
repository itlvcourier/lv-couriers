import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireDeliveryParty, requireAdmin, isAuthError } from '@/lib/auth-guard'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deliveryId } = await params
  const auth = await requireDeliveryParty(req, deliveryId)
  if (isAuthError(auth)) return auth

  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('deliveries')
      .select(
        `
        *,
        businesses(name, address, phone),
        drivers!deliveries_driver_id_fkey(name, phone, rating),
        status_history(*),
        activity_events(*)
      `
      )
      .eq('id', deliveryId)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[v0] API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req)
  if (isAuthError(auth)) return auth

  try {
    const supabase = await createClient()
    const { id: deliveryId } = await params
    const body = await req.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid update payload' }, { status: 400 })
    }
    const blockedFields = new Set([
      'id', 'business_id', 'location_id', 'tracking_code', 'recipient_phone',
      'driver_id', 'pickup_driver_id', 'holder_driver_id', 'sorted_for_driver_id',
      'created_at', 'updated_at', 'delivered_at', 'proof_photo_url', 'signature_url',
    ])
    const updateData = Object.fromEntries(Object.entries(body).filter(([key]) => !blockedFields.has(key)))
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('deliveries')
      .update(updateData)
      .eq('id', deliveryId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[v0] API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
