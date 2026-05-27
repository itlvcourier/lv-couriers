import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Use service role key to bypass RLS for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  const results: { table: string; status: string; error?: string }[] = []

  // 1. Create system_settings table
  try {
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS system_settings (
          id TEXT PRIMARY KEY DEFAULT 'main',
          driver_pay_enabled BOOLEAN DEFAULT false,
          driver_base_rate DECIMAL(10,2) DEFAULT 5.00,
          driver_rush_bonus DECIMAL(10,2) DEFAULT 2.00,
          driver_urgent_bonus DECIMAL(10,2) DEFAULT 5.00,
          driver_distance_rate DECIMAL(10,2) DEFAULT 0.50,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          updated_by UUID
        );
      `
    })
    
    if (error) {
      // Try direct query if RPC doesn't exist
      const { error: directError } = await supabaseAdmin
        .from('system_settings')
        .select('id')
        .limit(1)
      
      if (directError && directError.code === '42P01') {
        results.push({ table: 'system_settings', status: 'needs_manual_creation', error: 'Table does not exist - run SQL manually' })
      } else if (!directError) {
        results.push({ table: 'system_settings', status: 'exists' })
      } else {
        results.push({ table: 'system_settings', status: 'error', error: directError.message })
      }
    } else {
      results.push({ table: 'system_settings', status: 'created' })
    }
  } catch (e) {
    // Check if table exists
    const { error: checkError } = await supabaseAdmin
      .from('system_settings')
      .select('id')
      .limit(1)
    
    if (!checkError) {
      results.push({ table: 'system_settings', status: 'exists' })
    } else if (checkError.code === '42P01') {
      results.push({ table: 'system_settings', status: 'needs_manual_creation' })
    } else {
      results.push({ table: 'system_settings', status: 'error', error: checkError.message })
    }
  }

  // 2. Check audit_logs table
  try {
    const { error } = await supabaseAdmin
      .from('audit_logs')
      .select('id')
      .limit(1)
    
    if (!error) {
      results.push({ table: 'audit_logs', status: 'exists' })
    } else if (error.code === '42P01') {
      results.push({ table: 'audit_logs', status: 'needs_manual_creation' })
    } else {
      results.push({ table: 'audit_logs', status: 'error', error: error.message })
    }
  } catch (e) {
    results.push({ table: 'audit_logs', status: 'error', error: String(e) })
  }

  // 3. Check store_requests table
  try {
    const { error } = await supabaseAdmin
      .from('store_requests')
      .select('id')
      .limit(1)
    
    if (!error) {
      results.push({ table: 'store_requests', status: 'exists' })
    } else if (error.code === '42P01') {
      results.push({ table: 'store_requests', status: 'needs_manual_creation' })
    } else {
      results.push({ table: 'store_requests', status: 'error', error: error.message })
    }
  } catch (e) {
    results.push({ table: 'store_requests', status: 'error', error: String(e) })
  }

  // Try to insert default system_settings if table exists
  if (results.find(r => r.table === 'system_settings' && r.status === 'exists')) {
    try {
      const { data: existing } = await supabaseAdmin
        .from('system_settings')
        .select('id')
        .eq('id', 'main')
        .single()
      
      if (!existing) {
        await supabaseAdmin
          .from('system_settings')
          .insert({ id: 'main' })
      }
    } catch (e) {
      // Ignore - row may already exist
    }
  }

  return NextResponse.json({ results })
}

export async function GET() {
  // Check status of all tables
  const tables = ['system_settings', 'audit_logs', 'store_requests']
  const status: Record<string, boolean> = {}

  for (const table of tables) {
    try {
      const { error } = await supabaseAdmin
        .from(table)
        .select('id')
        .limit(1)
      
      status[table] = !error || error.code !== '42P01'
    } catch {
      status[table] = false
    }
  }

  return NextResponse.json(status)
}
