import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// This endpoint creates the store_requests table if it doesn't exist
// Only accessible by admins
export async function POST() {
  const supabase = await createClient()
  
  // Check if user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  // Check if table already exists by trying to query it
  const { error: checkError } = await supabase
    .from('store_requests')
    .select('id')
    .limit(1)
  
  if (!checkError) {
    return NextResponse.json({ 
      success: true, 
      message: 'Table already exists' 
    })
  }

  // Table doesn't exist - return instructions for manual creation
  // Since Supabase JS client can't run DDL, admin needs to create via dashboard
  const sql = `
-- Run this SQL in Supabase Dashboard > SQL Editor:

CREATE TABLE IF NOT EXISTS store_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('add', 'remove')),
  store_name VARCHAR(255) NOT NULL,
  store_address TEXT,
  store_phone VARCHAR(50),
  location_id UUID REFERENCES business_locations(id) ON DELETE SET NULL,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by UUID,
  processed_at TIMESTAMPTZ,
  processed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_requests_business ON store_requests(business_id);
CREATE INDEX IF NOT EXISTS idx_store_requests_status ON store_requests(status);

ALTER TABLE store_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON store_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
  `

  return NextResponse.json({ 
    success: false, 
    message: 'Table does not exist. Please create it manually.',
    sql 
  })
}

export async function GET() {
  const supabase = await createClient()
  
  // Check if table exists
  const { error } = await supabase
    .from('store_requests')
    .select('id')
    .limit(1)
  
  return NextResponse.json({ 
    tableExists: !error,
    error: error?.message 
  })
}
