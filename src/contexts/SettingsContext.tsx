import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SettingsContextType {
  annualPrice: number;
  monthlyPrice: string;
  publicEmail: string;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  annualPrice: 24,
  monthlyPrice: '2',
  publicEmail: 'hello@thirstygrass.com',
  isLoading: true,
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [annualPrice, setAnnualPrice] = useState(24);
  const [publicEmail, setPublicEmail] = useState('hello@thirstygrass.com');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['annual_price_usd', 'public_contact_email']);
      if (data) {
        for (const row of data) {
          if (row.key === 'annual_price_usd') setAnnualPrice(Number(row.value));
          if (row.key === 'public_contact_email') setPublicEmail(row.value);
        }
      }
      setIsLoading(false);
    };
    fetchSettings();
  }, []);

  const monthlyPrice = (annualPrice / 12).toFixed(0);

  return (
    <SettingsContext.Provider value={{ annualPrice, monthlyPrice, publicEmail, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};
