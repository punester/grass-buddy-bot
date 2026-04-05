import React, { useState } from 'react';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useSettings } from '@/contexts/SettingsContext';

const Contact: React.FC = () => {
  const { publicEmail } = useSettings();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    setStatus('sending');
    try {
      const submissionId = crypto.randomUUID();
      
      // Send confirmation to submitter
      const { error: confirmError } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'contact-confirmation',
          recipientEmail: email.trim(),
          idempotencyKey: `contact-confirm-${submissionId}`,
          templateData: { name: name.trim() },
        },
      });

      if (confirmError) throw confirmError;

      // Send notification to admin
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'contact-admin-notification',
          recipientEmail: 'punit@110labs.com',
          idempotencyKey: `contact-admin-${submissionId}`,
          templateData: { name: name.trim(), email: email.trim(), message: message.trim() },
        },
      });
      setStatus('success');
    } catch (err) {
      console.error('Contact form error:', err);
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <NavBar />
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
          <div className="text-center px-6 max-w-md">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Thanks!</h2>
            <p className="text-muted-foreground">We'll get back to you within 1–2 business days.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <NavBar />
      <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
        <div className="w-full max-w-[560px] px-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Get in Touch</h1>
            <p className="text-muted-foreground">Questions, feedback, or lawn emergencies — we're here.</p>
          </div>

          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={100}
                    placeholder="Your name"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    maxLength={255}
                    placeholder="you@example.com"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    maxLength={2000}
                    placeholder="How can we help?"
                    rows={5}
                    className="mt-1.5"
                  />
                </div>

                {status === 'error' && (
                  <p className="text-sm text-destructive">
                    Something went wrong. Try emailing us directly at{' '}
                    <a href={`mailto:${publicEmail}`} className="underline">{publicEmail}</a>
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  {status === 'sending' ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>
                  ) : (
                    'Send Message'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Contact;
