-- 060: Delayed review requests + settings cleanup
--
-- Part 1: Schedule review requests instead of firing them the same instant as the
--         "delivered" SMS (customer was getting two texts ~1s apart).
-- Part 2: Add the admin-configurable delay setting.
-- Part 3: Remove two placebo SMS toggles that had switches but no sender routes.

-- ---------------------------------------------------------------------------
-- Part 1 — review request scheduling columns on deliveries
-- ---------------------------------------------------------------------------
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS review_request_due_at  timestamptz,
  ADD COLUMN IF NOT EXISTS review_request_sent_at timestamptz;

COMMENT ON COLUMN deliveries.review_request_due_at IS
  'When the review-request SMS becomes eligible to send. Stamped at delivery as now() + system_settings.review_request_delay_mins.';
COMMENT ON COLUMN deliveries.review_request_sent_at IS
  'When the review-request SMS was actually sent. Non-null means never send again (idempotency guard for the cron sweep).';

-- Partial index so the cron sweep stays cheap as the table grows: only rows
-- still awaiting a send are indexed.
CREATE INDEX IF NOT EXISTS idx_deliveries_review_request_pending
  ON deliveries (review_request_due_at)
  WHERE review_request_due_at IS NOT NULL
    AND review_request_sent_at IS NULL;

-- ---------------------------------------------------------------------------
-- Part 2 — admin-configurable delay
-- ---------------------------------------------------------------------------
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS review_request_delay_mins integer NOT NULL DEFAULT 30;

COMMENT ON COLUMN system_settings.review_request_delay_mins IS
  'Minutes to wait after delivery before sending the review-request SMS. 0 = send on the next cron sweep.';

-- Backfill any pre-existing rows that predate the DEFAULT.
UPDATE system_settings
SET review_request_delay_mins = 30
WHERE review_request_delay_mins IS NULL;

-- ---------------------------------------------------------------------------
-- Part 3 — drop placebo toggles
--
-- These two rendered working switches in Settings and persisted to the DB, but
-- no sender route ever existed and the app does not model driver shift
-- schedules, so flipping them could never change behaviour. Removed rather
-- than left as a false promise to the operator.
-- ---------------------------------------------------------------------------
ALTER TABLE system_settings
  DROP COLUMN IF EXISTS sms_shift_reminder,
  DROP COLUMN IF EXISTS sms_earnings_summary;
