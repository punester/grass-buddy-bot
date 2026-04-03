
-- Add Stripe columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz;

-- Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings
CREATE POLICY "Anyone can read settings"
  ON public.app_settings FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only admin can update settings
CREATE POLICY "Admin can update settings"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'admin@110labs.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'admin@110labs.com');

-- Only admin can insert settings
CREATE POLICY "Admin can insert settings"
  ON public.app_settings FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'admin@110labs.com');

-- Seed default price
INSERT INTO public.app_settings (key, value)
VALUES ('annual_price_usd', '24')
ON CONFLICT (key) DO NOTHING;
