import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SettingsContextType {
  annualPrice: number;
  monthlyPrice: string;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  annualPrice: 24,
  monthlyPrice: '2',
  isLoading: true,
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [annualPrice, setAnnualPrice] = useState(24);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'annual_price_usd')
        .single();
      if (data?.value) {
        setAnnualPrice(Number(data.value));
      }
      setIsLoading(false);
    };
    fetchSettings();
  }, []);

  const monthlyPrice = (annualPrice / 12).toFixed(0);

  return (
    <SettingsContext.Provider value={{ annualPrice, monthlyPrice, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};
