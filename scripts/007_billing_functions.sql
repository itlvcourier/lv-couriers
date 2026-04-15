-- DOMS Database Schema - Part 7: Billing Logic Functions
-- Core billing calculation and delivery rate application
-- Run AFTER RLS policies

-- ================================================================
-- CALCULATE DELIVERY RATE
-- ================================================================
-- The core billing calculation lives in PostgreSQL so it cannot be bypassed by the client.

CREATE OR REPLACE FUNCTION calculate_delivery_rate(
  p_delivery_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
  v_is_rush        BOOLEAN;
  v_is_oot         BOOLEAN;
  v_big_count      INT;
  v_rate_card      rate_cards%ROWTYPE;
  v_rate           NUMERIC(10,2);
BEGIN
  -- Get delivery flags
  SELECT is_rush, is_out_of_town
  INTO v_is_rush, v_is_oot
  FROM deliveries WHERE id = p_delivery_id;

  -- Get confirmed big package count from verifications
  SELECT COALESCE(SUM(dv.confirmed_qty), 0)
  INTO v_big_count
  FROM delivery_verifications dv
  JOIN delivery_manifest_items dmi ON dv.manifest_item_id = dmi.id
  WHERE dv.delivery_id = p_delivery_id
    AND dmi.type = 'big_package';

  -- Get rate card
  SELECT rc.* INTO v_rate_card
  FROM rate_cards rc
  JOIN deliveries d ON rc.location_id = d.location_id
  WHERE d.id = p_delivery_id
  ORDER BY rc.effective_date DESC
  LIMIT 1;

  -- Apply priority rules:
  -- 1. Rush + Out of Town = highest rate
  -- 2. Rush only
  -- 3. 2+ big packages + out of town
  -- 4. 2+ big packages
  -- 5. Regular
  IF v_is_rush AND v_is_oot THEN
    v_rate := v_rate_card.rate_rush_oot;      -- Priority 1
  ELSIF v_is_rush THEN
    v_rate := v_rate_card.rate_rush;          -- Priority 2
  ELSIF v_big_count >= 2 AND v_is_oot THEN
    v_rate := COALESCE(v_rate_card.rate_oot_big, v_rate_card.rate_big_double);  -- Priority 3
  ELSIF v_big_count >= 2 THEN
    v_rate := v_rate_card.rate_big_double;    -- Priority 4
  ELSE
    v_rate := v_rate_card.rate_regular;       -- Priority 5
  END IF;

  RETURN COALESCE(v_rate, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- APPLY DELIVERY RATE ON COMPLETION
-- ================================================================
-- Trigger function that applies rate when delivery status changes to 'delivered'

CREATE OR REPLACE FUNCTION apply_delivery_rate()
RETURNS TRIGGER AS $$
DECLARE
  v_rate     NUMERIC(10,2);
  v_gst      NUMERIC(10,2);
  v_gst_on   BOOLEAN;
  v_duration INT;
BEGIN
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    v_rate := calculate_delivery_rate(NEW.id);
    
    SELECT gst_applicable INTO v_gst_on
    FROM rate_cards rc WHERE rc.location_id = NEW.location_id
    ORDER BY effective_date DESC LIMIT 1;
    
    v_gst := CASE WHEN v_gst_on THEN ROUND(v_rate * 0.05, 2) ELSE 0 END;
    v_duration := EXTRACT(EPOCH FROM (NOW() - NEW.picked_up_at)) / 60;

    NEW.calculated_rate := v_rate;
    NEW.gst_amount := v_gst;
    NEW.total_amount := v_rate + v_gst;
    NEW.duration_mins := v_duration;
    NEW.delivered_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_delivery_completed ON deliveries;
CREATE TRIGGER on_delivery_completed
  BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION apply_delivery_rate();

-- ================================================================
-- GET TIMED OUT DELIVERIES
-- ================================================================
-- Used by Edge Function to check for stalled deliveries

CREATE OR REPLACE FUNCTION get_timed_out_deliveries(
  intown_mins INT, rush_mins INT, outoftown_mins INT
)
RETURNS TABLE (id UUID, driver_id UUID, driver_name TEXT,
               elapsed_mins INT, delivery_type TEXT)
AS $$
  SELECT
    d.id, d.driver_id, dr.name,
    CAST(EXTRACT(EPOCH FROM (NOW() - MAX(dsl.created_at))) / 60 AS INT) AS elapsed_mins,
    CASE
      WHEN d.is_rush THEN 'rush'
      WHEN d.is_out_of_town THEN 'out_of_town'
      ELSE 'in_town'
    END AS delivery_type
  FROM deliveries d
  JOIN drivers dr ON d.driver_id = dr.id
  JOIN delivery_status_logs dsl ON d.id = dsl.delivery_id
  WHERE d.status NOT IN ('delivered','failed_permanent','cancelled','posted')
    AND d.driver_id IS NOT NULL
  GROUP BY d.id, dr.name, d.is_rush, d.is_out_of_town
  HAVING (
    (d.is_rush AND EXTRACT(EPOCH FROM (NOW() - MAX(dsl.created_at)))/60 > rush_mins)
    OR
    (d.is_out_of_town AND NOT d.is_rush AND
     EXTRACT(EPOCH FROM (NOW() - MAX(dsl.created_at)))/60 > outoftown_mins)
    OR
    (NOT d.is_rush AND NOT d.is_out_of_town AND
     EXTRACT(EPOCH FROM (NOW() - MAX(dsl.created_at)))/60 > intown_mins)
  );
$$ LANGUAGE sql;

-- ================================================================
-- UPDATE DRIVER STATS ON DELIVERY COMPLETION
-- ================================================================

CREATE OR REPLACE FUNCTION update_driver_stats()
RETURNS TRIGGER AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_month_start DATE := DATE_TRUNC('month', CURRENT_DATE);
BEGIN
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' AND NEW.driver_id IS NOT NULL THEN
    UPDATE drivers SET
      total_deliveries = total_deliveries + 1,
      today_deliveries = (
        SELECT COUNT(*) FROM deliveries 
        WHERE driver_id = NEW.driver_id 
        AND status = 'delivered' 
        AND DATE(delivered_at) = v_today
      ),
      month_deliveries = (
        SELECT COUNT(*) FROM deliveries 
        WHERE driver_id = NEW.driver_id 
        AND status = 'delivered' 
        AND delivered_at >= v_month_start
      ),
      avg_delivery_mins = (
        SELECT COALESCE(AVG(duration_mins), 0)::INT FROM deliveries 
        WHERE driver_id = NEW.driver_id 
        AND status = 'delivered'
        AND duration_mins IS NOT NULL
      ),
      updated_at = NOW()
    WHERE id = NEW.driver_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_delivery_completed_update_stats ON deliveries;
CREATE TRIGGER on_delivery_completed_update_stats
  AFTER UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_driver_stats();

-- ================================================================
-- CALCULATE CANCELLATION FEE
-- ================================================================

CREATE OR REPLACE FUNCTION calculate_cancellation_fee(
  p_delivery_id UUID,
  p_stage cancellation_stage
)
RETURNS NUMERIC AS $$
DECLARE
  v_fee NUMERIC(10,2) := 0;
  v_rate_card rate_cards%ROWTYPE;
  v_settings system_settings%ROWTYPE;
BEGIN
  -- Get rate card for location
  SELECT rc.* INTO v_rate_card
  FROM rate_cards rc
  JOIN deliveries d ON rc.location_id = d.location_id
  WHERE d.id = p_delivery_id
  ORDER BY rc.effective_date DESC
  LIMIT 1;

  -- Get system settings as fallback
  SELECT * INTO v_settings FROM system_settings LIMIT 1;

  -- Determine fee based on stage
  IF p_stage = 'before_depart' THEN
    v_fee := COALESCE(v_rate_card.cancel_before_depart, v_settings.cancellation_before_depart, 0);
  ELSIF p_stage = 'en_route_pickup' THEN
    v_fee := COALESCE(v_rate_card.cancel_en_route, v_settings.cancellation_en_route, 5);
  ELSIF p_stage = 'after_pickup' THEN
    -- After pickup, charge full rate
    v_fee := calculate_delivery_rate(p_delivery_id);
  END IF;

  RETURN v_fee;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
