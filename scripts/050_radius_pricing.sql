-- Migration: Radius-Based Pricing
-- Adds support for distance-based pricing per business location

-- 1. Add lat/lng to business_locations for distance calculation origin
ALTER TABLE business_locations 
ADD COLUMN IF NOT EXISTS lat NUMERIC(10,7),
ADD COLUMN IF NOT EXISTS lng NUMERIC(10,7);

-- 2. Add radius pricing toggle to rate_cards
ALTER TABLE rate_cards 
ADD COLUMN IF NOT EXISTS use_radius_pricing BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Add distance tracking to deliveries
ALTER TABLE deliveries 
ADD COLUMN IF NOT EXISTS distance_km NUMERIC(6,2);

-- 4. Create radius_pricing_tiers table
CREATE TABLE IF NOT EXISTS radius_pricing_tiers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id     UUID NOT NULL REFERENCES business_locations(id) ON DELETE CASCADE,
  max_distance_km NUMERIC(5,1) NOT NULL,
  rate_regular    NUMERIC(10,2) NOT NULL,
  rate_rush       NUMERIC(10,2) NOT NULL,
  rate_big_parcel NUMERIC(10,2) NOT NULL,
  rate_rush_big   NUMERIC(10,2) NOT NULL,
  label           TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, max_distance_km)
);

-- Index for fast lookups by location
CREATE INDEX IF NOT EXISTS idx_radius_tiers_location ON radius_pricing_tiers(location_id);

-- 5. Enable RLS on radius_pricing_tiers
ALTER TABLE radius_pricing_tiers ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read (needed for rate calculation)
CREATE POLICY "radius_tiers_select_all" ON radius_pricing_tiers
  FOR SELECT USING (true);

-- Policy: Only admins can modify
CREATE POLICY "radius_tiers_admin_all" ON radius_pricing_tiers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- 6. Add radius_pricing_tiers to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE radius_pricing_tiers;

-- 7. Comment for documentation
COMMENT ON TABLE radius_pricing_tiers IS 'Distance-based pricing tiers per business location. Each tier has rates for regular, rush, and big parcel deliveries.';
COMMENT ON COLUMN radius_pricing_tiers.max_distance_km IS 'Maximum distance in km for this tier (e.g., 5.0 means 0-5km)';
COMMENT ON COLUMN radius_pricing_tiers.rate_regular IS 'Regular delivery rate for this distance tier';
COMMENT ON COLUMN radius_pricing_tiers.rate_rush IS 'Rush delivery rate for this distance tier';
COMMENT ON COLUMN radius_pricing_tiers.rate_big_parcel IS 'Rate for 2+ big packages in this distance tier';
COMMENT ON COLUMN radius_pricing_tiers.rate_rush_big IS 'Rate for rush + 2+ big packages in this distance tier';
COMMENT ON COLUMN business_locations.lat IS 'Latitude for distance calculation (auto-geocoded from address)';
COMMENT ON COLUMN business_locations.lng IS 'Longitude for distance calculation (auto-geocoded from address)';
COMMENT ON COLUMN rate_cards.use_radius_pricing IS 'When true, use distance-based tiers instead of flat rates';
COMMENT ON COLUMN deliveries.distance_km IS 'Calculated driving distance from pickup to dropoff in km';
