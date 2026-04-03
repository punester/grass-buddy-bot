import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import AnimatedBackground from '@/components/AnimatedBackground';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('user_id');
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'invalid'>('loading');

  useEffect(() => {
    if (!userId) {
      setStatus('invalid');
      return;
    }

    const unsubscribe = async () => {
      const { error } = await supabase
        .from('profiles')
        .update({ email_unsubscribed: true } as any)
        .eq('id', userId);

      if (error) {
        console.error('Unsubscribe error:', error);
        setStatus('error');
      } else {
        setStatus('success');
      }
    };

    unsubscribe();
  }, [userId]);

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatedBackground />
      <NavBar />
      <main className="flex-1 pt-28 pb-16 flex items-center justify-center">
        <div className="container mx-auto px-4 max-w-md text-center">
          {status === 'loading' && (
            <div>
              <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Processing your request…</p>
            </div>
          )}
          {status === 'success' && (
            <div>
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-foreground mb-2">Unsubscribed</h1>
              <p className="text-muted-foreground">
                You've been removed from the weekly watering digest. You can re-subscribe anytime from your dashboard.
              </p>
            </div>
          )}
          {status === 'error' && (
            <div>
              <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>
              <p className="text-muted-foreground">
                We couldn't process your unsubscribe request. Please try again or contact support.
              </p>
            </div>
          )}
          {status === 'invalid' && (
            <div>
              <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-foreground mb-2">Invalid Link</h1>
              <p className="text-muted-foreground">
                This unsubscribe link appears to be invalid. Please check your email and try again.
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Unsubscribe;
