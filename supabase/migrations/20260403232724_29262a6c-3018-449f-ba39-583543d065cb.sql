CREATE POLICY "Admin can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING ((auth.jwt() ->> 'email'::text) = 'admin@110labs.com'::text);