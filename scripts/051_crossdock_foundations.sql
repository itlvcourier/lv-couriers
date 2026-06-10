-- ============================================================
-- 051_crossdock_foundations.sql  (Phase 0)
-- Repo-parity copy of the migration applied via Supabase MCP.
-- Idempotent: safe to re-run. See v0_plans/sharp-map.md (Phase 0).
--
-- Single-tenant model: a fixed sentinel org_id is defaulted on every table
-- (00000000-0000-0000-0000-000000000001) for future multi-tenancy headroom.
-- The core order table in this system is `deliveries` (not `orders`).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------- org_settings: feature-flag bag (single row) ----------
CREATE TABLE IF NOT EXISTS org_settings (
  org_id uuid PRIMARY KEY,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

INSERT INTO org_settings (org_id, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '{
    "zones_enabled": true,
    "auto_assign_driver": true,
    "consolidation_enabled": true,
    "route_optimization_enabled": true,
    "cutoff_enabled": true,
    "late_requests_enabled": true,
    "driver_transfers_enabled": true,
    "transfer_requires_admin": false,
    "address_validation_level": "soft",
    "driver_address_change_requires_approval": true,
    "inbound_sms_address_capture": false,
    "auto_geofence_events": true,
    "barcode_scanning_required": false,
    "proof_of_delivery_required": true,
    "recipient_live_tracking_enabled": true,
    "driver_pay_model": "per_leg"
  }'::jsonb
)
ON CONFLICT (org_id) DO NOTHING;

-- ---------- zones ----------
CREATE TABLE IF NOT EXISTS zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  fsa_codes text[] NOT NULL DEFAULT '{}',
  geom geometry(Polygon, 4326),
  priority int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS zones_geom_gix ON zones USING gist (geom);
CREATE INDEX IF NOT EXISTS zones_org_active_idx ON zones (org_id, is_active);

-- ---------- zone_assignments ----------
CREATE TABLE IF NOT EXISTS zone_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  zone_id uuid NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  effective_date date NOT NULL DEFAULT current_date,
  shift text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, zone_id, effective_date, shift)
);
CREATE INDEX IF NOT EXISTS zone_assignments_lookup_idx
  ON zone_assignments (org_id, effective_date, zone_id);

-- ---------- custody_events (append-only) ----------
CREATE TABLE IF NOT EXISTS custody_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_type text NOT NULL,
  actor_id uuid,
  from_holder text,
  to_holder text,
  scan_method text,
  lat double precision,
  lng double precision,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_event_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS custody_events_delivery_idx ON custody_events (delivery_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS custody_events_client_event_uidx
  ON custody_events (client_event_id) WHERE client_event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION custody_events_block_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'custody_events is append-only; % is not allowed', TG_OP;
END;
$$;
DROP TRIGGER IF EXISTS custody_events_no_update ON custody_events;
CREATE TRIGGER custody_events_no_update BEFORE UPDATE ON custody_events
  FOR EACH ROW EXECUTE FUNCTION custody_events_block_mutation();
DROP TRIGGER IF EXISTS custody_events_no_delete ON custody_events;
CREATE TRIGGER custody_events_no_delete BEFORE DELETE ON custody_events
  FOR EACH ROW EXECUTE FUNCTION custody_events_block_mutation();

-- ---------- deliveries: cross-dock columns ----------
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS org_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  ADD COLUMN IF NOT EXISTS dropoff_zone_id uuid REFERENCES zones(id),
  ADD COLUMN IF NOT EXISTS pickup_zone_id uuid REFERENCES zones(id),
  ADD COLUMN IF NOT EXISTS current_holder text,
  ADD COLUMN IF NOT EXISTS holder_driver_id uuid REFERENCES drivers(id),
  ADD COLUMN IF NOT EXISTS leg_status text NOT NULL DEFAULT 'created',
  ADD COLUMN IF NOT EXISTS routing_mode text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS scan_token text,
  ADD COLUMN IF NOT EXISTS pickup_pay numeric(10,2),
  ADD COLUMN IF NOT EXISTS delivery_pay numeric(10,2);

CREATE UNIQUE INDEX IF NOT EXISTS deliveries_scan_token_uidx
  ON deliveries (scan_token) WHERE scan_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS deliveries_dropoff_zone_idx ON deliveries (dropoff_zone_id);
CREATE INDEX IF NOT EXISTS deliveries_leg_status_idx ON deliveries (leg_status);

-- ---------- resolve_zone(): polygon containment, FSA fallback ----------
CREATE OR REPLACE FUNCTION resolve_zone(p_lat double precision, p_lng double precision, p_postal text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_zone uuid;
  v_fsa text;
BEGIN
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    SELECT id INTO v_zone
    FROM zones
    WHERE is_active AND geom IS NOT NULL
      AND ST_Contains(geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
    ORDER BY priority DESC
    LIMIT 1;
    IF v_zone IS NOT NULL THEN RETURN v_zone; END IF;
  END IF;

  IF p_postal IS NOT NULL THEN
    v_fsa := upper(left(regexp_replace(p_postal, '\s', '', 'g'), 3));
    SELECT id INTO v_zone
    FROM zones
    WHERE is_active AND v_fsa = ANY (fsa_codes)
    ORDER BY priority DESC
    LIMIT 1;
    IF v_zone IS NOT NULL THEN RETURN v_zone; END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- ---------- RLS (demo-mode permissive, matches existing tables) ----------
ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE zone_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE custody_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_settings_demo_all ON org_settings;
CREATE POLICY org_settings_demo_all ON org_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS zones_demo_all ON zones;
CREATE POLICY zones_demo_all ON zones FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS zone_assignments_demo_all ON zone_assignments;
CREATE POLICY zone_assignments_demo_all ON zone_assignments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
-- custody_events: SELECT + INSERT only (no UPDATE/DELETE at policy level too)
DROP POLICY IF EXISTS custody_events_demo_select ON custody_events;
CREATE POLICY custody_events_demo_select ON custody_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS custody_events_demo_insert ON custody_events;
CREATE POLICY custody_events_demo_insert ON custody_events FOR INSERT TO anon, authenticated WITH CHECK (true);
