-- ============================================================
-- §4 Per-leg pay + permanent pickup-driver record
--
-- Problem (review): once a transfer flips `driver_id` to the receiving
-- driver, the original picker is erased from the row, so billing has no data
-- left to credit the pickup leg. Fix: persist `pickup_driver_id` permanently
-- (set at pickup, never overwritten), and make the transfer RPC backfill it
-- from the current driver before reassigning custody.
-- ============================================================

-- 1. Permanent pickup-driver column (never overwritten once set).
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS pickup_driver_id uuid;

DO $$ BEGIN
  ALTER TABLE deliveries
    ADD CONSTRAINT deliveries_pickup_driver_id_fkey
    FOREIGN KEY (pickup_driver_id) REFERENCES drivers(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS deliveries_pickup_driver_idx
  ON deliveries (pickup_driver_id);

-- Backfill: for already-delivered parcels with no transfer history, the
-- current driver IS the pickup driver. (Parcels that were transferred lose
-- this, which is acceptable — they predate the feature.)
UPDATE deliveries
SET pickup_driver_id = driver_id
WHERE pickup_driver_id IS NULL
  AND driver_id IS NOT NULL;

-- 2. Transfer acceptance must preserve the pickup driver before overwriting
--    `driver_id`. We rebuild accept_driver_transfer to COALESCE pickup_driver_id
--    from the parcel's current driver the first time it changes hands.
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
  v_prev_driver uuid;
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
    SELECT current_holder, driver_id
      INTO v_from_holder, v_prev_driver
      FROM deliveries WHERE id = v_item.delivery_id;

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
      -- Lock in the pickup driver the first time custody leaves the picker.
      pickup_driver_id = COALESCE(pickup_driver_id, v_prev_driver),
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
