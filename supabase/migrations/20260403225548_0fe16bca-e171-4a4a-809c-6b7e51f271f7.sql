CREATE POLICY "Admin can read email_send_log"
ON public.email_send_log
FOR SELECT
TO authenticated
USING ((auth.jwt() ->> 'email'::text) = 'admin@110labs.com'::text);