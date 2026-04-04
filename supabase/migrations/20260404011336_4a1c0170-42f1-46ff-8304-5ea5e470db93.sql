ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_seasonal_alert_sent text,
ADD COLUMN IF NOT EXISTS last_seasonal_alert_date date;