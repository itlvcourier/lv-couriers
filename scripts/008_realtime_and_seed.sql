-- DOMS Database Schema - Part 8: Realtime Configuration & Seed Data
-- Run LAST after all other scripts

-- ================================================================
-- REALTIME CONFIGURATION
-- ================================================================
-- These tables broadcast changes in real time to connected clients.

-- Note: Run these in Supabase Dashboard > Database > Replication
-- or via CLI. They may not work in SQL Editor directly.

-- ALTER PUBLICATION supabase_realtime ADD TABLE deliveries;
-- ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
-- ALTER PUBLICATION supabase_realtime ADD TABLE delivery_flags;

-- ================================================================
-- SEED DATA: BUSINESSES
-- ================================================================

INSERT INTO businesses (id, name, invoice_format, invite_status)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'FreshMart Grocery', 'combined', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'MedSupply Co', 'separate', 'active'),
  ('33333333-3333-3333-3333-333333333333', 'HomeGoods Plus', 'combined_breakdown', 'active')
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- SEED DATA: BUSINESS LOCATIONS
-- ================================================================

INSERT INTO business_locations (id, business_id, name, address, area, billing_email, backup_email, has_rate_card, invite_status)
VALUES 
  ('aaaa1111-aaaa-1111-aaaa-111111111111', '11111111-1111-1111-1111-111111111111', 'Shawnessy Store', '250 Shawville Blvd SE, Calgary, AB T2Y 3Z1', 'Shawnessy', 'billing@freshmart.ca', 'manager@freshmart.ca', true, 'active'),
  ('aaaa2222-aaaa-2222-aaaa-222222222222', '11111111-1111-1111-1111-111111111111', 'Brentwood Store', '4820 Northland Dr NW, Calgary, AB T2L 2L4', 'Dalhousie', 'billing@freshmart.ca', 'brentwood@freshmart.ca', true, 'active'),
  ('bbbb1111-bbbb-1111-bbbb-111111111111', '22222222-2222-2222-2222-222222222222', 'Main Warehouse', '1111 Centre St N, Calgary, AB T2E 2R2', 'Crescent Heights', 'accounts@medsupply.ca', 'admin@medsupply.ca', true, 'active'),
  ('cccc1111-cccc-1111-cccc-111111111111', '33333333-3333-3333-3333-333333333333', 'Beltline Store', '3009 14 St SW, Calgary, AB T2T 3V6', 'Beltline', 'finance@homegoods.ca', NULL, true, 'active')
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- SEED DATA: DRIVERS
-- ================================================================

INSERT INTO drivers (id, name, email, phone, status, max_jobs_override, invite_status, total_deliveries, month_deliveries, avg_delivery_mins, rush_sla_rate)
VALUES 
  ('dddd1111-dddd-1111-dddd-111111111111', 'Marcus Reid', 'marcus@lvcourier.ca', '(403) 555-0101', 'available', NULL, 'active', 127, 23, 22, 94),
  ('dddd2222-dddd-2222-dddd-222222222222', 'Jenna Cole', 'jenna@lvcourier.ca', '(403) 555-0102', 'on_delivery', NULL, 'active', 203, 41, 18, 97),
  ('dddd3333-dddd-3333-dddd-333333333333', 'Tariq Hassan', 'tariq@lvcourier.ca', '(403) 555-0103', 'available', 2, 'active', 89, 28, 31, 88),
  ('dddd4444-dddd-4444-dddd-444444444444', 'Sasha Kim', 'sasha@lvcourier.ca', '(403) 555-0104', 'off_duty', NULL, 'active', 156, 19, 24, 91)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- SEED DATA: RATE CARDS
-- ================================================================

INSERT INTO rate_cards (id, location_id, rate_regular, rate_big_double, rate_oot_big, rate_rush, rate_rush_oot, gst_applicable, contract_notes)
VALUES 
  ('rrrr1111-rrrr-1111-rrrr-111111111111', 'aaaa1111-aaaa-1111-aaaa-111111111111', 9.00, 18.00, 28.00, 20.00, 30.00, true, 'Net 15 terms. Bulk discount applied.'),
  ('rrrr2222-rrrr-2222-rrrr-222222222222', 'aaaa2222-aaaa-2222-aaaa-222222222222', 9.00, 18.00, 28.00, 20.00, 30.00, true, NULL),
  ('rrrr3333-rrrr-3333-rrrr-333333333333', 'bbbb1111-bbbb-1111-bbbb-111111111111', 12.00, 24.00, 35.00, 22.00, 32.00, true, 'Priority medical deliveries. Rush SLA guaranteed.'),
  ('rrrr4444-rrrr-4444-rrrr-444444444444', 'cccc1111-cccc-1111-cccc-111111111111', 9.00, 18.00, 25.00, 20.00, 30.00, true, NULL)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- SEED DATA: SAMPLE DELIVERIES
-- ================================================================

-- Posted delivery (Rush/Urgent)
INSERT INTO deliveries (
  id, business_id, location_id, 
  pickup_address, pickup_area, dropoff_address, dropoff_area,
  recipient_phone, is_urgent, is_rush, status, posted_at, rate_card_id
)
VALUES (
  'eeee1111-eeee-1111-eeee-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'aaaa1111-aaaa-1111-aaaa-111111111111',
  '250 Shawville Blvd SE, Calgary, AB T2Y 3Z1', 'Shawnessy',
  '130 Crowfoot Crescent NW, Calgary, AB T3G 3P5', 'Crowfoot',
  '(403) 555-1001', true, true, 'posted', NOW() - INTERVAL '12 minutes',
  'rrrr1111-rrrr-1111-rrrr-111111111111'
)
ON CONFLICT (id) DO NOTHING;

-- Posted delivery (Regular)
INSERT INTO deliveries (
  id, business_id, location_id, 
  pickup_address, pickup_area, dropoff_address, dropoff_area,
  recipient_phone, is_urgent, is_rush, status, posted_at, rate_card_id
)
VALUES (
  'eeee2222-eeee-2222-eeee-222222222222',
  '22222222-2222-2222-2222-222222222222',
  'bbbb1111-bbbb-1111-bbbb-111111111111',
  '1111 Centre St N, Calgary, AB T2E 2R2', 'Crescent Heights',
  '7015 Macleod Trail SW, Calgary, AB T2H 2K6', 'Chinook',
  '(403) 555-1002', false, false, 'posted', NOW() - INTERVAL '25 minutes',
  'rrrr3333-rrrr-3333-rrrr-333333333333'
)
ON CONFLICT (id) DO NOTHING;

-- Claimed delivery
INSERT INTO deliveries (
  id, business_id, location_id, driver_id,
  pickup_address, pickup_area, dropoff_address, dropoff_area,
  recipient_phone, is_urgent, is_rush, status, posted_at, claimed_at, rate_card_id
)
VALUES (
  'eeee3333-eeee-3333-eeee-333333333333',
  '11111111-1111-1111-1111-111111111111',
  'aaaa2222-aaaa-2222-aaaa-222222222222',
  'dddd1111-dddd-1111-dddd-111111111111',
  '4820 Northland Dr NW, Calgary, AB T2L 2L4', 'Dalhousie',
  '901 64 Ave NE, Calgary, AB T2E 7P4', 'Marlborough',
  '(403) 555-1003', false, false, 'claimed', NOW() - INTERVAL '45 minutes', NOW() - INTERVAL '8 minutes',
  'rrrr2222-rrrr-2222-rrrr-222222222222'
)
ON CONFLICT (id) DO NOTHING;

-- Insert manifest items for the deliveries
INSERT INTO delivery_manifest_items (delivery_id, type, posted_qty, notes)
VALUES 
  ('eeee1111-eeee-1111-eeee-111111111111', 'big_package', 3, 'Handle with care - groceries'),
  ('eeee1111-eeee-1111-eeee-111111111111', 'rush', 1, NULL),
  ('eeee2222-eeee-2222-eeee-222222222222', 'small_package', 1, 'Medical supplies - fragile'),
  ('eeee3333-eeee-3333-eeee-333333333333', 'big_package', 2, NULL)
ON CONFLICT DO NOTHING;

-- Insert status logs for deliveries
INSERT INTO delivery_status_logs (delivery_id, status, created_at)
VALUES 
  ('eeee1111-eeee-1111-eeee-111111111111', 'posted', NOW() - INTERVAL '12 minutes'),
  ('eeee2222-eeee-2222-eeee-222222222222', 'posted', NOW() - INTERVAL '25 minutes'),
  ('eeee3333-eeee-3333-eeee-333333333333', 'posted', NOW() - INTERVAL '45 minutes'),
  ('eeee3333-eeee-3333-eeee-333333333333', 'claimed', NOW() - INTERVAL '8 minutes')
ON CONFLICT DO NOTHING;

-- ================================================================
-- VERIFY SETUP
-- ================================================================

-- Check table counts
DO $$
DECLARE
  table_count INT;
BEGIN
  SELECT COUNT(*) INTO table_count FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  RAISE NOTICE 'Total tables created: %', table_count;
END $$;
