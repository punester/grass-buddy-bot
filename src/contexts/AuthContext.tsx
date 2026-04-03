import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN' && newSession?.user) {
          const currentPath = window.location.pathname;
          if (currentPath === '/admin' || currentPath === '/onboarding') {
            return;
          }
          setTimeout(async () => {
            const { data: profile } = await supabase
              .from('profiles')
              .select('zip_code')
              .eq('id', newSession.user.id)
              .single();

            if (!profile || !profile.zip_code) {
              // Try to sync zip_code from user metadata
              const metaZip = newSession.user.user_metadata?.zip_code;
              if (metaZip && profile) {
                await supabase
                  .from('profiles')
                  .update({ zip_code: metaZip })
                  .eq('id', newSession.user.id);
                // ZIP synced, stay on current page or go to dashboard
                if (currentPath !== '/dashboard') {
                  navigate('/dashboard');
                }
              } else {
                navigate('/onboarding');
              }
            }
            // If zip_code exists, stay on current page
          }, 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
