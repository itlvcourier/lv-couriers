-- DOMS Database Schema - Part 5: Indexes
-- Performance indexes for all common query patterns
-- Run AFTER all table creation scripts

-- ================================================================
-- DELIVERIES (most queried table)
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_business ON deliveries(business_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_location ON deliveries(location_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_trip ON deliveries(trip_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_invoice ON deliveries(invoice_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_posted_at ON deliveries(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_tracking ON deliveries(tracking_code);
CREATE INDEX IF NOT EXISTS idx_deliveries_dropoff ON deliveries(dropoff_address);

-- Partial index for active deliveries only
CREATE INDEX IF NOT EXISTS idx_deliveries_active ON deliveries(status)
  WHERE status NOT IN ('delivered', 'failed_permanent', 'cancelled');

-- ================================================================
-- DRIVER_LOCATIONS (high write volume)
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_driver_locations_driver ON driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_recorded ON driver_locations(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_locations_delivery ON driver_locations(delivery_id);

-- ================================================================
-- DELIVERY_MANIFEST_ITEMS
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_manifest_delivery ON delivery_manifest_items(delivery_id);

-- ================================================================
-- DELIVERY_STATUS_LOGS
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_status_logs_delivery ON delivery_status_logs(delivery_id);
CREATE INDEX IF NOT EXISTS idx_status_logs_created ON delivery_status_logs(created_at DESC);

-- ================================================================
-- DELIVERY_FLAGS
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_flags_delivery ON delivery_flags(delivery_id);
CREATE INDEX IF NOT EXISTS idx_flags_status ON delivery_flags(status);

-- ================================================================
-- DELIVERY_VERIFICATIONS
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_verifications_delivery ON delivery_verifications(delivery_id);

-- ================================================================
-- INVOICES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_invoices_business ON invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_location ON invoices(location_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- ================================================================
-- INVOICE_LINE_ITEMS
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON invoice_line_items(invoice_id);

-- ================================================================
-- DISPUTES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_disputes_invoice ON disputes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

-- ================================================================
-- PAYMENTS
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_business ON payments(business_id);

-- ================================================================
-- SMS_LOG
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_sms_delivery ON sms_log(delivery_id);
CREATE INDEX IF NOT EXISTS idx_sms_invoice ON sms_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_sms_sent_at ON sms_log(sent_at DESC);

-- ================================================================
-- NOTIFICATIONS
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(for_role);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ================================================================
-- BUSINESS_LOCATIONS
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_locations_business ON business_locations(business_id);

-- ================================================================
-- RATE_CARDS
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_rate_cards_location ON rate_cards(location_id);

-- ================================================================
-- TRIPS
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);

-- ================================================================
-- TRACKING_LINKS
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_tracking_code ON tracking_links(code);

-- ================================================================
-- PROFILES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_driver ON profiles(driver_id);
CREATE INDEX IF NOT EXISTS idx_profiles_business ON profiles(business_id);
