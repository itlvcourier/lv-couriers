import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, isAuthError } from '@/lib/auth-guard'

export const dynamic = 'force-dynamic'

// Fixed UUID for the single settings row
const SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if (isAuthError(auth)) return auth

  const supabaseAdmin = createAdminClient()
  
  try {
    // Try to get the current settings
    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .select('*')
      .eq('id', SETTINGS_ID)
      .single()

    if (error) {
      // If no row found, try to insert default
      if (error.code === 'PGRST116') {
        const { data: insertData, error: insertError } = await supabaseAdmin
          .from('system_settings')
          .insert({
            id: SETTINGS_ID,
            driver_pay_enabled: false,
            driver_base_rate: 5.00,
            driver_rush_bonus: 2.00,
            driver_urgent_bonus: 5.00,
            driver_distance_rate: 0.50,
          })
          .select()
          .single()

        if (insertError) {
          return NextResponse.json({ error: insertError.message, code: insertError.code }, { status: 400 })
        }

        return NextResponse.json(insertData)
      }

      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (isAuthError(auth)) return auth

  const supabaseAdmin = createAdminClient()

  try {
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('system_settings')
      .upsert({
        id: SETTINGS_ID,
        ...body,
        updated_at: new Date().toISOString(),
        updated_by: auth.user.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
