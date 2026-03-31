-- LV Couriers Database Schema (Simplified)
-- Drop existing tables if they exist
DROP TABLE IF EXISTS activity_events CASCADE;
DROP TABLE IF EXISTS status_history CASCADE;
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;

-- Businesses table
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drivers table
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  vehicle_type TEXT DEFAULT 'car',
  license_plate TEXT,
  total_deliveries INTEGER DEFAULT 0,
  today_deliveries INTEGER DEFAULT 0,
  rating DECIMAL(2, 1) DEFAULT 5.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deliveries table
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  
  pickup_address TEXT NOT NULL,
  pickup_contact TEXT NOT NULL,
  pickup_phone TEXT,
  pickup_notes TEXT,
  
  dropoff_address TEXT NOT NULL,
  dropoff_contact TEXT NOT NULL,
  dropoff_phone TEXT,
  dropoff_notes TEXT,
  
  package_size TEXT NOT NULL DEFAULT 'medium',
  package_description TEXT,
  
  payout DECIMAL(10, 2) NOT NULL DEFAULT 0,
  distance TEXT,
  
  status TEXT NOT NULL DEFAULT 'posted',
  priority TEXT DEFAULT 'standard',
  
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  duration TEXT,
  proof_photo_url TEXT,
  fail_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Status history table
CREATE TABLE status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Activity events table
CREATE TABLE activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  driver_name TEXT,
  business_name TEXT,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_business ON deliveries(business_id);
CREATE INDEX idx_deliveries_driver ON deliveries(driver_id);
CREATE INDEX idx_deliveries_posted_at ON deliveries(posted_at DESC);
CREATE INDEX idx_status_history_delivery ON status_history(delivery_id);
CREATE INDEX idx_activity_events_created ON activity_events(created_at DESC);
CREATE INDEX idx_drivers_status ON drivers(status);

-- Disable RLS for now (demo app without auth)
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anonymous users (demo mode)
CREATE POLICY "Allow all for businesses" ON businesses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for drivers" ON drivers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for deliveries" ON deliveries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for status_history" ON status_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for activity_events" ON activity_events FOR ALL USING (true) WITH CHECK (true);
