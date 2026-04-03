import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import AnimatedBackground from '@/components/AnimatedBackground';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { supabase } from '@/integrations/supabase/client';
import { fetchPrecipitationData } from '@/utils/weatherApi';
import PrecipitationDisplay, { PrecipitationData } from '@/components/PrecipitationDisplay';
import LockedFeatureCard from '@/components/LockedFeatureCard';
import DashboardFeedback from '@/components/DashboardFeedback';
import SubscriptionManager from '@/components/SubscriptionManager';
import ReferralShareBlock from '@/components/ReferralShareBlock';
import { useUserTier } from '@/hooks/useUserTier';
import { useReferralInfo } from '@/hooks/useReferralInfo';
import { RefreshCw, Pencil, MapPin, Leaf, Droplets, Ruler, Timer, Gift, CreditCard } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Profile {
  zip_code: string | null;
  grass_type: string | null;
  irrigation_type: string | null;
  subscription_cancel_at_period_end: boolean;
  subscription_ends_at: string | null;
  lawn_size_acres: number | null;
}

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isFree, isPaid } = useUserTier();
  const { annualPrice } = useSettings();
  const { programActive, threshold, referralCode, referralCount, premiumSource, premiumUntil } = useReferralInfo();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [weatherData, setWeatherData] = useState<PrecipitationData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [error, setError] = useState('');
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  // Handle upgrade success return
  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      toast.success('Welcome to ThirstyGrass Pro 🌿');
      // Clean URL
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [authLoading, user, navigate]);

  const fetchProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('zip_code, grass_type, irrigation_type, subscription_cancel_at_period_end, subscription_ends_at, lawn_size_acres')
      .eq('id', user.id)
      .single();
    if (!data || !data.zip_code) {
      navigate('/onboarding');
      return;
    }
    setProfile(data);
  };

  useEffect(() => {
    if (!user) return;
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (profile?.zip_code) {
      loadWeather();
    }
  }, [profile?.zip_code]);

  const getGrassCategory = (grassType: string | null): string => {
    if (!grassType) return 'Mixed';
    if (grassType.includes('Cool-Season')) return 'Cool-Season';
    if (grassType.includes('Warm-Season')) return 'Warm-Season';
    return 'Mixed';
  };

  const loadWeather = async () => {
    if (!profile?.zip_code) return;
    setIsLoadingWeather(true);
    setError('');
    try {
      const data = await fetchPrecipitationData(
        profile.zip_code,
        getGrassCategory(profile.grass_type),
        user?.id ?? null
      );
      setWeatherData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load weather data');
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const handleUpgrade = async () => {
    if (!user) return;
    setUpgradeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { returnUrl: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      toast.error('Failed to start checkout');
      console.error(e);
    } finally {
      setUpgradeLoading(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatedBackground />
      <NavBar />
      <main className="flex-1 pt-28 pb-16">
        <div className="container mx-auto px-4 max-w-5xl">

          {/* Refresh button */}
          {weatherData && (
            <div className="flex justify-end mb-4">
              <button
                onClick={loadWeather}
                disabled={isLoadingWeather}
                className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingWeather ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          )}

          {/* Recommendation */}
          {weatherData ? (
            <PrecipitationDisplay data={weatherData} zipCode={profile?.zip_code || undefined} />
          ) : isLoadingWeather ? (
            <div className="bg-card rounded-2xl shadow-md border border-border p-10 mb-6 text-center">
              <RefreshCw className="h-8 w-8 text-primary animate-spin mx-auto mb-3" />
              <p className="text-muted-foreground">Loading your watering recommendation…</p>
            </div>
          ) : error ? (
            <div className="bg-card rounded-2xl shadow-md border border-destructive/30 p-6 mb-6 text-center">
              <p className="text-destructive font-medium mb-2">Unable to load weather data</p>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <button
                onClick={loadWeather}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : null}

          {/* How Long to Water */}
          {weatherData && (
            <div className="bg-card rounded-2xl shadow-md border border-border p-6 mt-6">
              <div className="flex items-center gap-2 mb-3">
                <Timer className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">How Long to Water</h2>
              </div>
              {weatherData.recommendation === 'WATER' && profile?.lawn_size_acres ? (
                (() => {
                  const lawnSqFt = profile.lawn_size_acres * 43560;
                  const gallonsNeeded = weatherData.deficit * lawnSqFt * 0.623;
                  const minutesToWater = Math.ceil(gallonsNeeded / 2);
                  return (
                    <div className="text-center py-4">
                      <p className="text-4xl font-bold text-primary">{minutesToWater} min</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Based on your {profile.lawn_size_acres} acre lawn at 2 GPM flow rate
                      </p>
                    </div>
                  );
                })()
              ) : weatherData.recommendation !== 'WATER' ? (
                <p className="text-sm text-muted-foreground">No watering needed today</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add your lawn size in your profile to see watering duration.{' '}
                  <button onClick={() => navigate('/onboarding')} className="text-primary hover:underline">
                    Update profile
                  </button>
                </p>
              )}
            </div>
          )}

          {/* Daily SMS Alerts — gated */}
          {isFree ? (
            <LockedFeatureCard
              icon="🔒"
              headline="Daily SMS Alerts"
              body="Get a text only when your lawn needs attention — rain incoming, watering day, or season change."
              className="mt-8"
            />
          ) : (
            <div className="bg-card rounded-2xl shadow-md border border-border p-6 mt-8">
              <h2 className="text-lg font-semibold text-foreground mb-2">📱 Daily SMS Alerts</h2>
              <p className="text-sm text-muted-foreground">SMS alerts are active. You'll receive texts when your lawn needs attention.</p>
            </div>
          )}

          {/* 30-Day History — gated */}
          {isFree ? (
            <LockedFeatureCard
              icon="🔒"
              headline="30-Day Watering History"
              body="See how your lawn's water needs have changed over the past month."
              className="mt-6"
            />
          ) : (
            <div className="bg-card rounded-2xl shadow-md border border-border p-6 mt-6">
              <h2 className="text-lg font-semibold text-foreground mb-2">📊 30-Day Watering History</h2>
              <p className="text-sm text-muted-foreground">Your watering history chart will appear here.</p>
            </div>
          )}

          {/* Lawn Profile Summary */}
          {profile && (
            <div className="bg-card rounded-2xl shadow-md border border-border p-6 mt-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground">Your Lawn Profile</h2>
                  {isFree && (
                    <Badge variant="secondary" className="text-xs">Free Plan</Badge>
                  )}
                  {isPaid && (
                    <Badge className="text-xs bg-primary/90">Pro</Badge>
                  )}
                </div>
                <button
                  onClick={() => navigate('/onboarding')}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">ZIP Code</p>
                    <p className="text-sm font-medium text-foreground">{profile.zip_code || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Leaf className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Grass Type</p>
                    <p className="text-sm font-medium text-foreground">{profile.grass_type || 'Not set'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Droplets className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Irrigation</p>
                    <p className="text-sm font-medium text-foreground">{profile.irrigation_type || 'Not set'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <Ruler className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Lawn Size</p>
                    <p className="text-sm font-medium text-foreground">{profile.lawn_size_acres ? `${profile.lawn_size_acres} acres` : 'Not set'}</p>
                  </div>
                </div>
              </div>

              {/* Upgrade CTA for free users */}
              {isFree && (
                <div className="mt-5 pt-5 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>🔒</span>
                    <span className="text-sm">Multiple lawns available on paid plan</span>
                  </div>
                  <button
                    onClick={handleUpgrade}
                    disabled={upgradeLoading}
                    className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
                  >
                    {upgradeLoading ? 'Loading…' : `Unlock for $${annualPrice}/year`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Subscription management for paid users */}
          {isPaid && profile && (
            <SubscriptionManager
              subscriptionCancelAtPeriodEnd={profile.subscription_cancel_at_period_end}
              subscriptionEndsAt={profile.subscription_ends_at}
              onUpdate={fetchProfile}
            />
          )}

          {/* User Feedback */}
          <DashboardFeedback profile={profile} weatherData={weatherData} />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
