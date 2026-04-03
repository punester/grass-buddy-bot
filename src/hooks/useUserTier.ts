import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface UserTier {
  tier: string;
  isPaid: boolean;
  isFree: boolean;
  isLoading: boolean;
}

export const useUserTier = (): UserTier => {
  const { user } = useAuth();
  const [tier, setTier] = useState<string>('free');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTier('free');
      setIsLoading(false);
      return;
    }

    const fetchTier = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('tier')
        .eq('id', user.id)
        .single();
      setTier(data?.tier ?? 'free');
      setIsLoading(false);
    };

    fetchTier();
  }, [user]);

  return {
    tier,
    isPaid: tier === 'paid',
    isFree: tier !== 'paid',
    isLoading,
  };
};
