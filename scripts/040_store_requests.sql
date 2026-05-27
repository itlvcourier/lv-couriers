-- Store Requests table for business add/remove store requests
-- This table tracks requests from business owners to add or remove store locations

CREATE TABLE IF NOT EXISTS store_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('add', 'remove')),
  store_name VARCHAR(255) NOT NULL,
  store_address TEXT,
  store_phone VARCHAR(50),
  location_id UUID REFERENCES business_locations(id) ON DELETE SET NULL, -- For remove requests
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_store_requests_business ON store_requests(business_id);
CREATE INDEX IF NOT EXISTS idx_store_requests_status ON store_requests(status);
CREATE INDEX IF NOT EXISTS idx_store_requests_created ON store_requests(created_at DESC);

-- Enable RLS
ALTER TABLE store_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can see all requests
CREATE POLICY "Admins can view all store requests"
  ON store_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Business users can see their own business requests
CREATE POLICY "Business users can view own requests"
  ON store_requests FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'business'
    )
  );

-- Business users can create requests for their business
CREATE POLICY "Business users can create requests"
  ON store_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'business'
    )
  );

-- Admins can update request status
CREATE POLICY "Admins can update store requests"
  ON store_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
