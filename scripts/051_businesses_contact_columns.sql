-- Add contact columns to businesses table
-- These columns were expected by the app but missing from the schema

-- Add billing_email column
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS billing_email TEXT;

-- Add contact_name column
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS contact_name TEXT;

-- Add contact_phone column
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Add status column (replaces invite_status for consistency with app)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended'));

-- Migrate existing invite_status values to status if they exist
UPDATE businesses 
SET status = CASE 
  WHEN invite_status = 'active' THEN 'active'
  WHEN invite_status = 'pending' THEN 'pending'
  ELSE 'pending'
END
WHERE status IS NULL AND invite_status IS NOT NULL;

-- Set default for new rows
ALTER TABLE businesses ALTER COLUMN status SET DEFAULT 'pending';
