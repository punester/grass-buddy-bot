-- Allow anonymous users to update email_unsubscribed via unsubscribe links
CREATE POLICY "Anyone can unsubscribe via link"
ON public.profiles
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Restrict the update to only the email_unsubscribed column via a trigger
CREATE OR REPLACE FUNCTION public.restrict_anon_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- For anon role, only allow changing email_unsubscribed
  IF current_setting('request.jwt.claims', true)::json->>'role' = 'anon' THEN
    NEW.email := OLD.email;
    NEW.zip_code := OLD.zip_code;
    NEW.grass_type := OLD.grass_type;
    NEW.irrigation_type := OLD.irrigation_type;
    NEW.tier := OLD.tier;
    NEW.created_at := OLD.created_at;
    NEW.id := OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER restrict_anon_profile_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.restrict_anon_profile_update();