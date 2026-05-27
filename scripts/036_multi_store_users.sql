-- Multi-Store User Management Migration
-- This migration adds support for multi-store access control with owner/manager/viewer roles

-- Add business_role enum
DO $$ BEGIN
  CREATE TYPE business_user_role AS ENUM ('owner', 'manager', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add business_role column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS business_role business_user_role;

-- Add managed_locations array to profiles (for managers)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS managed_location_ids UUID[] DEFAULT '{}';

-- Default existing business users to 'owner' with access to all their locations
UPDATE profiles 
SET business_role = 'owner', 
    managed_location_ids = '{}'
WHERE role = 'business' AND business_role IS NULL;

-- Create table for business user location assignments (normalized)
-- This allows fine-grained control over which locations a user can access
CREATE TABLE IF NOT EXISTS business_user_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES business_locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, location_id)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_business_user_locations_user ON business_user_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_business_user_locations_business ON business_user_locations(business_id);
CREATE INDEX IF NOT EXISTS idx_business_user_locations_location ON business_user_locations(location_id);

-- Business invitations table for inviting new team members
CREATE TABLE IF NOT EXISTS business_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role business_user_role NOT NULL DEFAULT 'manager',
  location_ids UUID[] NOT NULL DEFAULT '{}',
  invited_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for token lookups (invitation acceptance)
CREATE INDEX IF NOT EXISTS idx_business_invitations_token ON business_invitations(token);
CREATE INDEX IF NOT EXISTS idx_business_invitations_email ON business_invitations(email);
CREATE INDEX IF NOT EXISTS idx_business_invitations_business ON business_invitations(business_id);

-- RLS Policies for business_user_locations
ALTER TABLE business_user_locations ENABLE ROW LEVEL SECURITY;

-- Admins can see all
CREATE POLICY "Admins can manage all business user locations" ON business_user_locations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Business owners can manage their business's locations
CREATE POLICY "Business owners can manage their user locations" ON business_user_locations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'business'
      AND profiles.business_role = 'owner'
      AND profiles.business_id = business_user_locations.business_id
    )
  );

-- Users can see their own location assignments
CREATE POLICY "Users can see their own location assignments" ON business_user_locations
  FOR SELECT USING (user_id = auth.uid());

-- RLS Policies for business_invitations
ALTER TABLE business_invitations ENABLE ROW LEVEL SECURITY;

-- Admins can see all invitations
CREATE POLICY "Admins can manage all invitations" ON business_invitations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Business owners can manage their invitations
CREATE POLICY "Business owners can manage their invitations" ON business_invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'business'
      AND profiles.business_role = 'owner'
      AND profiles.business_id = business_invitations.business_id
    )
  );

-- Anyone can view invitations by token (for accepting)
CREATE POLICY "Anyone can view invitation by token" ON business_invitations
  FOR SELECT USING (TRUE);

-- Comment on tables
COMMENT ON TABLE business_user_locations IS 'Maps business users to their accessible locations';
COMMENT ON TABLE business_invitations IS 'Stores pending invitations for new business team members';
COMMENT ON COLUMN profiles.business_role IS 'Role within a business: owner has full access, manager has limited access, viewer is read-only';
COMMENT ON COLUMN profiles.managed_location_ids IS 'Array of location IDs this user can access (empty for owners who have full access)';
