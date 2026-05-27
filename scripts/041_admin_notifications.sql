-- Admin Notifications table
-- Stores system notifications for admin users

CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON admin_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_type ON admin_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_read ON admin_notifications(is_read);

-- Enable RLS
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

-- Allow all for authenticated users (admin-only check is in app code)
CREATE POLICY "Allow all for authenticated" ON admin_notifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed some example notifications
INSERT INTO admin_notifications (notification_type, title, message, priority, is_read, created_at)
VALUES
  ('new_job', 'New Delivery Posted', 'FreshMart posted a new rush delivery to Calgary downtown', 'medium', false, NOW() - INTERVAL '2 hours'),
  ('flag', 'Delivery Flagged', 'Driver Marcus Chen flagged delivery #WANRUAAJ - customer not available', 'high', false, NOW() - INTERVAL '4 hours'),
  ('completion', 'Delivery Completed', 'Delivery #RWC3995A completed successfully', 'low', true, NOW() - INTERVAL '1 day'),
  ('sla_breach', 'SLA Warning', 'Delivery #ABC1234 approaching SLA deadline - 15 minutes remaining', 'urgent', false, NOW() - INTERVAL '30 minutes'),
  ('timeout', 'Driver Timeout', 'Driver Sarah Johnson has been idle for 45 minutes', 'medium', false, NOW() - INTERVAL '1 hour'),
  ('invoice', 'Invoice Generated', 'Invoice #INV-2024-001 generated for FreshMart - $450.00', 'low', true, NOW() - INTERVAL '2 days'),
  ('system', 'System Maintenance', 'Scheduled maintenance window tonight 2am-4am MST', 'low', true, NOW() - INTERVAL '3 days')
ON CONFLICT DO NOTHING;
