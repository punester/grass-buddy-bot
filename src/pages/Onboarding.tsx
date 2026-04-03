import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import AnimatedBackground from '@/components/AnimatedBackground';
import { DropletIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const GRASS_TYPES = [
  'Not Sure',
  'Cool-Season (Fescue, Bluegrass, Rye)',
  'Warm-Season (Bermuda, Zoysia, St. Augustine)',
  'Mixed',
];

const IRRIGATION_TYPES = [
  'Not Sure',
  'Sprinkler System',
  'Drip Irrigation',
  'Hose / Manual',
  'None',
];

const Onboarding = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [zipCode, setZipCode] = useState(user?.user_metadata?.zip_code || '');
  const [grassType, setGrassType] = useState('');
  const [irrigationType, setIrrigationType] = useState('');
  const [lawnSize, setLawnSize] = useState('');
  const [zipError, setZipError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [loading, user, navigate]);

  const validateZip = (value: string) => {
    if (!value.trim()) return 'ZIP Code is required';
    if (!/^\d{5}$/.test(value.trim())) return 'Enter a valid 5-digit ZIP Code';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateZip(zipCode);
    if (error) {
      setZipError(error);
      return;
    }
    if (!agreedToTerms) {
      toast.error('Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    if (!user) return;

    setIsSubmitting(true);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        zip_code: zipCode.trim(),
        grass_type: grassType || null,
        irrigation_type: irrigationType || null,
        lawn_size_acres: lawnSize ? parseFloat(lawnSize) : null,
      } as any)
      .eq('id', user.id);

    setIsSubmitting(false);

    if (updateError) {
      toast.error('Something went wrong. Please try again.');
      console.error('Profile update error:', updateError);
    } else {
      navigate('/dashboard');
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatedBackground />
      <NavBar />
      <main className="flex-1 pt-32 pb-16 flex items-start justify-center">
        <div className="w-full max-w-[480px] mx-4">
          <div className="bg-card rounded-2xl shadow-md border border-border p-8">
            <div className="flex justify-center mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <DropletIcon className="h-6 w-6 text-primary" />
              </div>
            </div>

            <h1 className="text-2xl font-bold text-foreground text-center mb-2">
              Set Up Your Lawn
            </h1>
            <p className="text-muted-foreground text-center mb-8">
              Takes 30 seconds. Helps us give you accurate recommendations.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* ZIP Code */}
              <div>
                <label htmlFor="zip" className="block text-sm font-medium text-foreground mb-1.5">
                  Your ZIP Code <span className="text-destructive">*</span>
                </label>
                <input
                  id="zip"
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  required
                  value={zipCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setZipCode(val);
                    if (zipError) setZipError('');
                  }}
                  placeholder="e.g. 01545"
                  className={`w-full px-4 py-2.5 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all ${
                    zipError ? 'border-destructive' : 'border-input'
                  }`}
                />
                {zipError && (
                  <p className="text-sm text-destructive mt-1">{zipError}</p>
                )}
              </div>

              {/* Grass Type */}
              <div>
                <label htmlFor="grass" className="block text-sm font-medium text-foreground mb-1.5">
                  Grass Type
                </label>
                <select
                  id="grass"
                  value={grassType}
                  onChange={(e) => setGrassType(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                >
                  <option value="">Select grass type (optional)</option>
                  {GRASS_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Irrigation Type */}
              <div>
                <label htmlFor="irrigation" className="block text-sm font-medium text-foreground mb-1.5">
                  Irrigation Type
                </label>
                <select
                  id="irrigation"
                  value={irrigationType}
                  onChange={(e) => setIrrigationType(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                >
                  <option value="">Select irrigation type (optional)</option>
                  {IRRIGATION_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
              </select>
              </div>

              {/* Lawn Size */}
              <div>
                <label htmlFor="lawnSize" className="block text-sm font-medium text-foreground mb-1.5">
                  Lawn Size (acres)
                </label>
                <input
                  id="lawnSize"
                  type="number"
                  step="0.01"
                  min="0"
                  value={lawnSize}
                  onChange={(e) => setLawnSize(e.target.value)}
                  placeholder="e.g. 0.25"
                  className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                <p className="text-xs text-muted-foreground mt-1">Used to calculate how long to run your sprinklers</p>
              </div>

              {/* Terms checkbox */}
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary/50"
                />
                <label htmlFor="terms" className="text-sm text-muted-foreground">
                  I agree to the{' '}
                  <Link to="/tos" className="text-primary hover:underline" target="_blank">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="text-primary hover:underline" target="_blank">Privacy Policy</Link>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-all duration-200 disabled:opacity-50 transform hover:translate-y-[-1px] hover:shadow-md"
              >
                {isSubmitting ? 'Saving...' : 'Get My Watering Schedule'}
              </button>
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Onboarding;
