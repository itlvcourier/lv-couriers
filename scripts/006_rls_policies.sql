-- DOMS Database Schema - Part 6: Row Level Security
-- RLS policies for all tables
-- Run AFTER all table creation and indexes

-- ================================================================
-- ENABLE RLS ON ALL TABLES
-- ================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_manifest_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE unmatched_payments ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- HELPER FUNCTIONS
-- ================================================================

-- Get current user role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get current driver id
CREATE OR REPLACE FUNCTION get_my_driver_id()
RETURNS UUID AS $$
  SELECT driver_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get current business id
CREATE OR REPLACE FUNCTION get_my_business_id()
RETURNS UUID AS $$
  SELECT business_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Get current location id
CREATE OR REPLACE FUNCTION get_my_location_id()
RETURNS UUID AS $$
  SELECT location_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ================================================================
-- PROFILES POLICIES
-- ================================================================

DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_admin_all ON profiles;
CREATE POLICY profiles_admin_all ON profiles
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

-- ================================================================
-- DELIVERIES POLICIES
-- ================================================================

DROP POLICY IF EXISTS deliveries_admin_all ON deliveries;
CREATE POLICY deliveries_admin_all ON deliveries
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS deliveries_driver_select ON deliveries;
CREATE POLICY deliveries_driver_select ON deliveries
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'driver' AND (
      status = 'posted'  -- can see available jobs
      OR driver_id = get_my_driver_id()  -- or their own
    )
  );

DROP POLICY IF EXISTS deliveries_driver_update ON deliveries;
CREATE POLICY deliveries_driver_update ON deliveries
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'driver' AND driver_id = get_my_driver_id());

DROP POLICY IF EXISTS deliveries_driver_claim ON deliveries;
CREATE POLICY deliveries_driver_claim ON deliveries
  FOR UPDATE TO authenticated
  USING (get_my_role() = 'driver' AND status = 'posted');

DROP POLICY IF EXISTS deliveries_business_all ON deliveries;
CREATE POLICY deliveries_business_all ON deliveries
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'business'
    AND location_id = get_my_location_id()
  );

-- ================================================================
-- DRIVERS POLICIES
-- ================================================================

DROP POLICY IF EXISTS drivers_admin_all ON drivers;
CREATE POLICY drivers_admin_all ON drivers
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS drivers_self ON drivers;
CREATE POLICY drivers_self ON drivers
  FOR SELECT TO authenticated
  USING (id = get_my_driver_id());

-- ================================================================
-- DRIVER_LOCATIONS POLICIES
-- ================================================================

DROP POLICY IF EXISTS locations_admin ON driver_locations;
CREATE POLICY locations_admin ON driver_locations
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS locations_driver_insert ON driver_locations;
CREATE POLICY locations_driver_insert ON driver_locations
  FOR INSERT TO authenticated
  WITH CHECK (driver_id = get_my_driver_id());

DROP POLICY IF EXISTS locations_driver_select ON driver_locations;
CREATE POLICY locations_driver_select ON driver_locations
  FOR SELECT TO authenticated
  USING (driver_id = get_my_driver_id());

-- ================================================================
-- BUSINESSES POLICIES
-- ================================================================

DROP POLICY IF EXISTS businesses_admin_all ON businesses;
CREATE POLICY businesses_admin_all ON businesses
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS businesses_own ON businesses;
CREATE POLICY businesses_own ON businesses
  FOR SELECT TO authenticated
  USING (id = get_my_business_id());

-- ================================================================
-- BUSINESS_LOCATIONS POLICIES
-- ================================================================

DROP POLICY IF EXISTS business_locations_admin ON business_locations;
CREATE POLICY business_locations_admin ON business_locations
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS business_locations_own ON business_locations;
CREATE POLICY business_locations_own ON business_locations
  FOR SELECT TO authenticated
  USING (id = get_my_location_id());

-- ================================================================
-- INVOICES POLICIES
-- ================================================================

DROP POLICY IF EXISTS invoices_admin ON invoices;
CREATE POLICY invoices_admin ON invoices
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS invoices_business ON invoices;
CREATE POLICY invoices_business ON invoices
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'business'
    AND location_id = get_my_location_id()
  );

-- ================================================================
-- RATE_CARDS POLICIES
-- ================================================================

DROP POLICY IF EXISTS rate_cards_admin ON rate_cards;
CREATE POLICY rate_cards_admin ON rate_cards
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS rate_cards_business_read ON rate_cards;
CREATE POLICY rate_cards_business_read ON rate_cards
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'business'
    AND location_id = get_my_location_id()
  );

-- ================================================================
-- TRACKING_LINKS POLICIES (public read by code)
-- ================================================================

DROP POLICY IF EXISTS tracking_public_read ON tracking_links;
CREATE POLICY tracking_public_read ON tracking_links
  FOR SELECT
  USING (expires_at > NOW());

-- ================================================================
-- SYSTEM_SETTINGS POLICIES
-- ================================================================

DROP POLICY IF EXISTS settings_admin_all ON system_settings;
CREATE POLICY settings_admin_all ON system_settings
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS settings_read_all ON system_settings;
CREATE POLICY settings_read_all ON system_settings
  FOR SELECT TO authenticated
  USING (TRUE);

-- ================================================================
-- NOTIFICATIONS POLICIES
-- ================================================================

DROP POLICY IF EXISTS notifications_admin ON notifications;
CREATE POLICY notifications_admin ON notifications
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS notifications_driver ON notifications;
CREATE POLICY notifications_driver ON notifications
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'driver'
    AND for_role = 'driver'
    AND driver_id = get_my_driver_id()
  );

-- ================================================================
-- TRIPS POLICIES
-- ================================================================

DROP POLICY IF EXISTS trips_admin ON trips;
CREATE POLICY trips_admin ON trips
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS trips_driver_own ON trips;
CREATE POLICY trips_driver_own ON trips
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'driver'
    AND driver_id = get_my_driver_id()
  );

-- ================================================================
-- DELIVERY_MANIFEST_ITEMS POLICIES
-- ================================================================

DROP POLICY IF EXISTS manifest_items_admin ON delivery_manifest_items;
CREATE POLICY manifest_items_admin ON delivery_manifest_items
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin');

DROP POLICY IF EXISTS manifest_items_driver ON delivery_manifest_items;
CREATE POLICY manifest_items_driver ON delivery_manifest_items
  FOR SELECT TO authenticated
  USING (
    get_my_role() = 'driver'
    AND EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_manifest_items.delivery_id
      AND (d.status = 'posted' OR d.driver_id = get_my_driver_id())
    )
  );

DROP POLICY IF EXISTS manifest_items_business ON delivery_manifest_items;
CREATE POLICY manifest_items_business ON delivery_manifest_items
  FOR ALL TO authenticated
  USING (
    get_my_role() = 'business'
    AND EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.id = delivery_manifest_items.delivery_id
      AND d.location_id = get_my_location_id()
    )
  );

-- ================================================================
-- AUDIT_LOG POLICIES (admin only)
-- ================================================================

DROP POLICY IF EXISTS audit_log_admin ON audit_log;
CREATE POLICY audit_log_admin ON audit_log
  FOR ALL TO authenticated
  USING (get_my_role() = 'admin');
