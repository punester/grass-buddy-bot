
-- 1. Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS premium_until timestamptz,
  ADD COLUMN IF NOT EXISTS premium_source text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text;

-- Generate referral codes for existing rows that don't have one
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result text := 'tg_';
  i integer;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Backfill existing profiles
UPDATE public.profiles SET referral_code = public.generate_referral_code() WHERE referral_code IS NULL;

-- Now add constraints
ALTER TABLE public.profiles ALTER COLUMN referral_code SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN referral_code SET DEFAULT public.generate_referral_code();
ALTER TABLE public.profiles ADD CONSTRAINT profiles_referral_code_unique UNIQUE (referral_code);

-- 2. Trigger to auto-generate unique referral_code on insert
CREATE OR REPLACE FUNCTION public.set_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
  retries integer := 0;
BEGIN
  IF NEW.referral_code IS NOT NULL AND NEW.referral_code <> '' THEN
    RETURN NEW;
  END IF;
  LOOP
    new_code := public.generate_referral_code();
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = new_code) THEN
      NEW.referral_code := new_code;
      RETURN NEW;
    END IF;
    retries := retries + 1;
    IF retries > 10 THEN
      RAISE EXCEPTION 'Could not generate unique referral code after 10 attempts';
    END IF;
  END LOOP;
END;
$$;

CREATE TRIGGER set_referral_code_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_referral_code();

-- 3. Create referrals table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id),
  referred_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  fraud_suspected boolean NOT NULL DEFAULT false,
  fraud_evidence jsonb,
  counted boolean NOT NULL DEFAULT true
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can select all referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'email') = 'admin@110labs.com');

CREATE POLICY "Admin can update all referrals"
  ON public.referrals FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'admin@110labs.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'admin@110labs.com');

CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_id = auth.uid());

CREATE POLICY "Service role can insert referrals"
  ON public.referrals FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

-- 4. Seed app_settings with referral config (table already exists)
INSERT INTO public.app_settings (key, value)
VALUES
  ('referral_program_active', 'true'),
  ('referral_threshold', '2'),
  ('referral_offer_expires', '2026-12-31')
ON CONFLICT (key) DO NOTHING;

-- 5. Auto-upgrade function (called from edge function, not a trigger)
CREATE OR REPLACE FUNCTION public.check_and_upgrade_referrer(p_referrer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_threshold integer;
  v_active boolean;
  v_current_source text;
  v_current_until timestamptz;
BEGIN
  -- Check if program is active
  SELECT value::boolean INTO v_active FROM public.app_settings WHERE key = 'referral_program_active';
  IF NOT v_active THEN RETURN false; END IF;

  -- Get threshold
  SELECT value::integer INTO v_threshold FROM public.app_settings WHERE key = 'referral_threshold';

  -- Count valid referrals
  SELECT count(*) INTO v_count FROM public.referrals
    WHERE referrer_id = p_referrer_id AND counted = true AND fraud_suspected = false;

  IF v_count < v_threshold THEN RETURN false; END IF;

  -- Check current premium status
  SELECT premium_source, premium_until INTO v_current_source, v_current_until
    FROM public.profiles WHERE id = p_referrer_id;

  -- Don't override stripe or active premium
  IF v_current_source = 'stripe' THEN RETURN false; END IF;
  IF v_current_until IS NOT NULL AND v_current_until > now() THEN RETURN false; END IF;

  -- Upgrade
  UPDATE public.profiles SET
    tier = 'paid',
    premium_source = 'referral',
    premium_until = now() + interval '1 year'
  WHERE id = p_referrer_id;

  RETURN true;
END;
$$;
