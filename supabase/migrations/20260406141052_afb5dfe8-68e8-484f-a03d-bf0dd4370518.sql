
-- Create recommendation_history table
CREATE TABLE public.recommendation_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  recommendation text,
  alert_type text,
  deficit numeric,
  et_loss_7d numeric,
  rain_5d numeric,
  forecast_5d numeric,
  avg_high_7d numeric,
  forecast_low_5d numeric,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recommendation_history_user_date_key UNIQUE (user_id, date)
);

CREATE INDEX idx_recommendation_history_user_date ON public.recommendation_history (user_id, date DESC);

ALTER TABLE public.recommendation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recommendation history"
ON public.recommendation_history FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service role can insert recommendation history"
ON public.recommendation_history FOR INSERT TO public
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update recommendation history"
ON public.recommendation_history FOR UPDATE TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admin can view all recommendation history"
ON public.recommendation_history FOR SELECT TO authenticated
USING (public.is_admin());

-- Backfill from zip_lookup_log, filtering to existing profiles only
INSERT INTO public.recommendation_history (user_id, date, recommendation, source, created_at)
SELECT
  z.user_id,
  z.created_at::date AS date,
  z.recommendation,
  'manual' AS source,
  z.created_at
FROM public.zip_lookup_log z
INNER JOIN public.profiles p ON p.id = z.user_id
WHERE z.user_id IS NOT NULL
ON CONFLICT (user_id, date) DO NOTHING;
