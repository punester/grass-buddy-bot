import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useReferralInfo } from '@/hooks/useReferralInfo';
import ReferralShareBlock from '@/components/ReferralShareBlock';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import AnimatedBackground from '@/components/AnimatedBackground';
import SignInModal from '@/components/SignInModal';
import { Users, Gift, Share2 } from 'lucide-react';

const Referrals = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { programActive, threshold, offerExpires, referralCode, referralCount, isLoading } = useReferralInfo();
  const [signInOpen, setSignInOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading && !programActive) {
      navigate('/');
    }
  }, [isLoading, programActive, navigate]);

  if (isLoading || !programActive) return null;

  const formattedExpiry = new Date(offerExpires).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatedBackground />
      <NavBar />
      <main className="flex-1 pt-28 pb-16">
        <div className="container mx-auto px-4 max-w-2xl">

          {/* Hero */}
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Help your friends waste less water.
            </h1>
            <p className="text-lg text-muted-foreground">
              Save the planet. One hose at a time.
            </p>
          </div>

          {/* Stat Block */}
          <div className="bg-card rounded-2xl shadow-md border border-border p-6 mb-8 text-center">
            <p className="text-base text-foreground leading-relaxed">
              The average lawn wastes <span className="font-semibold text-primary">14,000+ gallons</span> a year
              on unnecessary watering. You know better now. Help your neighbors.
            </p>
          </div>

          {/* How It Works */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-5 text-center">How It Works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Share2, step: '1', title: 'Share your unique link', desc: 'Send it to friends and neighbors' },
                { icon: Users, step: '2', title: 'Friends sign up free', desc: 'No credit card needed' },
                { icon: Gift, step: '3', title: 'Earn free premium', desc: `When ${threshold} friends join, you get a free year` },
              ].map(({ icon: Icon, step, title, desc }) => (
                <div key={step} className="bg-card rounded-xl border border-border p-5 text-center">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Step {step}</p>
                  <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Share Block */}
          <div className="bg-card rounded-2xl shadow-md border border-border p-6 mb-8">
            <h2 className="text-lg font-semibold text-foreground mb-4">Your Referral Link</h2>
            {user && referralCode ? (
              <ReferralShareBlock
                referralCode={referralCode}
                referralCount={referralCount}
                threshold={threshold}
              />
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Sign in to get your unique referral link
                </p>
                <button
                  onClick={() => setSignInOpen(true)}
                  className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors"
                >
                  Sign In
                </button>
              </div>
            )}
          </div>

          {/* Offer Terms */}
          <div className="bg-muted/50 rounded-xl border border-border p-5 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground text-sm mb-2">Offer Terms</p>
            <p>• Offer valid for sign-ups within 30 days of clicking your link.</p>
            <p>• Offer valid through {formattedExpiry}.</p>
            <p>• Free year awarded once per account. Not stackable.</p>
            <p>• ThirstyGrass reserves the right to revoke promotional upgrades if referral fraud is suspected, including but not limited to self-referral or the use of duplicate accounts, devices, or IP addresses.</p>
          </div>

        </div>
      </main>
      <Footer />
      <SignInModal isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  );
};

export default Referrals;
