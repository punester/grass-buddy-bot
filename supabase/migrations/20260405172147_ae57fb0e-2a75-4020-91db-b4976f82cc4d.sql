
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT (auth.jwt() ->> 'email') IN ('punit@110labs.com', 'pun279@gmail.com')
$$;
