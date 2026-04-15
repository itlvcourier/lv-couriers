-- DOMS Database Schema - Part 3: Delivery Tables
-- Tables 8-14: trips, deliveries, manifest_items, status_logs, flags, verifications, driver_locations
-- Run AFTER 002_core_tables.sql

-- ================================================================
-- 8. TRIPS
-- ================================================================
-- Multi-stop trip grouping for drivers

CREATE TABLE IF NOT EXISTS trips (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id     UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  status        trip_status NOT NULL DEFAULT 'active',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 9. DELIVERIES
-- ================================================================
-- Core table. Every row is one delivery job.

CREATE TABLE IF NOT EXISTS deliveries (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id      UUID NOT NULL REFERENCES businesses(id),
  location_id      UUID NOT NULL REFERENCES business_locations(id),
  driver_id        UUID REFERENCES drivers(id) ON DELETE SET NULL,
  trip_id          UUID REFERENCES trips(id) ON DELETE SET NULL,
  -- Addresses
  pickup_address   TEXT NOT NULL,
  pickup_area      TEXT,
  pickup_lat       NUMERIC(10,7),
  pickup_lng       NUMERIC(10,7),
  dropoff_address  TEXT NOT NULL,
  dropoff_area     TEXT,
  dropoff_lat      NUMERIC(10,7),
  dropoff_lng      NUMERIC(10,7),
  recipient_phone  TEXT,
  -- Delivery flags
  is_urgent        BOOLEAN NOT NULL DEFAULT FALSE,
  is_out_of_town   BOOLEAN NOT NULL DEFAULT FALSE,
  is_rush          BOOLEAN NOT NULL DEFAULT FALSE,
  -- Status
  status           delivery_status NOT NULL DEFAULT 'posted',
  retry_count      INT NOT NULL DEFAULT 0,
  -- Timestamps
  posted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at       TIMESTAMPTZ,
  pickup_arrived_at TIMESTAMPTZ,
  picked_up_at     TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  -- Billing
  rate_card_id     UUID REFERENCES rate_cards(id),
  calculated_rate  NUMERIC(10,2),
  gst_amount       NUMERIC(10,2),
  total_amount     NUMERIC(10,2),
  invoice_id       UUID,  -- set when included in invoice (FK added later)
  -- Completion
  duration_mins    INT,
  proof_photo_url  TEXT,
  recipient_note   TEXT,
  -- Tracking
  tracking_code    TEXT UNIQUE,
  tracking_expires_at TIMESTAMPTZ,
  -- Cancellation
  cancelled_at     TIMESTAMPTZ,
  cancellation_stage cancellation_stage,
  cancellation_fee NUMERIC(10,2),
  cancellation_reason TEXT,
  -- Trip ordering
  trip_order       INT,
  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: generate tracking code on pickup
CREATE OR REPLACE FUNCTION generate_tracking_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'picked_up' AND (OLD.status IS NULL OR OLD.status != 'picked_up') THEN
    NEW.tracking_code := lower(substring(md5(random()::text) from 1 for 8));
    NEW.tracking_expires_at := NOW() + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_delivery_pickup ON deliveries;
CREATE TRIGGER on_delivery_pickup
  BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION generate_tracking_code();

-- ================================================================
-- 10. DELIVERY_MANIFEST_ITEMS
-- ================================================================
-- Items in each delivery (packages, rush flag, out of town flag)

CREATE TABLE IF NOT EXISTS delivery_manifest_items (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id          UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  type                 manifest_item_type NOT NULL,
  posted_qty           INT NOT NULL DEFAULT 1,
  confirmed_qty        INT,  -- null until driver verifies
  verification_photo_url TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 11. DELIVERY_STATUS_LOGS
-- ================================================================
-- Full audit trail of every status change. Never updated, only inserted.

CREATE TABLE IF NOT EXISTS delivery_status_logs (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id  UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  status       delivery_status NOT NULL,
  changed_by   UUID REFERENCES auth.users(id),
  note         TEXT,
  gps_lat      NUMERIC(10,7),
  gps_lng      NUMERIC(10,7),
  gps_accuracy NUMERIC(8,2),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: auto-log every status change
CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO delivery_status_logs (delivery_id, status)
    VALUES (NEW.id, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_delivery_status_change ON deliveries;
CREATE TRIGGER on_delivery_status_change
  AFTER UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION log_status_change();

-- ================================================================
-- 12. DELIVERY_FLAGS
-- ================================================================
-- Issues flagged by drivers during delivery

CREATE TABLE IF NOT EXISTS delivery_flags (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id   UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  driver_id     UUID NOT NULL REFERENCES drivers(id),
  type          flag_type NOT NULL,
  driver_note   TEXT,
  photo_url     TEXT,
  status        flag_status NOT NULL DEFAULT 'open',
  resolved_by   UUID REFERENCES auth.users(id),
  resolution    TEXT,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 13. DELIVERY_VERIFICATIONS
-- ================================================================
-- Records what driver confirmed at pickup — the billing source of truth.

CREATE TABLE IF NOT EXISTS delivery_verifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id     UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  manifest_item_id UUID NOT NULL REFERENCES delivery_manifest_items(id),
  driver_id       UUID NOT NULL REFERENCES drivers(id),
  posted_qty      INT NOT NULL,
  confirmed_qty   INT NOT NULL,
  qty_adjusted    BOOLEAN NOT NULL GENERATED ALWAYS AS (posted_qty != confirmed_qty) STORED,
  photo_url       TEXT,
  out_of_town_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  gps_lat         NUMERIC(10,7),
  gps_lng         NUMERIC(10,7),
  verified_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 14. DRIVER_LOCATIONS
-- ================================================================
-- GPS pings from active drivers. Updated every 30 seconds during active deliveries.

CREATE TABLE IF NOT EXISTS driver_locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id   UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  lat         NUMERIC(10,7) NOT NULL,
  lng         NUMERIC(10,7) NOT NULL,
  accuracy    NUMERIC(8,2),
  speed       NUMERIC(8,2),  -- km/h for smart frequency
  battery     INT,           -- battery % for low battery alerts
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 15. TRACKING_LINKS
-- ================================================================

CREATE TABLE IF NOT EXISTS tracking_links (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id  UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  code         TEXT NOT NULL UNIQUE,
  recipient_phone TEXT,
  sms_sent_at  TIMESTAMPTZ,
  views        INT NOT NULL DEFAULT 0,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
