import React, { useEffect, useState } from 'react';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type Status = 'loading' | 'valid' | 'already' | 'invalid' | 'confirming' | 'done' | 'error';

const EmailUnsubscribe: React.FC = () => {
  const [status, setStatus] = useState<Status>('loading');
  const token = new URLSearchParams(window.location.search).get('token');

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } }
        );
        const data = await res.json();
        if (!res.ok) { setStatus('invalid'); return; }
        setStatus(data.valid === false && data.reason === 'already_unsubscribed' ? 'already' : 'valid');
      } catch { setStatus('error'); }
    })();
  }, [token]);

  const handleConfirm = async () => {
    setStatus('confirming');
    try {
      const { error } = await supabase.functions.invoke('handle-email-unsubscribe', {
        body: { token },
      });
      if (error) throw error;
      setStatus('done');
    } catch { setStatus('error'); }
  };

  const content: Record<Status, React.ReactNode> = {
    loading: <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />,
    valid: (
      <div className="text-center">
        <p className="text-muted-foreground mb-4">Click below to unsubscribe from ThirstyGrass emails.</p>
        <Button onClick={handleConfirm} variant="destructive">Confirm Unsubscribe</Button>
      </div>
    ),
    confirming: <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto" />,
    already: (
      <div className="text-center">
        <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
        <p className="text-muted-foreground">You're already unsubscribed.</p>
      </div>
    ),
    done: (
      <div className="text-center">
        <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
        <p className="text-foreground font-semibold mb-1">Unsubscribed</p>
        <p className="text-muted-foreground">You won't receive any more emails from us.</p>
      </div>
    ),
    invalid: (
      <div className="text-center">
        <XCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
        <p className="text-muted-foreground">This unsubscribe link is invalid or expired.</p>
      </div>
    ),
    error: (
      <div className="text-center">
        <XCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
        <p className="text-muted-foreground">Something went wrong. Please try again later.</p>
      </div>
    ),
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NavBar />
      <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
        <Card className="max-w-md w-full mx-6">
          <CardContent className="p-8">{content[status]}</CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default EmailUnsubscribe;
