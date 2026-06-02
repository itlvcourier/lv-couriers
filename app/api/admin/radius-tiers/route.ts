import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Force dynamic - this route requires runtime env vars
export const dynamic = 'force-dynamic'

// Lazy initialization to avoid build-time errors
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

interface RadiusTierInput {
  maxDistanceKm: number
  rateRegular: number
  rateRush: number
  rateBigParcel: number
  rateRushBig: number
  label?: string | null
}

export async function POST(request: NextRequest) {
  try {
    const adminClient = getSupabaseAdmin()

    const { locationId, tiers } = await request.json() as {
      locationId: string
      tiers: RadiusTierInput[]
    }

    if (!locationId) {
      return NextResponse.json({ error: 'locationId is required' }, { status: 400 })
    }

    // Delete existing tiers for this location
    const { error: deleteError } = await adminClient
      .from('radius_pricing_tiers')
      .delete()
      .eq('location_id', locationId)

    if (deleteError) {
      console.error('Failed to delete existing tiers:', deleteError.message)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    // If no tiers to insert, return empty array
    if (!tiers || tiers.length === 0) {
      return NextResponse.json({ tiers: [] })
    }

    // Insert new tiers
    const insertData = tiers.map((tier, index) => ({
      location_id: locationId,
      max_distance_km: tier.maxDistanceKm,
      rate_regular: tier.rateRegular,
      rate_rush: tier.rateRush,
      rate_big_parcel: tier.rateBigParcel,
      rate_rush_big: tier.rateRushBig ?? 0,
      label: tier.label || null,
      sort_order: index,
    }))

    const { data, error: insertError } = await adminClient
      .from('radius_pricing_tiers')
      .insert(insertData)
      .select()

    if (insertError) {
      console.error('Failed to insert tiers:', insertError.message)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Map the response to the expected format
    const savedTiers = (data || []).map(row => ({
      id: row.id,
      locationId: row.location_id,
      maxDistanceKm: Number(row.max_distance_km),
      rateRegular: Number(row.rate_regular),
      rateRush: Number(row.rate_rush),
      rateBigParcel: Number(row.rate_big_parcel),
      rateRushBig: Number(row.rate_rush_big),
      label: row.label,
      sortOrder: row.sort_order,
    }))

    return NextResponse.json({ tiers: savedTiers })
  } catch (error) {
    console.error('Error in radius-tiers API:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const adminClient = getSupabaseAdmin()
    
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')

    if (!locationId) {
      return NextResponse.json({ error: 'locationId is required' }, { status: 400 })
    }

    const { data, error } = await adminClient
      .from('radius_pricing_tiers')
      .select('*')
      .eq('location_id', locationId)
      .order('sort_order', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const tiers = (data || []).map(row => ({
      id: row.id,
      locationId: row.location_id,
      maxDistanceKm: Number(row.max_distance_km),
      rateRegular: Number(row.rate_regular),
      rateRush: Number(row.rate_rush),
      rateBigParcel: Number(row.rate_big_parcel),
      rateRushBig: Number(row.rate_rush_big),
      label: row.label,
      sortOrder: row.sort_order,
    }))

    return NextResponse.json({ tiers })
  } catch (error) {
    console.error('Error in radius-tiers GET:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
