-- 031_saved_contacts_and_recipient_fields.sql
-- Adds a per-business recipient address book and enriches deliveries
-- with recipient name / buzz code fields.

-- 1) New columns on deliveries for recipient name + buzz/unit code
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS buzz_code TEXT;

-- 2) Saved contacts table (address book per business)
CREATE TABLE IF NOT EXISTS public.saved_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT NOT NULL,
  area TEXT,
  buzz_code TEXT,
  notes TEXT,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_contacts_business
  ON public.saved_contacts(business_id, last_used_at DESC NULLS LAST);

-- Fuzzy lookup helper: lower(name) + lower(address) should be unique per business
-- so we can "upsert" contacts when creating a delivery with the same recipient.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_saved_contacts_business_name_addr
  ON public.saved_contacts(business_id, LOWER(name), LOWER(address));

-- 3) Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.saved_contacts_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_saved_contacts_touch ON public.saved_contacts;
CREATE TRIGGER trg_saved_contacts_touch
BEFORE UPDATE ON public.saved_contacts
FOR EACH ROW EXECUTE FUNCTION public.saved_contacts_touch();

-- 4) Demo-mode RLS (mirrors the permissive policies used on other tables)
ALTER TABLE public.saved_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS saved_contacts_demo_all ON public.saved_contacts;
CREATE POLICY saved_contacts_demo_all
  ON public.saved_contacts
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
