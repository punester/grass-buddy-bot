import React, { useState, useEffect } from 'react';
import WateringHistoryChart from '@/components/WateringHistoryChart';
import DummyWaterBalanceChart from '@/components/DummyWaterBalanceChart';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import AnimatedBackground from '@/components/AnimatedBackground';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { fetchPrecipitationData } from '@/utils/weatherApi';
import PrecipitationDisplay, { PrecipitationData } from '@/components/PrecipitationDisplay';
import LockedFeatureCard from '@/components/LockedFeatureCard';
import DashboardFeedback from '@/components/DashboardFeedback';
import ReferralShareBlock from '@/components/ReferralShareBlock';
import NotificationsCard from '@/components/NotificationsCard';
import { useUserTier } from '@/hooks/useUserTier';
import { useReferralInfo } from '@/hooks/useReferralInfo';
import { RefreshCw, Pencil, MapPin, Leaf, Droplets, Ruler } from 'lucide-react';
import { toast } from 'sonner';

interface Profile {
  zip_code: string | null;
  grass_type: string | null;
  irrigation_type: string | null;
  lawn_size_acres: number | null;
}

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isFree, isPaid } = useUserTier();
  const { programActive, threshold, referralCode, referralCount, premiumSource, premiumUntil } = useReferralInfo();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [weatherData, setWeatherData] = useState<PrecipitationData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      // Verify checkout with Stripe and upgrade profile
      const verify = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('verify-checkout');
          if (error) {
            console.error('Verify checkout error:', error);
          } else if (data?.upgraded) {
            toast.success('Welcome to ThirstyGrass Pro 🌿');
          }
        } catch (e) {
          console.error('Verify checkout failed:', e);
        }
        window.history.replaceState({}, '', '/dashboard');
        // Reload to pick up new tier
        window.location.reload();
      };
      verify();
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
      .select('zip_code, grass_type, irrigation_type, lawn_size_acres')
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

  if (authLoading) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatedBackground />
      <NavBar />
      <main className="flex-1 pt-28 pb-16">
        <div className="container mx-auto px-4 max-w-xl">

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

          {/* ZONE 1 — Recommendation */}
          {weatherData ? (
            <PrecipitationDisplay
              data={weatherData}
              zipCode={profile?.zip_code || undefined}
              lawnSizeAcres={profile?.lawn_size_acres}
              isPaid={isPaid}
            />
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

          {/* 30-Day History — gated */}
          {isFree ? (
            <LockedFeatureCard
              icon="📊"
              headline="30-Day Watering History"
              body="See how your lawn's water needs have changed over the past month."
              className="mt-6"
            >
              <DummyWaterBalanceChart />
            </LockedFeatureCard>
          ) : (
            <WateringHistoryChart />
          )}

          {/* ZONE 2 — Notifications */}
          <NotificationsCard />

          {/* ZONE 3 — Your Lawn */}
          {profile && (
            <div className="bg-card rounded-2xl shadow-md border border-border p-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Your Lawn</h2>
                <button
                  onClick={() => navigate('/onboarding')}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">ZIP Code</p>
                    <p className="text-sm font-medium text-foreground">{profile.zip_code || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Grass Type</p>
                    <p className="text-sm font-medium text-foreground">{profile.grass_type || 'Not set'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Irrigation</p>
                    <p className="text-sm font-medium text-foreground">{profile.irrigation_type || 'Not set'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Ruler className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Lawn Size</p>
                    <p className="text-sm font-medium text-foreground">{profile.lawn_size_acres ? `${profile.lawn_size_acres} ac` : 'Not set'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ZONE 4 — Referral (reduced weight) */}
          {programActive && (
            <div className="bg-card rounded-xl border border-border/50 p-5 mt-6">
              <h3 className="text-sm font-semibold text-foreground mb-1">Refer a Friend, Earn a Free Year</h3>
              <p className="text-xs text-muted-foreground mb-3">
                When {threshold} friends sign up, you get one year of premium free.
              </p>
              {premiumSource === 'referral' && premiumUntil && new Date(premiumUntil) > new Date() ? (
                <p className="text-xs text-foreground">
                  🎉 Free year active through {new Date(premiumUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
                </p>
              ) : referralCode ? (
                <ReferralShareBlock
                  referralCode={referralCode}
                  referralCount={referralCount}
                  threshold={threshold}
                />
              ) : null}
              <Link to="/referrals" className="text-xs text-primary hover:underline mt-2 inline-block">
                Learn more →
              </Link>
            </div>
          )}

          {/* Feedback */}
          <DashboardFeedback profile={profile} weatherData={weatherData} />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
