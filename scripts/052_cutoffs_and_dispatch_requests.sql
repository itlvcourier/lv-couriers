-- ============================================================
-- PHASE 1: business_cutoffs + dispatch_requests (approval queue)
-- Repo-parity copy of migration phase1_cutoffs_and_dispatch_requests.
-- Single-tenant (fixed org_id sentinel), demo-mode permissive RLS.
-- ============================================================

-- ---------- business_cutoffs: per-store cutoff, DOW overrides ----------
CREATE TABLE IF NOT EXISTS business_cutoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day_of_week int,                       -- NULL = default (every day); 0=Sun..6=Sat overrides
  cutoff_time time NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Edmonton',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_cutoffs_dow_chk CHECK (day_of_week IS NULL OR (day_of_week BETWEEN 0 AND 6))
);
CREATE UNIQUE INDEX IF NOT EXISTS business_cutoffs_default_uidx
  ON business_cutoffs (org_id, business_id) WHERE day_of_week IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS business_cutoffs_dow_uidx
  ON business_cutoffs (org_id, business_id, day_of_week) WHERE day_of_week IS NOT NULL;
CREATE INDEX IF NOT EXISTS business_cutoffs_lookup_idx
  ON business_cutoffs (org_id, business_id, is_active);

-- ---------- dispatch_requests: unified approval queue ----------
CREATE TABLE IF NOT EXISTS dispatch_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  type text NOT NULL,                    -- late_order|address_change|cancel|transfer|redelivery
  business_id uuid REFERENCES businesses(id) ON DELETE SET NULL,
  delivery_id uuid REFERENCES deliveries(id) ON DELETE SET NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending|approved|rejected|expired|auto_approved|cancelled
  surcharge_code text,
  reason text,
  requested_by uuid,
  requested_by_role text,                -- business|driver|admin|system
  decided_by uuid,
  expires_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_requests_type_chk CHECK (type IN ('late_order','address_change','cancel','transfer','redelivery')),
  CONSTRAINT dispatch_requests_status_chk CHECK (status IN ('pending','approved','rejected','expired','auto_approved','cancelled'))
);
CREATE INDEX IF NOT EXISTS dispatch_requests_status_idx ON dispatch_requests (org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS dispatch_requests_business_idx ON dispatch_requests (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dispatch_requests_delivery_idx ON dispatch_requests (delivery_id);
CREATE INDEX IF NOT EXISTS dispatch_requests_expiry_idx ON dispatch_requests (expires_at) WHERE status = 'pending';

-- keep updated_at fresh
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS dispatch_requests_set_updated ON dispatch_requests;
CREATE TRIGGER dispatch_requests_set_updated BEFORE UPDATE ON dispatch_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS business_cutoffs_set_updated ON business_cutoffs;
CREATE TRIGGER business_cutoffs_set_updated BEFORE UPDATE ON business_cutoffs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- expire stale pending requests (called by app before reads / decisions)
CREATE OR REPLACE FUNCTION expire_dispatch_requests()
RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  UPDATE dispatch_requests
     SET status = 'expired', decided_at = now()
   WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;

-- ---------- RLS (demo-mode permissive, consistent with rest of app) ----------
ALTER TABLE business_cutoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_cutoffs_demo_all ON business_cutoffs;
CREATE POLICY business_cutoffs_demo_all ON business_cutoffs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS dispatch_requests_demo_all ON dispatch_requests;
CREATE POLICY dispatch_requests_demo_all ON dispatch_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
