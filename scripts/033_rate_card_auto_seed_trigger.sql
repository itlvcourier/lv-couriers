-- Trigger: auto-seed a default rate card whenever a new business_location is inserted
-- without one. Idempotent: skips if a rate card already exists for that location.
-- Matches FreshMart Shawnessy baseline (same as lib/billing.ts DEFAULT_RATE_CARD_VALUES).

CREATE OR REPLACE FUNCTION public.seed_default_rate_card_for_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.rate_cards WHERE location_id = NEW.id
  ) THEN
    INSERT INTO public.rate_cards (
      business_id,
      location_id,
      effective_date,
      rate_regular,
      rate_big_double,
      rate_oot_big,
      rate_rush,
      rate_rush_oot,
      gst_applicable,
      cancel_before_depart,
      cancel_en_route,
      notify_driver_assigned,
      notify_pickup_confirmed,
      notify_en_route,
      notify_delivered,
      notify_failed,
      notify_invoice_sent,
      notify_payment_reminder,
      notify_recipient_sms,
      contract_notes
    ) VALUES (
      NEW.business_id,
      NEW.id,
      CURRENT_DATE,
      9,   -- regular
      18,  -- 2+ big
      25,  -- 2+ big OOT
      20,  -- rush
      30,  -- rush + OOT
      TRUE,
      0,   -- cancel before depart
      5,   -- cancel en route
      TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
      'Auto-seeded default rate card; edit in Admin > Rate Cards.'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_business_locations_seed_rate_card ON public.business_locations;
CREATE TRIGGER trg_business_locations_seed_rate_card
AFTER INSERT ON public.business_locations
FOR EACH ROW EXECUTE FUNCTION public.seed_default_rate_card_for_location();

-- Backfill: any existing location without a rate card gets one now.
INSERT INTO public.rate_cards (
  business_id, location_id, effective_date,
  rate_regular, rate_big_double, rate_oot_big, rate_rush, rate_rush_oot,
  gst_applicable, cancel_before_depart, cancel_en_route,
  notify_driver_assigned, notify_pickup_confirmed, notify_en_route,
  notify_delivered, notify_failed, notify_invoice_sent, notify_payment_reminder, notify_recipient_sms,
  contract_notes
)
SELECT
  bl.business_id, bl.id, CURRENT_DATE,
  9, 18, 25, 20, 30,
  TRUE, 0, 5,
  TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE,
  'Auto-seeded default rate card; edit in Admin > Rate Cards.'
FROM public.business_locations bl
LEFT JOIN public.rate_cards rc ON rc.location_id = bl.id
WHERE rc.id IS NULL;
