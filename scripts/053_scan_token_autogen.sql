-- ============================================================
-- PHASE 2: auto-generate deliveries.scan_token (LV-XXXXXX)
-- Mirrors migration: phase2_scan_token_autogen
-- ============================================================

-- Crockford base32 (no I,L,O,U) random token, collision-checked.
CREATE OR REPLACE FUNCTION gen_scan_token()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  alphabet text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  candidate text;
  i int;
  exists_count int;
BEGIN
  LOOP
    candidate := 'LV-';
    FOR i IN 1..6 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    SELECT count(*) INTO exists_count FROM deliveries WHERE scan_token = candidate;
    EXIT WHEN exists_count = 0;
  END LOOP;
  RETURN candidate;
END; $$;

-- Assign on insert when not provided.
CREATE OR REPLACE FUNCTION set_scan_token()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.scan_token IS NULL OR NEW.scan_token = '' THEN
    NEW.scan_token := gen_scan_token();
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS deliveries_set_scan_token ON deliveries;
CREATE TRIGGER deliveries_set_scan_token
  BEFORE INSERT ON deliveries
  FOR EACH ROW EXECUTE FUNCTION set_scan_token();

-- Backfill existing rows.
UPDATE deliveries SET scan_token = gen_scan_token()
WHERE scan_token IS NULL OR scan_token = '';
