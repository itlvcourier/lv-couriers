-- Seed data for LV Couriers

-- Insert businesses
INSERT INTO businesses (id, name, address, phone, email) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'FreshMart Grocery', '742 Fremont St, Las Vegas, NV 89101', '(702) 555-0101', 'orders@freshmart.com'),
  ('b1000000-0000-0000-0000-000000000002', 'Vegas Auto Parts', '1200 S Main St, Las Vegas, NV 89104', '(702) 555-0102', 'parts@vegasauto.com'),
  ('b1000000-0000-0000-0000-000000000003', 'Silver State Pharmacy', '3500 Las Vegas Blvd S, Las Vegas, NV 89109', '(702) 555-0103', 'rx@silverstatepharm.com');

-- Insert drivers
INSERT INTO drivers (id, name, email, phone, avatar, status, vehicle_type, license_plate, total_deliveries, today_deliveries, rating) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'Marcus Reid', 'marcus@lvcouriers.com', '(702) 555-1001', '/avatars/marcus.jpg', 'available', 'car', 'NV-ABC123', 247, 5, 4.9),
  ('d1000000-0000-0000-0000-000000000002', 'Elena Rodriguez', 'elena@lvcouriers.com', '(702) 555-1002', '/avatars/elena.jpg', 'on_delivery', 'van', 'NV-DEF456', 189, 3, 4.8),
  ('d1000000-0000-0000-0000-000000000003', 'James Chen', 'james@lvcouriers.com', '(702) 555-1003', '/avatars/james.jpg', 'available', 'motorcycle', 'NV-GHI789', 312, 7, 4.95),
  ('d1000000-0000-0000-0000-000000000004', 'Sarah Kim', 'sarah@lvcouriers.com', '(702) 555-1004', '/avatars/sarah.jpg', 'off_duty', 'car', 'NV-JKL012', 156, 0, 4.7);

-- Insert deliveries with various statuses
INSERT INTO deliveries (
  id, business_id, driver_id, 
  pickup_address, pickup_contact, pickup_phone, pickup_notes,
  dropoff_address, dropoff_contact, dropoff_phone, dropoff_notes,
  package_size, package_description, payout, distance, status, priority,
  posted_at, claimed_at, picked_up_at, delivered_at
) VALUES
  -- Posted (available) deliveries
  (
    'a1000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001',
    NULL,
    '742 Fremont St, Las Vegas, NV 89101', 'FreshMart Loading Dock', '(702) 555-0101', 'Use side entrance',
    '1234 Paradise Rd, Las Vegas, NV 89104', 'John Smith', '(702) 555-2001', 'Leave at door if no answer',
    'medium', 'Grocery order - perishable items', 18.50, '3.2 mi', 'posted', 'express',
    NOW() - INTERVAL '30 minutes', NULL, NULL, NULL
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'b1000000-0000-0000-0000-000000000002',
    NULL,
    '1200 S Main St, Las Vegas, NV 89104', 'Parts Counter', '(702) 555-0102', 'Ask for Mike',
    '5678 Boulder Hwy, Henderson, NV 89011', 'Auto Shop Express', '(702) 555-2002', 'Call on arrival',
    'large', 'Engine parts - heavy', 32.00, '8.5 mi', 'posted', 'standard',
    NOW() - INTERVAL '45 minutes', NULL, NULL, NULL
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'b1000000-0000-0000-0000-000000000003',
    NULL,
    '3500 Las Vegas Blvd S, Las Vegas, NV 89109', 'Pharmacy Window', '(702) 555-0103', 'Prescription pickup',
    '9012 W Sahara Ave, Las Vegas, NV 89117', 'Mary Johnson', '(702) 555-2003', 'Requires signature',
    'small', 'Prescription medications', 15.00, '4.1 mi', 'posted', 'urgent',
    NOW() - INTERVAL '15 minutes', NULL, NULL, NULL
  ),
  
  -- Claimed delivery
  (
    'a1000000-0000-0000-0000-000000000004',
    'b1000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000002',
    '742 Fremont St, Las Vegas, NV 89101', 'FreshMart Loading Dock', '(702) 555-0101', NULL,
    '3456 Spring Mountain Rd, Las Vegas, NV 89102', 'Restaurant Supply Co', '(702) 555-2004', 'Delivery entrance in back',
    'xlarge', 'Restaurant supply order', 45.00, '5.8 mi', 'claimed', 'standard',
    NOW() - INTERVAL '1 hour', NOW() - INTERVAL '10 minutes', NULL, NULL
  ),
  
  -- Picked up delivery (in transit)
  (
    'a1000000-0000-0000-0000-000000000005',
    'b1000000-0000-0000-0000-000000000002',
    'd1000000-0000-0000-0000-000000000002',
    '1200 S Main St, Las Vegas, NV 89104', 'Parts Counter', '(702) 555-0102', NULL,
    '7890 Dean Martin Dr, Las Vegas, NV 89139', 'Quick Lube Center', '(702) 555-2005', 'Open until 6 PM',
    'medium', 'Oil filters and brake pads', 22.00, '6.2 mi', 'picked_up', 'express',
    NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '45 minutes', NULL
  ),
  
  -- Delivered (completed) deliveries
  (
    'a1000000-0000-0000-0000-000000000006',
    'b1000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001',
    '742 Fremont St, Las Vegas, NV 89101', 'FreshMart Loading Dock', '(702) 555-0101', NULL,
    '2468 Tropicana Ave, Las Vegas, NV 89121', 'Lisa Wong', '(702) 555-2006', NULL,
    'small', 'Fresh produce order', 12.50, '2.8 mi', 'delivered', 'standard',
    NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours 45 minutes', NOW() - INTERVAL '3 hours 30 minutes', NOW() - INTERVAL '3 hours',
    '45 min', '/proofs/proof-006.jpg', NULL
  ),
  (
    'a1000000-0000-0000-0000-000000000007',
    'b1000000-0000-0000-0000-000000000003',
    'd1000000-0000-0000-0000-000000000003',
    '3500 Las Vegas Blvd S, Las Vegas, NV 89109', 'Pharmacy Window', '(702) 555-0103', NULL,
    '1357 E Desert Inn Rd, Las Vegas, NV 89109', 'Robert Brown', '(702) 555-2007', NULL,
    'small', 'Prescription refill', 10.00, '1.5 mi', 'delivered', 'urgent',
    NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours 50 minutes', NOW() - INTERVAL '4 hours 40 minutes', NOW() - INTERVAL '4 hours 30 minutes',
    '20 min', '/proofs/proof-007.jpg', NULL
  ),
  
  -- Failed delivery
  (
    'a1000000-0000-0000-0000-000000000008',
    'b1000000-0000-0000-0000-000000000002',
    'd1000000-0000-0000-0000-000000000004',
    '1200 S Main St, Las Vegas, NV 89104', 'Parts Counter', '(702) 555-0102', NULL,
    '9999 Industrial Rd, Las Vegas, NV 89118', 'Closed Business', '(702) 555-2008', NULL,
    'large', 'Industrial equipment', 55.00, '7.3 mi', 'failed', 'standard',
    NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours 30 minutes', NOW() - INTERVAL '5 hours', NULL,
    NULL, NULL, 'Business closed - no one available to receive'
  );

-- Update the delivered deliveries with duration
UPDATE deliveries SET duration = '45 min' WHERE id = 'a1000000-0000-0000-0000-000000000006';
UPDATE deliveries SET duration = '20 min' WHERE id = 'a1000000-0000-0000-0000-000000000007';

-- Insert status history for all deliveries
INSERT INTO status_history (delivery_id, status, timestamp, note) VALUES
  -- Delivery 1 (posted)
  ('a1000000-0000-0000-0000-000000000001', 'posted', NOW() - INTERVAL '30 minutes', NULL),
  
  -- Delivery 2 (posted)
  ('a1000000-0000-0000-0000-000000000002', 'posted', NOW() - INTERVAL '45 minutes', NULL),
  
  -- Delivery 3 (posted)
  ('a1000000-0000-0000-0000-000000000003', 'posted', NOW() - INTERVAL '15 minutes', NULL),
  
  -- Delivery 4 (claimed)
  ('a1000000-0000-0000-0000-000000000004', 'posted', NOW() - INTERVAL '1 hour', NULL),
  ('a1000000-0000-0000-0000-000000000004', 'claimed', NOW() - INTERVAL '10 minutes', NULL),
  
  -- Delivery 5 (picked up)
  ('a1000000-0000-0000-0000-000000000005', 'posted', NOW() - INTERVAL '2 hours', NULL),
  ('a1000000-0000-0000-0000-000000000005', 'claimed', NOW() - INTERVAL '1 hour', NULL),
  ('a1000000-0000-0000-0000-000000000005', 'picked_up', NOW() - INTERVAL '45 minutes', NULL),
  
  -- Delivery 6 (delivered)
  ('a1000000-0000-0000-0000-000000000006', 'posted', NOW() - INTERVAL '4 hours', NULL),
  ('a1000000-0000-0000-0000-000000000006', 'claimed', NOW() - INTERVAL '3 hours 45 minutes', NULL),
  ('a1000000-0000-0000-0000-000000000006', 'picked_up', NOW() - INTERVAL '3 hours 30 minutes', NULL),
  ('a1000000-0000-0000-0000-000000000006', 'in_transit', NOW() - INTERVAL '3 hours 15 minutes', NULL),
  ('a1000000-0000-0000-0000-000000000006', 'delivered', NOW() - INTERVAL '3 hours', NULL),
  
  -- Delivery 7 (delivered)
  ('a1000000-0000-0000-0000-000000000007', 'posted', NOW() - INTERVAL '5 hours', NULL),
  ('a1000000-0000-0000-0000-000000000007', 'claimed', NOW() - INTERVAL '4 hours 50 minutes', NULL),
  ('a1000000-0000-0000-0000-000000000007', 'picked_up', NOW() - INTERVAL '4 hours 40 minutes', NULL),
  ('a1000000-0000-0000-0000-000000000007', 'delivered', NOW() - INTERVAL '4 hours 30 minutes', NULL),
  
  -- Delivery 8 (failed)
  ('a1000000-0000-0000-0000-000000000008', 'posted', NOW() - INTERVAL '6 hours', NULL),
  ('a1000000-0000-0000-0000-000000000008', 'claimed', NOW() - INTERVAL '5 hours 30 minutes', NULL),
  ('a1000000-0000-0000-0000-000000000008', 'picked_up', NOW() - INTERVAL '5 hours', NULL),
  ('a1000000-0000-0000-0000-000000000008', 'failed', NOW() - INTERVAL '4 hours 30 minutes', 'Business closed - no one available to receive');

-- Insert activity events
INSERT INTO activity_events (delivery_id, driver_id, business_id, action, status, created_at) VALUES
  ('a1000000-0000-0000-0000-000000000001', NULL, 'b1000000-0000-0000-0000-000000000001', 'posted new delivery', 'posted', NOW() - INTERVAL '30 minutes'),
  ('a1000000-0000-0000-0000-000000000002', NULL, 'b1000000-0000-0000-0000-000000000002', 'posted new delivery', 'posted', NOW() - INTERVAL '45 minutes'),
  ('a1000000-0000-0000-0000-000000000003', NULL, 'b1000000-0000-0000-0000-000000000003', 'posted new delivery', 'posted', NOW() - INTERVAL '15 minutes'),
  ('a1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'claimed', 'claimed', NOW() - INTERVAL '10 minutes'),
  ('a1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'picked up', 'picked_up', NOW() - INTERVAL '45 minutes'),
  ('a1000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'completed delivery', 'delivered', NOW() - INTERVAL '3 hours'),
  ('a1000000-0000-0000-0000-000000000007', 'd1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', 'completed delivery', 'delivered', NOW() - INTERVAL '4 hours 30 minutes'),
  ('a1000000-0000-0000-0000-000000000008', 'd1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000002', 'marked as failed', 'failed', NOW() - INTERVAL '4 hours 30 minutes');
