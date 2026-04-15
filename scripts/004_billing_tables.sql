-- DOMS Database Schema - Part 4: Billing & Invoice Tables
-- Tables 16-24: invoices, line_items, disputes, payments, reminders, sms_log, notifications, etc.
-- Run AFTER 003_delivery_tables.sql

-- ================================================================
-- 16. INVOICES
-- ================================================================

-- Auto-generate invoice number sequence
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 798;

CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id),
  location_id     UUID REFERENCES business_locations(id),
  invoice_number  TEXT NOT NULL UNIQUE,  -- e.g. INV-798
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  status          invoice_status NOT NULL DEFAULT 'draft',
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_due      NUMERIC(10,2) NOT NULL DEFAULT 0,
  due_date        DATE,
  reference_code  TEXT NOT NULL UNIQUE,  -- for e-transfer
  -- Email tracking
  primary_email   TEXT,
  backup_email    TEXT,
  sent_at         TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  email_bounced   BOOLEAN NOT NULL DEFAULT FALSE,
  -- Payment
  paid_at         TIMESTAMPTZ,
  paid_by         UUID REFERENCES auth.users(id),
  payment_method  payment_method,
  payment_ref     TEXT,
  amount_received NUMERIC(10,2),
  -- Escalation
  escalated_at    TIMESTAMPTZ,
  -- Dispute
  has_dispute     BOOLEAN NOT NULL DEFAULT FALSE,
  dispute_pauses_reminders BOOLEAN NOT NULL DEFAULT TRUE,
  -- PDF
  pdf_url         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-generate invoice number
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.invoice_number := 'INV-' || nextval('invoice_number_seq');
  NEW.reference_code := NEW.invoice_number || '-' ||
    upper(substring(md5(random()::text) from 1 for 4));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_invoice_created ON invoices;
CREATE TRIGGER on_invoice_created
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_invoice_number();

-- Add invoice_id foreign key to deliveries
ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_invoice_id_fkey;
ALTER TABLE deliveries ADD CONSTRAINT deliveries_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

-- ================================================================
-- 17. INVOICE_LINE_ITEMS
-- ================================================================

CREATE TABLE IF NOT EXISTS invoice_line_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id   UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  delivery_id  UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  description  TEXT NOT NULL,
  delivery_type manifest_item_type,
  quantity     INT NOT NULL DEFAULT 1,
  unit_rate    NUMERIC(10,2) NOT NULL,
  total        NUMERIC(10,2) NOT NULL,
  is_disputed  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 18. DISPUTES
-- ================================================================

CREATE TABLE IF NOT EXISTS disputes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id        UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_item_id      UUID REFERENCES invoice_line_items(id),
  raised_by         UUID REFERENCES auth.users(id),
  claim_text        TEXT NOT NULL,
  evidence_photo_url TEXT,
  status            dispute_status NOT NULL DEFAULT 'open',
  resolved_by       UUID REFERENCES auth.users(id),
  admin_note        TEXT,
  credit_amount     NUMERIC(10,2),
  raised_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ
);

-- ================================================================
-- 19. PAYMENTS
-- ================================================================

CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id      UUID REFERENCES invoices(id) ON DELETE SET NULL,
  business_id     UUID NOT NULL REFERENCES businesses(id),
  amount          NUMERIC(10,2) NOT NULL,
  method          payment_method NOT NULL,
  payment_date    DATE NOT NULL,
  reference       TEXT,
  note            TEXT,
  is_matched      BOOLEAN NOT NULL DEFAULT FALSE,
  matched_at      TIMESTAMPTZ,
  matched_by      UUID REFERENCES auth.users(id),
  recorded_by     UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 20. INVOICE_REMINDERS
-- ================================================================

CREATE TABLE IF NOT EXISTS invoice_reminders (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id   UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  reminder_num INT NOT NULL,  -- 1, 2, 3, 4
  type         TEXT NOT NULL, -- 'reminder' | 'overdue' | 'escalation'
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_sent   BOOLEAN NOT NULL DEFAULT FALSE,
  sms_sent     BOOLEAN NOT NULL DEFAULT FALSE
);

-- ================================================================
-- 21. SMS_LOG
-- ================================================================

CREATE TABLE IF NOT EXISTS sms_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id     UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  invoice_id      UUID REFERENCES invoices(id) ON DELETE SET NULL,
  recipient_phone TEXT NOT NULL,
  type            sms_type NOT NULL,
  message         TEXT NOT NULL,
  status          sms_status NOT NULL DEFAULT 'sent',
  twilio_sid      TEXT,
  error_message   TEXT,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at    TIMESTAMPTZ
);

-- ================================================================
-- 22. NOTIFICATIONS
-- ================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  for_role     user_role NOT NULL DEFAULT 'admin',
  type         notification_type NOT NULL,
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  delivery_id  UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  invoice_id   UUID REFERENCES invoices(id) ON DELETE SET NULL,
  driver_id    UUID REFERENCES drivers(id) ON DELETE SET NULL,
  business_id  UUID REFERENCES businesses(id) ON DELETE SET NULL,
  is_read      BOOLEAN NOT NULL DEFAULT FALSE,
  action_url   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 23. CANCELLATION_LOGS
-- ================================================================

CREATE TABLE IF NOT EXISTS cancellation_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id   UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  cancelled_by  UUID REFERENCES auth.users(id),
  stage         cancellation_stage NOT NULL,
  reason        TEXT,
  fee_applied   NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 24. UNMATCHED_PAYMENTS
-- ================================================================

CREATE TABLE IF NOT EXISTS unmatched_payments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  amount       NUMERIC(10,2) NOT NULL,
  sender       TEXT,
  reference    TEXT,
  received_at  DATE NOT NULL,
  note         TEXT,
  resolved     BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at  TIMESTAMPTZ,
  payment_id   UUID REFERENCES payments(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 25. AUDIT_LOG
-- ================================================================
-- Immutable record of all admin actions. Never deleted.

CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  performed_by UUID REFERENCES auth.users(id),
  action      TEXT NOT NULL,
  table_name  TEXT NOT NULL,
  record_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
