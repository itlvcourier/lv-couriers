-- ============================================================
-- PHASE 5: Driver-to-driver transfers
-- (parity script — mirrors migrations phase5_driver_transfers,
--  phase5_fix_accept_transfer_columns, phase5_transfer_driver_fks)
-- ============================================================

CREATE TABLE IF NOT EXISTS driver_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  transfer_code text UNIQUE NOT NULL,
  from_driver_id uuid NOT NULL,
  to_driver_id uuid,
  status text NOT NULL DEFAULT 'pending',         -- pending | accepted | rejected | cancelled
  requires_admin boolean NOT NULL DEFAULT false,
  admin_status text,                              -- null | pending | approved | rejected
  approved_by uuid,
  note text,
  lat double precision,
  lng double precision,
  initiated_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS driver_transfers_to_idx ON driver_transfers (to_driver_id, status);
CREATE INDEX IF NOT EXISTS driver_transfers_from_idx ON driver_transfers (from_driver_id, status);

DO $$ BEGIN
  ALTER TABLE driver_transfers
    ADD CONSTRAINT driver_transfers_from_driver_id_fkey
    FOREIGN KEY (from_driver_id) REFERENCES drivers(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE driver_transfers
    ADD CONSTRAINT driver_transfers_to_driver_id_fkey
    FOREIGN KEY (to_driver_id) REFERENCES drivers(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS driver_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  transfer_id uuid NOT NULL REFERENCES driver_transfers(id) ON DELETE CASCADE,
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',         -- pending | accepted
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (transfer_id, delivery_id)
);
CREATE INDEX IF NOT EXISTS driver_transfer_items_delivery_idx ON driver_transfer_items (delivery_id);

-- Atomically accept a transfer: flip custody of every parcel to the accepting
-- driver. Writes a transfer_in custody event per parcel, reassigns the
-- delivery's driver + holder, and sets leg_status='out_for_delivery'.
CREATE OR REPLACE FUNCTION accept_driver_transfer(
  p_transfer_id uuid,
  p_accepting_driver_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_scan_method text
) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  v_transfer RECORD;
  v_item RECORD;
  v_from_holder text;
  v_count integer := 0;
  v_to_holder text := 'driver:' || p_accepting_driver_id::text;
BEGIN
  SELECT * INTO v_transfer FROM driver_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer % not found', p_transfer_id;
  END IF;
  IF v_transfer.status <> 'pending' THEN
    RAISE EXCEPTION 'transfer % is not pending (status=%)', p_transfer_id, v_transfer.status;
  END IF;
  IF v_transfer.requires_admin AND COALESCE(v_transfer.admin_status, 'pending') <> 'approved' THEN
    RAISE EXCEPTION 'transfer % awaits admin approval', p_transfer_id;
  END IF;

  FOR v_item IN
    SELECT i.delivery_id FROM driver_transfer_items i
    WHERE i.transfer_id = p_transfer_id AND i.status <> 'accepted'
  LOOP
    SELECT current_holder INTO v_from_holder FROM deliveries WHERE id = v_item.delivery_id;

    INSERT INTO custody_events (
      delivery_id, event_type, actor_type, actor_id,
      from_holder, to_holder, scan_method, lat, lng, notes, metadata)
    VALUES (
      v_item.delivery_id, 'transfer_in', 'driver', p_accepting_driver_id,
      v_from_holder, v_to_holder, COALESCE(p_scan_method, 'manual'), p_lat, p_lng,
      'Accepted driver transfer',
      jsonb_build_object(
        'transfer_id', p_transfer_id,
        'transfer_code', v_transfer.transfer_code,
        'from_driver_id', v_transfer.from_driver_id));

    UPDATE deliveries SET
      current_holder = v_to_holder,
      holder_driver_id = p_accepting_driver_id,
      driver_id = p_accepting_driver_id,
      leg_status = 'out_for_delivery',
      updated_at = now()
    WHERE id = v_item.delivery_id;

    UPDATE driver_transfer_items SET status = 'accepted'
    WHERE transfer_id = p_transfer_id AND delivery_id = v_item.delivery_id;

    v_count := v_count + 1;
  END LOOP;

  UPDATE driver_transfers SET
    status = 'accepted',
    to_driver_id = p_accepting_driver_id,
    decided_at = now()
  WHERE id = p_transfer_id;

  RETURN v_count;
END; $$;

-- ---------- RLS (permissive demo-mode, matches existing tables) ----------
ALTER TABLE driver_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_transfer_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS driver_transfers_demo_all ON driver_transfers;
CREATE POLICY driver_transfers_demo_all ON driver_transfers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS driver_transfer_items_demo_all ON driver_transfer_items;
CREATE POLICY driver_transfer_items_demo_all ON driver_transfer_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
