import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ReferralInfo {
  programActive: boolean;
  threshold: number;
  offerExpires: string;
  referralCode: string | null;
  referralCount: number;
  premiumSource: string | null;
  premiumUntil: string | null;
  isLoading: boolean;
}

export const useReferralInfo = (): ReferralInfo => {
  const { user } = useAuth();
  const [programActive, setProgramActive] = useState(false);
  const [threshold, setThreshold] = useState(2);
  const [offerExpires, setOfferExpires] = useState('2026-12-31');
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [premiumSource, setPremiumSource] = useState<string | null>(null);
  const [premiumUntil, setPremiumUntil] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Load app_settings
      const { data: settings } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['referral_program_active', 'referral_threshold', 'referral_offer_expires']);

      if (settings) {
        for (const s of settings) {
          if (s.key === 'referral_program_active') setProgramActive(s.value === 'true');
          if (s.key === 'referral_threshold') setThreshold(Number(s.value));
          if (s.key === 'referral_offer_expires') setOfferExpires(s.value);
        }
      }

      // Load user-specific data
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('referral_code, premium_source, premium_until')
          .eq('id', user.id)
          .single();

        if (profile) {
          setReferralCode(profile.referral_code);
          setPremiumSource(profile.premium_source);
          setPremiumUntil(profile.premium_until);
        }

        const { data: referrals } = await supabase
          .from('referrals')
          .select('id')
          .eq('referrer_id', user.id)
          .eq('counted', true)
          .eq('fraud_suspected', false);

        setReferralCount(referrals?.length ?? 0);
      }

      setIsLoading(false);
    };
    load();
  }, [user]);

  return { programActive, threshold, offerExpires, referralCode, referralCount, premiumSource, premiumUntil, isLoading };
};
