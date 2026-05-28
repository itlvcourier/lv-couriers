-- Customer Feedback Schema
-- Stores customer feedback and ratings for drivers and businesses

-- ================================================================
-- CUSTOMER_FEEDBACK TABLE
-- ================================================================
-- Tracks customer feedback for each delivery with ratings and comments

CREATE TABLE IF NOT EXISTS customer_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES business_locations(id) ON DELETE CASCADE,
  
  -- Feedback token for public access
  token TEXT UNIQUE NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  
  -- Ratings (1-5 stars)
  driver_rating INT CHECK (driver_rating >= 1 AND driver_rating <= 5),
  business_rating INT CHECK (business_rating >= 1 AND business_rating <= 5),
  
  -- Detailed driver ratings
  driver_professionalism INT CHECK (driver_professionalism >= 1 AND driver_professionalism <= 5),
  driver_timeliness INT CHECK (driver_timeliness >= 1 AND driver_timeliness <= 5),
  driver_package_handling INT CHECK (driver_package_handling >= 1 AND driver_package_handling <= 5),
  
  -- Detailed business ratings
  business_packaging INT CHECK (business_packaging >= 1 AND business_packaging <= 5),
  business_accuracy INT CHECK (business_accuracy >= 1 AND business_accuracy <= 5),
  
  -- Comments
  comment TEXT,
  
  -- Issues reported (comma-separated or JSON array)
  reported_issues JSONB, -- {"issues": ["late", "damaged", "rude", "other"]}
  issue_details TEXT,
  
  -- Feedback status
  feedback_received BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- DRIVER_RATINGS_SUMMARY TABLE (DENORMALIZED)
-- ================================================================
-- Cached average ratings for drivers for quick dashboard display
-- Updated whenever new feedback is submitted

CREATE TABLE IF NOT EXISTS driver_ratings_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL UNIQUE REFERENCES drivers(id) ON DELETE CASCADE,
  
  -- Overall rating
  avg_overall_rating NUMERIC(3,2),
  total_ratings INT NOT NULL DEFAULT 0,
  
  -- Detailed rating averages
  avg_professionalism NUMERIC(3,2),
  avg_timeliness NUMERIC(3,2),
  avg_package_handling NUMERIC(3,2),
  
  -- Feedback count
  total_feedback INT NOT NULL DEFAULT 0,
  feedback_received_count INT NOT NULL DEFAULT 0,
  
  -- Last updated
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- BUSINESS_RATINGS_SUMMARY TABLE (DENORMALIZED)
-- ================================================================
-- Cached average ratings per business location for quick dashboard display

CREATE TABLE IF NOT EXISTS business_ratings_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES business_locations(id) ON DELETE CASCADE,
  
  UNIQUE(business_id, location_id),
  
  -- Overall rating
  avg_overall_rating NUMERIC(3,2),
  total_ratings INT NOT NULL DEFAULT 0,
  
  -- Detailed rating averages
  avg_packaging NUMERIC(3,2),
  avg_accuracy NUMERIC(3,2),
  
  -- Feedback count
  total_feedback INT NOT NULL DEFAULT 0,
  feedback_received_count INT NOT NULL DEFAULT 0,
  
  -- Last updated
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_customer_feedback_delivery ON customer_feedback(delivery_id);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_driver ON customer_feedback(driver_id);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_business ON customer_feedback(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_location ON customer_feedback(location_id);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_token ON customer_feedback(token);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_submitted ON customer_feedback(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_feedback_feedback_received ON customer_feedback(feedback_received);

CREATE INDEX IF NOT EXISTS idx_driver_ratings_summary_driver ON driver_ratings_summary(driver_id);
CREATE INDEX IF NOT EXISTS idx_business_ratings_summary_business ON business_ratings_summary(business_id, location_id);

-- ================================================================
-- ENABLE RLS
-- ================================================================

ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_ratings_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_ratings_summary ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- RLS POLICIES - Customer Feedback
-- ================================================================

-- Public can view feedback (for feedback submission page)
CREATE POLICY "Public feedback access via token" ON customer_feedback
  FOR SELECT USING (
    token IS NOT NULL AND 
    token_expires_at > NOW() AND
    feedback_received = FALSE
  );

-- Drivers can view their own feedback (not yet submitted, or submitted feedback)
CREATE POLICY "Drivers view their feedback" ON customer_feedback
  FOR SELECT TO authenticated USING (
    driver_id = auth.uid() OR
    (
      SELECT role FROM auth.users WHERE id = auth.uid()
    ) = 'admin'
  );

-- Businesses can view feedback for their deliveries
CREATE POLICY "Businesses view their feedback" ON customer_feedback
  FOR SELECT TO authenticated USING (
    business_id = (
      SELECT business_id FROM business_users WHERE user_id = auth.uid() LIMIT 1
    ) OR
    (
      SELECT role FROM auth.users WHERE id = auth.uid()
    ) = 'admin'
  );

-- Admin can view all feedback
CREATE POLICY "Admin view all feedback" ON customer_feedback
  FOR SELECT TO authenticated USING (
    (SELECT role FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

-- Public can insert feedback via token
CREATE POLICY "Public submit feedback via token" ON customer_feedback
  FOR UPDATE TO anon USING (
    token IS NOT NULL AND 
    token_expires_at > NOW() AND
    feedback_received = FALSE
  ) WITH CHECK (
    token IS NOT NULL AND 
    token_expires_at > NOW() AND
    feedback_received = FALSE
  );

-- System can insert feedback records
CREATE POLICY "System insert feedback" ON customer_feedback
  FOR INSERT TO authenticated WITH CHECK (true);

-- ================================================================
-- RLS POLICIES - Driver Ratings Summary
-- ================================================================

-- Everyone can read driver ratings
CREATE POLICY "Public read driver ratings" ON driver_ratings_summary
  FOR SELECT USING (true);

-- System updates only
CREATE POLICY "System update driver ratings" ON driver_ratings_summary
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ================================================================
-- RLS POLICIES - Business Ratings Summary
-- ================================================================

-- Everyone can read business ratings
CREATE POLICY "Public read business ratings" ON business_ratings_summary
  FOR SELECT USING (true);

-- Businesses read their own ratings
CREATE POLICY "Business read own ratings" ON business_ratings_summary
  FOR SELECT TO authenticated USING (
    business_id = (
      SELECT business_id FROM business_users WHERE user_id = auth.uid() LIMIT 1
    ) OR
    (
      SELECT role FROM auth.users WHERE id = auth.uid()
    ) = 'admin'
  );

-- System updates only
CREATE POLICY "System update business ratings" ON business_ratings_summary
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ================================================================
-- FUNCTIONS & TRIGGERS
-- ================================================================

-- Function to update driver ratings summary when feedback is submitted
CREATE OR REPLACE FUNCTION update_driver_ratings_summary()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.feedback_received = TRUE AND OLD.feedback_received = FALSE THEN
    -- Recalculate driver ratings
    INSERT INTO driver_ratings_summary (driver_id, avg_overall_rating, total_ratings, avg_professionalism, avg_timeliness, avg_package_handling, total_feedback, feedback_received_count)
    SELECT
      NEW.driver_id,
      ROUND(AVG(CASE WHEN driver_rating IS NOT NULL THEN driver_rating ELSE NULL END)::NUMERIC, 2),
      COUNT(CASE WHEN driver_rating IS NOT NULL THEN 1 END),
      ROUND(AVG(CASE WHEN driver_professionalism IS NOT NULL THEN driver_professionalism ELSE NULL END)::NUMERIC, 2),
      ROUND(AVG(CASE WHEN driver_timeliness IS NOT NULL THEN driver_timeliness ELSE NULL END)::NUMERIC, 2),
      ROUND(AVG(CASE WHEN driver_package_handling IS NOT NULL THEN driver_package_handling ELSE NULL END)::NUMERIC, 2),
      COUNT(*),
      COUNT(CASE WHEN feedback_received = TRUE THEN 1 END)
    FROM customer_feedback
    WHERE driver_id = NEW.driver_id
    ON CONFLICT (driver_id) DO UPDATE SET
      avg_overall_rating = EXCLUDED.avg_overall_rating,
      total_ratings = EXCLUDED.total_ratings,
      avg_professionalism = EXCLUDED.avg_professionalism,
      avg_timeliness = EXCLUDED.avg_timeliness,
      avg_package_handling = EXCLUDED.avg_package_handling,
      total_feedback = EXCLUDED.total_feedback,
      feedback_received_count = EXCLUDED.feedback_received_count,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_customer_feedback_submitted_driver ON customer_feedback;
CREATE TRIGGER on_customer_feedback_submitted_driver
  AFTER UPDATE ON customer_feedback
  FOR EACH ROW
  WHEN (NEW.feedback_received != OLD.feedback_received)
  EXECUTE FUNCTION update_driver_ratings_summary();

-- Function to update business ratings summary when feedback is submitted
CREATE OR REPLACE FUNCTION update_business_ratings_summary()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.feedback_received = TRUE AND OLD.feedback_received = FALSE THEN
    -- Recalculate business ratings for the location
    INSERT INTO business_ratings_summary (business_id, location_id, avg_overall_rating, total_ratings, avg_packaging, avg_accuracy, total_feedback, feedback_received_count)
    SELECT
      NEW.business_id,
      NEW.location_id,
      ROUND(AVG(CASE WHEN business_rating IS NOT NULL THEN business_rating ELSE NULL END)::NUMERIC, 2),
      COUNT(CASE WHEN business_rating IS NOT NULL THEN 1 END),
      ROUND(AVG(CASE WHEN business_packaging IS NOT NULL THEN business_packaging ELSE NULL END)::NUMERIC, 2),
      ROUND(AVG(CASE WHEN business_accuracy IS NOT NULL THEN business_accuracy ELSE NULL END)::NUMERIC, 2),
      COUNT(*),
      COUNT(CASE WHEN feedback_received = TRUE THEN 1 END)
    FROM customer_feedback
    WHERE business_id = NEW.business_id AND location_id = NEW.location_id
    ON CONFLICT (business_id, location_id) DO UPDATE SET
      avg_overall_rating = EXCLUDED.avg_overall_rating,
      total_ratings = EXCLUDED.total_ratings,
      avg_packaging = EXCLUDED.avg_packaging,
      avg_accuracy = EXCLUDED.avg_accuracy,
      total_feedback = EXCLUDED.total_feedback,
      feedback_received_count = EXCLUDED.feedback_received_count,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_customer_feedback_submitted_business ON customer_feedback;
CREATE TRIGGER on_customer_feedback_submitted_business
  AFTER UPDATE ON customer_feedback
  FOR EACH ROW
  WHEN (NEW.feedback_received != OLD.feedback_received)
  EXECUTE FUNCTION update_business_ratings_summary();

-- ================================================================
-- SEED SAMPLE DATA (OPTIONAL - for testing)
-- ================================================================
-- Uncomment to seed sample feedback data for testing

/*
-- Get a test delivery
WITH test_delivery AS (
  SELECT id, driver_id, business_id, location_id FROM deliveries WHERE status = 'delivered' LIMIT 1
)
INSERT INTO customer_feedback (
  delivery_id, driver_id, business_id, location_id,
  token, token_expires_at,
  driver_rating, business_rating,
  driver_professionalism, driver_timeliness, driver_package_handling,
  business_packaging, business_accuracy,
  comment, reported_issues,
  feedback_received, submitted_at
)
SELECT
  id, driver_id, business_id, location_id,
  'test-token-' || substring(md5(random()::text) from 1 for 16), NOW() + INTERVAL '7 days',
  5, 5,
  5, 5, 5,
  5, 5,
  'Great service! Driver was professional and delivery was on time.',
  '{"issues": []}',
  TRUE, NOW()
FROM test_delivery;
*/
