import React, { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SignInModal: React.FC<SignInModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: 'https://thirstygrass.com/dashboard',
      },
    });

    setIsLoading(false);

    if (authError) {
      setError(authError.message);
    } else {
      setSubmitted(true);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setEmail('');
    setError('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-card rounded-xl shadow-lg p-8 w-full max-w-md mx-4 animate-fade-in">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="text-center py-4">
            <h2 className="text-2xl font-bold text-foreground mb-4">Check your inbox</h2>
            <p className="text-muted-foreground mb-6">
              Check your inbox — we sent you a login link.
            </p>
            <button
              onClick={handleReset}
              className="text-sm text-primary hover:underline"
            >
              ← Back to sign in
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-foreground mb-6 text-center">
              Sign in to ThirstyGrass
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-all duration-200 disabled:opacity-50"
              >
                {isLoading ? 'Sending...' : 'Send Magic Link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default SignInModal;
