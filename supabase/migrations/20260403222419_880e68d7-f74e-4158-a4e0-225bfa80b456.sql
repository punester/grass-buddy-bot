
ALTER TABLE public.zip_cache
  ADD COLUMN IF NOT EXISTS recommendation text,
  ADD COLUMN IF NOT EXISTS recommendation_reason text,
  ADD COLUMN IF NOT EXISTS rain_5d numeric,
  ADD COLUMN IF NOT EXISTS forecast_5d numeric,
  ADD COLUMN IF NOT EXISTS et_loss_7d numeric,
  ADD COLUMN IF NOT EXISTS deficit numeric,
  ADD COLUMN IF NOT EXISTS last_updated timestamptz DEFAULT now();
