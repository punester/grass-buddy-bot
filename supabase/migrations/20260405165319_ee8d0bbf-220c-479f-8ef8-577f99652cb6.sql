
-- Create a reusable admin check function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() ->> 'email') IN ('admin@110labs.com', 'pun279@gmail.com')
$$;

-- admin_settings policies
DROP POLICY IF EXISTS "Admin can delete admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admin can insert admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admin can select admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admin can update admin_settings" ON public.admin_settings;

CREATE POLICY "Admin can delete admin_settings" ON public.admin_settings FOR DELETE TO authenticated USING (public.is_admin());
CREATE POLICY "Admin can insert admin_settings" ON public.admin_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin can select admin_settings" ON public.admin_settings FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admin can update admin_settings" ON public.admin_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- app_settings admin policies
DROP POLICY IF EXISTS "Admin can insert settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admin can update settings" ON public.app_settings;

CREATE POLICY "Admin can insert settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin can update settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- profiles admin policies
DROP POLICY IF EXISTS "Admin can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;

CREATE POLICY "Admin can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());
CREATE POLICY "Admin can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin());

-- referrals admin policies
DROP POLICY IF EXISTS "Admin can select all referrals" ON public.referrals;
DROP POLICY IF EXISTS "Admin can update all referrals" ON public.referrals;

CREATE POLICY "Admin can select all referrals" ON public.referrals FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admin can update all referrals" ON public.referrals FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- zip_cache admin policy
DROP POLICY IF EXISTS "Admin can manage cache" ON public.zip_cache;
CREATE POLICY "Admin can manage cache" ON public.zip_cache FOR DELETE TO authenticated USING (public.is_admin());

-- zip_lookup_log admin policy
DROP POLICY IF EXISTS "Admin can view all lookup logs" ON public.zip_lookup_log;
CREATE POLICY "Admin can view all lookup logs" ON public.zip_lookup_log FOR SELECT TO authenticated USING (public.is_admin());

-- email_send_log admin policy
DROP POLICY IF EXISTS "Admin can read email_send_log" ON public.email_send_log;
CREATE POLICY "Admin can read email_send_log" ON public.email_send_log FOR SELECT TO authenticated USING (public.is_admin());
