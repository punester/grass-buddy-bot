-- Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS sms_phone text,
  ADD COLUMN IF NOT EXISTS sms_opted_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_recommendation text;

-- Create sms_logs table
CREATE TABLE public.sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_body text NOT NULL,
  alert_type text NOT NULL,
  status text NOT NULL,
  twilio_sid text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sms logs"
  ON public.sms_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert sms logs"
  ON public.sms_logs FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Service role can update sms logs"
  ON public.sms_logs FOR UPDATE
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE POLICY "Admin can view all sms logs"
  ON public.sms_logs FOR SELECT
  TO authenticated
  USING (is_admin());

-- Create short_links table
CREATE TABLE public.short_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  destination_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

-- No RLS on short_links — service role only access
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage short links"
  ON public.short_links FOR ALL
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);