import React, { useState } from 'react';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import AnimatedBackground from '@/components/AnimatedBackground';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useUserTier } from '@/hooks/useUserTier';
import { supabase } from '@/integrations/supabase/client';
import { Check, Droplets } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';

const Pricing = () => {
  const { user } = useAuth();
  const { annualPrice, monthlyPrice } = useSettings();
  const { isPaid } = useUserTier();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { returnUrl: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      console.error('Checkout error:', e);
    } finally {
      setLoading(false);
    }
  };

  const freeFeatures = [
    'ZIP code watering lookup',
    'Saved lawn profile',
    'Weekly email digest',
  ];

  const proFeatures = [
    'Everything in Free',
    'Daily SMS alerts (condition-triggered)',
    'Frost & dormancy alerts',
    'Multi-lawn support',
    '30-day watering history',
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatedBackground />
      <NavBar />
      <main className="flex-1 pt-28 pb-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-foreground mb-3">
              Choose Your Plan
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Start free, upgrade when you want smarter alerts and deeper insights.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {/* Free */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-xl">Free</CardTitle>
                <p className="text-3xl font-bold text-foreground">$0</p>
                <p className="text-sm text-muted-foreground">Forever</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {freeFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Pro */}
            <Card className="border-primary/50 ring-2 ring-primary/20 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
              </div>
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Droplets className="h-5 w-5 text-primary" />
                  Pro
                </CardTitle>
                <p className="text-3xl font-bold text-foreground">${annualPrice}<span className="text-base font-normal text-muted-foreground">/year</span></p>
                <p className="text-sm text-muted-foreground">~${monthlyPrice}/month</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {proFeatures.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isPaid ? (
                  <div className="text-center text-sm text-primary font-medium py-2">
                    ✓ You're on Pro
                  </div>
                ) : (
                  <button
                    onClick={user ? handleUpgrade : undefined}
                    disabled={loading || !user}
                    className="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Redirecting…' : user ? 'Upgrade to Pro' : 'Sign in to upgrade'}
                  </button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Callout */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 text-center mb-8">
            <p className="text-foreground font-medium">
              The average homeowner wastes 14,000+ gallons per year on unnecessary watering. ThirstyGrass Pro pays for itself.
            </p>
          </div>

          {/* Refund policy */}
          <p className="text-xs text-muted-foreground text-center">
            All sales are final. Subscriptions can be cancelled anytime from your{' '}
            <Link to="/dashboard" className="text-primary hover:underline">dashboard</Link>.
            Access continues through the end of your paid period.
            By subscribing you agree to our{' '}
            <Link to="/tos" className="text-primary hover:underline">Terms of Service</Link> and{' '}
            <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Pricing;
