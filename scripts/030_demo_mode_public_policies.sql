-- Demo-mode RLS policies
-- App uses mock-user login (not Supabase Auth), so admin/driver/business policies
-- that rely on is_admin() / auth.uid() block the anon client.
-- This migration adds permissive anon/authenticated read+write policies so the
-- demo works end-to-end. Tighten these when real Supabase Auth is wired in.

DO $$
DECLARE
  tbl TEXT;
  demo_tables TEXT[] := ARRAY[
    'activity_log',
    'admin_notifications',
    'business_locations',
    'businesses',
    'deliveries',
    'delivery_flags',
    'driver_locations',
    'drivers',
    'invoice_disputes',
    'invoice_line_items',
    'invoices',
    'manifest_items',
    'pickup_verifications',
    'rate_cards',
    'sms_log',
    'status_history',
    'system_settings',
    'trips'
  ];
BEGIN
  FOREACH tbl IN ARRAY demo_tables LOOP
    -- Drop previous demo policies if any
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_demo_all', tbl);

    -- Permissive demo policy: any role (anon + authenticated) can do anything
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
      tbl || '_demo_all',
      tbl
    );
  END LOOP;
END $$;
