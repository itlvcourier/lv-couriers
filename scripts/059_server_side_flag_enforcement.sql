-- ============================================================
-- §8 Server-side feature-flag enforcement
--
-- Client-side flag checks (useFeatureFlag) gate the UI, but with permissive
-- RLS a stale or tampered client could still write a gated row. These DB
-- functions + triggers re-check the flag at commit time so enforcement can't
-- be bypassed from the client.
-- ============================================================

-- Read a single boolean flag out of the org_settings jsonb bag. Defaults to the
-- value passed in `p_default` when the org row or key is absent, so a missing
-- settings row fails to a sane default rather than erroring.
CREATE OR REPLACE FUNCTION org_flag(p_org_id uuid, p_key text, p_default boolean)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT (settings ->> p_key)::boolean
       FROM org_settings
      WHERE org_id = p_org_id),
    p_default
  );
$$;

-- Reject new driver transfers when driver-to-driver transfers are turned off.
CREATE OR REPLACE FUNCTION enforce_driver_transfers_enabled()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT org_flag(NEW.org_id, 'driver_transfers_enabled', true) THEN
    RAISE EXCEPTION 'driver_transfers_disabled'
      USING HINT = 'Driver-to-driver transfers are turned off for this organization.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_driver_transfers_enabled ON driver_transfers;
CREATE TRIGGER trg_enforce_driver_transfers_enabled
  BEFORE INSERT ON driver_transfers
  FOR EACH ROW
  EXECUTE FUNCTION enforce_driver_transfers_enabled();

-- Reject new late-order requests when late requests are turned off. (Address
-- changes / cancels / redeliveries are always allowed through the queue; only
-- the late_order type is flag-gated.)
CREATE OR REPLACE FUNCTION enforce_late_requests_enabled()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.type = 'late_order'
     AND NOT org_flag(NEW.org_id, 'late_requests_enabled', true) THEN
    RAISE EXCEPTION 'late_requests_disabled'
      USING HINT = 'Late order requests are turned off for this organization.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_late_requests_enabled ON dispatch_requests;
CREATE TRIGGER trg_enforce_late_requests_enabled
  BEFORE INSERT ON dispatch_requests
  FOR EACH ROW
  EXECUTE FUNCTION enforce_late_requests_enabled();
