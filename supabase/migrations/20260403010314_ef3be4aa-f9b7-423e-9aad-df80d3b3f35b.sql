-- Create zip_lookup_log table
CREATE TABLE public.zip_lookup_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zip_code TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.zip_lookup_log ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (no policy needed, service role bypasses RLS)
-- Admin can SELECT all rows
CREATE POLICY "Admin can view all lookup logs"
  ON public.zip_lookup_log
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'admin@110labs.com');

-- Create zip_cache table
CREATE TABLE public.zip_cache (
  zip_code TEXT PRIMARY KEY,
  weather_data JSONB NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  lookup_count INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.zip_cache ENABLE ROW LEVEL SECURITY;

-- Anyone (authenticated or anon) can SELECT from cache
CREATE POLICY "Anyone can read cache"
  ON public.zip_cache
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- For inserts/updates to zip_cache and inserts to zip_lookup_log from client,
-- we need a security definer function since service role isn't available client-side.

-- Function to log a zip lookup
CREATE OR REPLACE FUNCTION public.log_zip_lookup(
  p_zip_code TEXT,
  p_recommendation TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.zip_lookup_log (zip_code, recommendation, user_id)
  VALUES (p_zip_code, p_recommendation, p_user_id);
END;
$$;

-- Function to upsert zip cache
CREATE OR REPLACE FUNCTION public.upsert_zip_cache(
  p_zip_code TEXT,
  p_weather_data JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.zip_cache (zip_code, weather_data, cached_at, lookup_count)
  VALUES (p_zip_code, p_weather_data, now(), 1)
  ON CONFLICT (zip_code)
  DO UPDATE SET weather_data = p_weather_data, cached_at = now(), lookup_count = 1;
END;
$$;

-- Function to increment cache lookup count
CREATE OR REPLACE FUNCTION public.increment_cache_lookup(p_zip_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.zip_cache SET lookup_count = lookup_count + 1 WHERE zip_code = p_zip_code;
END;
$$;

-- Admin policies for zip_cache management
CREATE POLICY "Admin can manage cache"
  ON public.zip_cache
  FOR DELETE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'admin@110labs.com');

-- Admin can also read profiles
CREATE POLICY "Admin can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'admin@110labs.com');

-- Admin can update any profile (for tier changes)
CREATE POLICY "Admin can update all profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'admin@110labs.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'admin@110labs.com');