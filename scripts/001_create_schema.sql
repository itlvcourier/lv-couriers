-- LV Couriers Database Schema
-- This creates all the necessary tables for the delivery management system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS activity_events CASCADE;
DROP TABLE IF EXISTS status_history CASCADE;
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;
DROP TABLE IF EXISTS businesses CASCADE;

-- Businesses table
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  avatar TEXT,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'on_delivery', 'off_duty')),
  vehicle_type TEXT DEFAULT 'car' CHECK (vehicle_type IN ('car', 'van', 'motorcycle', 'bicycle')),
  license_plate TEXT,
  total_deliveries INTEGER DEFAULT 0,
  today_deliveries INTEGER DEFAULT 0,
  rating DECIMAL(2, 1) DEFAULT 5.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deliveries table
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  
  -- Pickup info
  pickup_address TEXT NOT NULL,
  pickup_contact TEXT NOT NULL,
  pickup_phone TEXT,
  pickup_notes TEXT,
  
  -- Dropoff info
  dropoff_address TEXT NOT NULL,
  dropoff_contact TEXT NOT NULL,
  dropoff_phone TEXT,
  dropoff_notes TEXT,
  
  -- Package info
  package_size TEXT NOT NULL DEFAULT 'medium' CHECK (package_size IN ('small', 'medium', 'large', 'xlarge')),
  package_description TEXT,
  
  -- Pricing
  payout DECIMAL(10, 2) NOT NULL DEFAULT 0,
  distance TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'claimed', 'picked_up', 'in_transit', 'delivered', 'failed')),
  priority TEXT DEFAULT 'standard' CHECK (priority IN ('standard', 'express', 'urgent')),
  
  -- Timestamps
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Completion info
  duration TEXT,
  proof_photo_url TEXT,
  fail_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Status history table for tracking all status changes
CREATE TABLE status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Activity events table for the feed
CREATE TABLE activity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_business ON deliveries(business_id);
CREATE INDEX idx_deliveries_driver ON deliveries(driver_id);
CREATE INDEX idx_deliveries_posted_at ON deliveries(posted_at DESC);
CREATE INDEX idx_status_history_delivery ON status_history(delivery_id);
CREATE INDEX idx_activity_events_created ON activity_events(created_at DESC);
CREATE INDEX idx_drivers_status ON drivers(status);

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON drivers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deliveries_updated_at
  BEFORE UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
