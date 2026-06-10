-- ============================================================
-- PHASE 6: Address intelligence (parity script)
-- Mirrors migration phase6_address_intelligence.
-- ============================================================

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS geocode_confidence text,           -- complete | inferred | unconfirmed | manual
  ADD COLUMN IF NOT EXISTS address_change_pending boolean NOT NULL DEFAULT false;

-- Audit trail of every dropoff-address change.
CREATE TABLE IF NOT EXISTS address_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  old_address text,
  new_address text,
  old_area text,
  new_area text,
  old_postal_code text,
  new_postal_code text,
  old_lat double precision,
  old_lng double precision,
  new_lat double precision,
  new_lng double precision,
  old_zone_id uuid REFERENCES zones(id),
  new_zone_id uuid REFERENCES zones(id),
  distance_delta_m double precision,             -- straight-line meters between old and new pin
  source text,                                   -- business_sms | recipient_sms | phoned | pin_drop | autocomplete
  geocode_confidence text,
  evidence_photo_url text,
  changed_by uuid,
  actor_type text NOT NULL DEFAULT 'driver',     -- driver | admin | system
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS address_history_delivery_idx
  ON address_history (delivery_id, created_at DESC);

-- Atomically apply an address change: update delivery + write history + custody event.
CREATE OR REPLACE FUNCTION apply_address_change(
  p_delivery_id uuid,
  p_new_address text,
  p_new_area text,
  p_new_postal text,
  p_new_lat double precision,
  p_new_lng double precision,
  p_new_zone_id uuid,
  p_geocode_confidence text,
  p_source text,
  p_evidence_photo_url text,
  p_changed_by uuid,
  p_actor_type text
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_old RECORD;
  v_dist double precision;
  v_hist_id uuid;
BEGIN
  SELECT dropoff_address, dropoff_area, dropoff_postal_code,
         dropoff_lat, dropoff_lng, dropoff_zone_id
    INTO v_old
    FROM deliveries WHERE id = p_delivery_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'delivery % not found', p_delivery_id;
  END IF;

  IF v_old.dropoff_lat IS NOT NULL AND p_new_lat IS NOT NULL THEN
    v_dist := ST_DistanceSphere(
      ST_MakePoint(v_old.dropoff_lng, v_old.dropoff_lat),
      ST_MakePoint(p_new_lng, p_new_lat));
  END IF;

  INSERT INTO address_history (
    delivery_id, old_address, new_address, old_area, new_area,
    old_postal_code, new_postal_code, old_lat, old_lng, new_lat, new_lng,
    old_zone_id, new_zone_id, distance_delta_m, source, geocode_confidence,
    evidence_photo_url, changed_by, actor_type)
  VALUES (
    p_delivery_id, v_old.dropoff_address, p_new_address, v_old.dropoff_area, p_new_area,
    v_old.dropoff_postal_code, p_new_postal, v_old.dropoff_lat, v_old.dropoff_lng, p_new_lat, p_new_lng,
    v_old.dropoff_zone_id, p_new_zone_id, v_dist, p_source, p_geocode_confidence,
    p_evidence_photo_url, p_changed_by, COALESCE(p_actor_type, 'driver'))
  RETURNING id INTO v_hist_id;

  UPDATE deliveries SET
    dropoff_address = p_new_address,
    dropoff_area = COALESCE(p_new_area, dropoff_area),
    dropoff_postal_code = COALESCE(p_new_postal, dropoff_postal_code),
    dropoff_lat = p_new_lat,
    dropoff_lng = p_new_lng,
    dropoff_zone_id = p_new_zone_id,
    geocode_confidence = p_geocode_confidence,
    address_change_pending = false,
    updated_at = now()
  WHERE id = p_delivery_id;

  INSERT INTO custody_events (delivery_id, event_type, actor_type, actor_id, notes, metadata)
  VALUES (
    p_delivery_id, 'address_change', COALESCE(p_actor_type, 'driver'), p_changed_by,
    'Dropoff address updated',
    jsonb_build_object(
      'old_address', v_old.dropoff_address,
      'new_address', p_new_address,
      'old_zone_id', v_old.dropoff_zone_id,
      'new_zone_id', p_new_zone_id,
      'distance_delta_m', v_dist,
      'source', p_source,
      'address_history_id', v_hist_id));

  RETURN v_hist_id;
END; $$;

-- ---------- RLS (permissive demo-mode, matches existing tables) ----------
ALTER TABLE address_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS address_history_demo_all ON address_history;
CREATE POLICY address_history_demo_all ON address_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
