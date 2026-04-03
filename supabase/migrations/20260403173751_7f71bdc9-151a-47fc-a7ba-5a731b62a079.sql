
-- Create admin_settings table
CREATE TABLE public.admin_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admin can select admin_settings"
  ON public.admin_settings FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = 'admin@110labs.com'::text);

CREATE POLICY "Admin can insert admin_settings"
  ON public.admin_settings FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email'::text) = 'admin@110labs.com'::text);

CREATE POLICY "Admin can update admin_settings"
  ON public.admin_settings FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = 'admin@110labs.com'::text)
  WITH CHECK ((auth.jwt() ->> 'email'::text) = 'admin@110labs.com'::text);

CREATE POLICY "Admin can delete admin_settings"
  ON public.admin_settings FOR DELETE
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = 'admin@110labs.com'::text);

-- Seed default values
INSERT INTO public.admin_settings (key, value, description) VALUES
  ('saturation_guard_inches', '0.5', 'Rain in past 3 days (inches) that triggers SKIP override'),
  ('saturation_guard_days', '3', 'Lookback window in days for saturation guard'),
  ('water_threshold', '0.25', 'Deficit above this → WATER'),
  ('monitor_threshold', '0.05', 'Deficit above this → MONITOR'),
  ('cool_season_multiplier', '1.25', 'ET multiplier for cool-season grasses'),
  ('warm_season_multiplier', '0.75', 'ET multiplier for warm-season grasses'),
  ('mixed_multiplier', '1.0', 'ET multiplier for mixed/unknown grass');
