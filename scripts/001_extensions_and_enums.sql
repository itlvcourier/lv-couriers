-- DOMS Database Schema - Part 1: Extensions and Enums
-- LV Courier Inc. - Delivery Operations Management System
-- Run this FIRST before any other scripts

-- ================================================================
-- EXTENSIONS
-- ================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable PostGIS for GPS/geofencing (optional but recommended)
-- CREATE EXTENSION IF NOT EXISTS "postgis";

-- Enable Row Level Security globally
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO authenticated;

-- ================================================================
-- ENUM TYPES
-- ================================================================

-- User roles
CREATE TYPE user_role AS ENUM ('admin', 'driver', 'business');

-- Driver status
CREATE TYPE driver_status AS ENUM ('available', 'on_delivery', 'off_duty');

-- Invite/account status
CREATE TYPE invite_status AS ENUM ('pending', 'active', 'deactivated');

-- Delivery lifecycle status
CREATE TYPE delivery_status AS ENUM (
  'posted', 'claimed', 'en_route_pickup', 'picked_up',
  'en_route_dropoff', 'delivered', 'failed_retry',
  'failed_permanent', 'flagged', 'cancelled'
);

-- Manifest item types (for billing calculation)
CREATE TYPE manifest_item_type AS ENUM (
  'small_package', 'big_package', 'out_of_town', 'rush'
);

-- Flag types raised by drivers
CREATE TYPE flag_type AS ENUM (
  'wrong_items', 'qty_adjusted', 'location_override',
  'access_issue', 'other'
);

-- Flag resolution status
CREATE TYPE flag_status AS ENUM ('open', 'resolved');

-- Invoice lifecycle status
CREATE TYPE invoice_status AS ENUM (
  'draft', 'sent', 'paid', 'overdue', 'disputed', 'escalated'
);

-- Invoice format (per business preference)
CREATE TYPE invoice_format AS ENUM (
  'combined', 'separate', 'combined_breakdown'
);

-- Payment methods
CREATE TYPE payment_method AS ENUM (
  'e_transfer', 'cheque', 'bank_transfer', 'cash', 'other'
);

-- SMS types
CREATE TYPE sms_type AS ENUM (
  'pickup_alert', 'tracking_link', 'delivery_confirm',
  'failed_attempt', 'invoice_reminder', 'overdue_notice'
);

-- SMS delivery status
CREATE TYPE sms_status AS ENUM ('sent', 'delivered', 'failed', 'bounced');

-- Admin notification types
CREATE TYPE notification_type AS ENUM (
  'flag', 'timeout', 'completion', 'new_job', 'invoice',
  'qty_adjustment', 'driver_deactivated', 'sla_breach'
);

-- Cancellation stage (determines fee)
CREATE TYPE cancellation_stage AS ENUM (
  'before_depart', 'en_route_pickup', 'after_pickup'
);

-- Trip status (multi-stop)
CREATE TYPE trip_status AS ENUM ('active', 'completed');

-- Dispute status
CREATE TYPE dispute_status AS ENUM ('open', 'accepted', 'rejected');
