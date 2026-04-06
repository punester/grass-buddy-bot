-- Re-add anon UPDATE policy for unsubscribe flow
-- The restrict_anon_profile_update trigger enforces that anon can ONLY change email_unsubscribed
CREATE POLICY "Anon can unsubscribe via link"
ON public.profiles
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);