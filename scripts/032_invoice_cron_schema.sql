-- Migration: 032_invoice_cron_schema
-- Extends invoices + system_settings for the cron-driven reminder system,
-- and adds invoice_events for auditable scheduled/past events.

-- 1. Extend invoices with the contact / reminder state columns
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS backup_billing_email TEXT,
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT,
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminders_paused BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reminders_skip_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_bounced BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Extend system_settings with the cron-control fields
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS auto_generate_invoices BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS auto_send_invoices BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS invoice_reminder_day_1 INT NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS invoice_overdue_notice_day INT NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS invoice_escalation_day INT NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS invoice_review_reminder_days INT NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS send_reminder_email BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS send_reminder_sms BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Invoice events - fine-grained audit + scheduled-event table.
--    scheduled_for IS NULL  -> the event already occurred (occurred_at is authoritative)
--    scheduled_for IS NOT NULL -> future planned event; the cron flips it to occurred by
--                                  setting occurred_at and clearing scheduled_for.
CREATE TABLE IF NOT EXISTS public.invoice_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'generated','sent','opened','reminder_1','reminder_2','overdue_notice',
    'escalated','disputed','dispute_resolved','paid','bounced','resent',
    'sms_sent','skipped','reminders_paused','reminders_resumed'
  )),
  occurred_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  email TEXT,
  phone TEXT,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT invoice_events_timing_ck CHECK (
    occurred_at IS NOT NULL OR scheduled_for IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice
  ON public.invoice_events(invoice_id, COALESCE(occurred_at, scheduled_for) DESC);

CREATE INDEX IF NOT EXISTS idx_invoice_events_pending_schedule
  ON public.invoice_events(scheduled_for)
  WHERE scheduled_for IS NOT NULL AND occurred_at IS NULL;

-- 4. RLS — match the rest of the app's demo-mode permissive policy
ALTER TABLE public.invoice_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_events_all_access" ON public.invoice_events;
CREATE POLICY "invoice_events_all_access"
  ON public.invoice_events
  FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- 5. Trigger to keep invoices.updated_at fresh when events are added
CREATE OR REPLACE FUNCTION public.touch_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.invoices
     SET updated_at = NOW()
   WHERE id = NEW.invoice_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_events_touch ON public.invoice_events;
CREATE TRIGGER trg_invoice_events_touch
AFTER INSERT ON public.invoice_events
FOR EACH ROW
EXECUTE FUNCTION public.touch_invoice_updated_at();
