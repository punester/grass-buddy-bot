import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import AnimatedBackground from '@/components/AnimatedBackground';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { fetchPrecipitationData } from '@/utils/weatherApi';
import PrecipitationDisplay, { PrecipitationData } from '@/components/PrecipitationDisplay';
import { RefreshCw, Pencil, MapPin, Leaf, Droplets } from 'lucide-react';

interface Profile {
  zip_code: string | null;
  grass_type: string | null;
  irrigation_type: string | null;
}

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [weatherData, setWeatherData] = useState<PrecipitationData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('zip_code, grass_type, irrigation_type')
        .eq('id', user.id)
        .single();
      if (!data || !data.zip_code) {
        navigate('/onboarding');
        return;
      }
      setProfile(data);
    };
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

          {/* Recommendation — reuse homepage component */}
          {weatherData ? (
            <PrecipitationDisplay data={weatherData} />
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

          {/* Lawn Profile Summary — below the result */}
          {profile && (
            <div className="bg-card rounded-2xl shadow-md border border-border p-6 mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Your Lawn Profile</h2>
                <button
                  onClick={() => navigate('/onboarding')}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
