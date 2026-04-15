-- DOMS Database Schema - Part 2: Core Tables
-- Tables 1-7: profiles, system_settings, businesses, locations, addresses, drivers, rate_cards
-- Run AFTER 001_extensions_and_enums.sql

-- ================================================================
-- 1. PROFILES
-- ================================================================
-- Extends Supabase Auth users. Created automatically when a user signs up via trigger.

CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role         user_role NOT NULL,
  name         TEXT NOT NULL,
  phone        TEXT,
  invite_status invite_status NOT NULL DEFAULT 'pending',
  driver_id    UUID,  -- set if role = driver
  business_id  UUID,  -- set if role = business
  location_id  UUID,  -- set if role = business
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role, name)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'driver'),
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ================================================================
-- 2. SYSTEM_SETTINGS
-- ================================================================
-- Single-row table for global configuration. Enforced with CHECK.

CREATE TABLE IF NOT EXISTS system_settings (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  global_max_jobs             INT NOT NULL DEFAULT 3 CHECK (global_max_jobs >= 1),
  rush_sla_mins               INT NOT NULL DEFAULT 45,
  intown_timeout_mins         INT NOT NULL DEFAULT 120,
  outoftown_timeout_mins      INT NOT NULL DEFAULT 240,
  auto_generate_invoices      BOOLEAN NOT NULL DEFAULT TRUE,
  invoice_due_days            INT NOT NULL DEFAULT 15,
  auto_send_invoices          BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_day_1              INT NOT NULL DEFAULT 7,
  overdue_day                 INT NOT NULL DEFAULT 7,
  escalation_day              INT NOT NULL DEFAULT 14,
  cancellation_before_depart  NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  cancellation_en_route       NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  single_row                  BOOLEAN NOT NULL DEFAULT TRUE UNIQUE,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce single row
ALTER TABLE system_settings DROP CONSTRAINT IF EXISTS single_row_only;
ALTER TABLE system_settings ADD CONSTRAINT single_row_only
  CHECK (single_row = TRUE);

-- Insert default settings (only if empty)
INSERT INTO system_settings (single_row) 
SELECT TRUE WHERE NOT EXISTS (SELECT 1 FROM system_settings);

-- ================================================================
-- 3. BUSINESSES
-- ================================================================

CREATE TABLE IF NOT EXISTS businesses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  invoice_format  invoice_format NOT NULL DEFAULT 'combined',
  invite_status   invite_status NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 4. BUSINESS_LOCATIONS
-- ================================================================

CREATE TABLE IF NOT EXISTS business_locations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  address         TEXT NOT NULL,
  area            TEXT,
  postal_code     TEXT,
  contact_name    TEXT,
  phone           TEXT,
  billing_email   TEXT NOT NULL,
  backup_email    TEXT,
  has_rate_card   BOOLEAN NOT NULL DEFAULT FALSE,
  invite_status   invite_status NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 5. SAVED_ADDRESSES
-- ================================================================
-- Frequently used dropoff addresses per location (max 5 enforced at app level)

CREATE TABLE IF NOT EXISTS saved_addresses (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id  UUID NOT NULL REFERENCES business_locations(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  address      TEXT NOT NULL,
  area         TEXT,
  postal_code  TEXT,
  phone        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 6. DRIVERS
-- ================================================================

CREATE TABLE IF NOT EXISTS drivers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  email               TEXT NOT NULL UNIQUE,
  phone               TEXT,
  status              driver_status NOT NULL DEFAULT 'available',
  max_jobs_override   INT CHECK (max_jobs_override IS NULL OR max_jobs_override >= 1),
  invite_status       invite_status NOT NULL DEFAULT 'pending',
  -- Cached stats (updated by trigger on delivery completion)
  total_deliveries    INT NOT NULL DEFAULT 0,
  today_deliveries    INT NOT NULL DEFAULT 0,
  month_deliveries    INT NOT NULL DEFAULT 0,
  avg_delivery_mins   INT NOT NULL DEFAULT 0,
  rush_sla_rate       NUMERIC(5,2) NOT NULL DEFAULT 0,
  monthly_adjustments INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 7. RATE_CARDS
-- ================================================================

CREATE TABLE IF NOT EXISTS rate_cards (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id          UUID NOT NULL REFERENCES business_locations(id) ON DELETE CASCADE,
  -- Five rates
  rate_regular         NUMERIC(10,2) NOT NULL,
  rate_big_double      NUMERIC(10,2) NOT NULL,
  rate_oot_big         NUMERIC(10,2),  -- nullable = not set
  rate_rush            NUMERIC(10,2) NOT NULL,
  rate_rush_oot        NUMERIC(10,2) NOT NULL,
  -- Tax
  gst_applicable       BOOLEAN NOT NULL DEFAULT TRUE,
  -- Cancellation fees (overrides system_settings for this store)
  cancel_before_depart NUMERIC(10,2),
  cancel_en_route      NUMERIC(10,2),
  -- Notification preferences
  notify_driver_assigned    BOOLEAN NOT NULL DEFAULT TRUE,
  notify_pickup_confirmed   BOOLEAN NOT NULL DEFAULT TRUE,
  notify_en_route           BOOLEAN NOT NULL DEFAULT FALSE,
  notify_delivered          BOOLEAN NOT NULL DEFAULT TRUE,
  notify_failed             BOOLEAN NOT NULL DEFAULT TRUE,
  notify_invoice_sent       BOOLEAN NOT NULL DEFAULT TRUE,
  notify_payment_reminder   BOOLEAN NOT NULL DEFAULT TRUE,
  notify_recipient_sms      BOOLEAN NOT NULL DEFAULT TRUE,
  -- Billing notes
  contract_notes       TEXT,
  effective_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: update has_rate_card on business_locations
CREATE OR REPLACE FUNCTION sync_rate_card_flag()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE business_locations
  SET has_rate_card = TRUE
  WHERE id = NEW.location_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_rate_card_created ON rate_cards;
CREATE TRIGGER on_rate_card_created
  AFTER INSERT OR UPDATE ON rate_cards
  FOR EACH ROW EXECUTE FUNCTION sync_rate_card_flag();

-- Add foreign keys to profiles now that tables exist
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_driver_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_driver_id_fkey 
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_business_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_location_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_location_id_fkey 
  FOREIGN KEY (location_id) REFERENCES business_locations(id) ON DELETE SET NULL;
