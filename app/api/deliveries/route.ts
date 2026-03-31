import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { status, deliveryId, driverId } = await req.json()

    if (!status || !deliveryId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('deliveries')
      .update({
        status,
        driver_id: driverId || undefined,
        ...(status === 'claimed' && { claimed_at: new Date().toISOString() }),
        ...(status === 'picked_up' && { picked_up_at: new Date().toISOString() }),
        ...(status === 'delivered' && { delivered_at: new Date().toISOString() }),
      })
      .eq('id', deliveryId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Add activity event
    await supabase.from('activity_events').insert({
      delivery_id: deliveryId,
      driver_id: driverId,
      action: `Delivery ${status}`,
      status,
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[v0] API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
