-- ============================================================
-- PHASE 4: Consolidation runs + hub Sort Mode
-- (parity copy of migration phase4_consolidation_runs)
-- ============================================================

-- A consolidation run is a hub "sort wave": parcels checked into the hub are
-- grouped, sorted to a destination-zone bin, then handed off to delivery drivers.
CREATE TABLE IF NOT EXISTS consolidation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  label text NOT NULL,
  hub_name text,
  status text NOT NULL DEFAULT 'open',        -- open | sorting | closed
  opened_by uuid,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  notes text
);
CREATE INDEX IF NOT EXISTS consolidation_runs_status_idx
  ON consolidation_runs (org_id, status, opened_at DESC);

-- Per-parcel membership in a run + its sort target and progress.
CREATE TABLE IF NOT EXISTS consolidation_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  run_id uuid NOT NULL REFERENCES consolidation_runs(id) ON DELETE CASCADE,
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  dropoff_zone_id uuid REFERENCES zones(id),
  bin text,                                    -- sort bin label (defaults to zone)
  status text NOT NULL DEFAULT 'checked_in',   -- checked_in | sorted | handed_off | exception
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  sorted_at timestamptz,
  handed_off_at timestamptz,
  UNIQUE (run_id, delivery_id)
);
CREATE INDEX IF NOT EXISTS cri_run_idx ON consolidation_run_items (run_id, status);
CREATE INDEX IF NOT EXISTS cri_delivery_idx ON consolidation_run_items (delivery_id);
CREATE INDEX IF NOT EXISTS cri_zone_idx ON consolidation_run_items (dropoff_zone_id);

-- Live hub Sort board: parcels currently at the hub (leg_status='at_hub'),
-- grouped with destination zone + assigned driver. Intra-zone "direct" parcels
-- never reach the hub, so they are naturally excluded.
CREATE OR REPLACE FUNCTION hub_sort_board()
RETURNS TABLE (
  delivery_id uuid,
  scan_token text,
  recipient_name text,
  dropoff_address text,
  dropoff_area text,
  dropoff_zone_id uuid,
  zone_name text,
  zone_color text,
  zone_driver_id uuid,
  zone_driver_name text,
  leg_status text,
  routing_mode text,
  updated_at timestamptz
) LANGUAGE sql STABLE AS $$
  SELECT d.id, d.scan_token, d.recipient_name, d.dropoff_address, d.dropoff_area,
         d.dropoff_zone_id, z.name, z.color,
         za.driver_id, dr.name,
         d.leg_status, d.routing_mode, d.updated_at
  FROM deliveries d
  LEFT JOIN zones z ON z.id = d.dropoff_zone_id
  LEFT JOIN zone_assignments za
    ON za.zone_id = d.dropoff_zone_id AND za.effective_date = current_date
  LEFT JOIN drivers dr ON dr.id = za.driver_id
  WHERE d.leg_status = 'at_hub'
  ORDER BY z.priority DESC NULLS LAST, z.name ASC NULLS LAST, d.updated_at ASC;
$$;

-- Reconciliation for a run: expected vs sorted vs handed off vs exceptions.
CREATE OR REPLACE FUNCTION consolidation_reconcile(p_run_id uuid)
RETURNS TABLE (
  expected bigint,
  checked_in bigint,
  sorted bigint,
  handed_off bigint,
  exceptions bigint
) LANGUAGE sql STABLE AS $$
  SELECT
    count(*)::bigint AS expected,
    count(*) FILTER (WHERE status = 'checked_in')::bigint AS checked_in,
    count(*) FILTER (WHERE status = 'sorted')::bigint AS sorted,
    count(*) FILTER (WHERE status = 'handed_off')::bigint AS handed_off,
    count(*) FILTER (WHERE status = 'exception')::bigint AS exceptions
  FROM consolidation_run_items
  WHERE run_id = p_run_id;
$$;

-- RLS (permissive demo-mode, matches existing tables)
ALTER TABLE consolidation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE consolidation_run_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS consolidation_runs_demo_all ON consolidation_runs;
CREATE POLICY consolidation_runs_demo_all ON consolidation_runs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS cri_demo_all ON consolidation_run_items;
CREATE POLICY cri_demo_all ON consolidation_run_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
