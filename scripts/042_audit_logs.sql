-- Audit logs table for tracking all system activities
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read audit logs (admin only in practice)
CREATE POLICY "Allow read for authenticated" ON audit_logs
  FOR SELECT TO authenticated USING (true);

-- Allow system to insert audit logs
CREATE POLICY "Allow insert for authenticated" ON audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- Seed some example audit log entries
INSERT INTO audit_logs (user_email, user_role, action, entity_type, entity_name, details, created_at)
VALUES
  ('admin@lvcourier.ca', 'admin', 'create', 'business', 'FreshMart', '{"notes": "New business onboarded"}', NOW() - INTERVAL '5 days'),
  ('admin@lvcourier.ca', 'admin', 'create', 'driver', 'Marcus Chen', '{"vehicle": "Honda Civic 2022"}', NOW() - INTERVAL '4 days'),
  ('freshmart@lvcourier.ca', 'business', 'create', 'delivery', 'WANRUAAJ', '{"pickup": "Shawnessy", "dropoff": "Calgary"}', NOW() - INTERVAL '3 days'),
  ('admin@lvcourier.ca', 'admin', 'assign', 'delivery', 'WANRUAAJ', '{"driver": "Marcus Chen"}', NOW() - INTERVAL '3 days'),
  ('driver@lvcourier.ca', 'driver', 'status_change', 'delivery', 'WANRUAAJ', '{"from": "claimed", "to": "picked_up"}', NOW() - INTERVAL '2 days'),
  ('driver@lvcourier.ca', 'driver', 'status_change', 'delivery', 'WANRUAAJ', '{"from": "picked_up", "to": "delivered"}', NOW() - INTERVAL '2 days'),
  ('admin@lvcourier.ca', 'admin', 'create', 'invoice', 'INV-2024-001', '{"amount": 45.50, "business": "FreshMart"}', NOW() - INTERVAL '1 day'),
  ('admin@lvcourier.ca', 'admin', 'send', 'invoice', 'INV-2024-001', '{"sent_to": "freshmart@lvcourier.ca"}', NOW() - INTERVAL '1 day'),
  ('admin@lvcourier.ca', 'admin', 'update', 'business', 'FreshMart', '{"field": "billing_email", "old": "old@email.com", "new": "freshmart@lvcourier.ca"}', NOW() - INTERVAL '12 hours'),
  ('admin@lvcourier.ca', 'admin', 'approve', 'store_request', 'Downtown Location', '{"business": "FreshMart", "type": "add"}', NOW() - INTERVAL '6 hours'),
  ('system', null, 'status_change', 'delivery', 'RWC3995A', '{"reason": "SLA timeout", "from": "posted", "to": "timeout"}', NOW() - INTERVAL '2 hours');
