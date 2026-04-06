import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const ShortLinkRedirect = () => {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    if (!code) {
      window.location.href = 'https://thirstygrass.com';
      return;
    }

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const redirectUrl = `https://${projectId}.supabase.co/functions/v1/redirect/${code}`;
    window.location.href = redirectUrl;
  }, [code]);

  return null;
};

export default ShortLinkRedirect;
