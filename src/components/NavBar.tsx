import React, { useState, useEffect } from 'react';
import { Menu, X, Droplets } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import SignInModal from './SignInModal';

const NavBar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [referralActive, setReferralActive] = useState(false);
  const { user, signOut } = useAuth();

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'referral_program_active')
      .single()
      .then(({ data }) => {
        if (data?.value === 'true') setReferralActive(true);
      });
  }, []);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out px-6 py-4',
          isScrolled
            ? 'bg-white/80 backdrop-blur-md shadow-sm'
            : 'bg-transparent'
        )}
      >
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <a href="/" className="flex items-center space-x-2">
              <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-grass-400 to-sky-400 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-grass-400 to-sky-400 opacity-75 animate-pulse-gentle"></div>
                <Droplets className="w-4 h-4 text-white" />
              </div>
              <span className={cn(
                "text-xl font-semibold transition-colors duration-300",
                isScrolled ? "text-gray-800" : "text-gray-900"
              )}>
                thirstygrass
              </span>
            </a>
          </div>

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <a
              href="/#how-it-works"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200"
            >
              How It Works
            </a>
            <Link
              to="/about"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200"
            >
              About
            </Link>
            <Link
              to="/contact"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200"
            >
              Contact
            </Link>
            <Link
              to="/pricing"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200"
            >
              Pricing
            </Link>

            {user ? (
              <div className="flex items-center space-x-4">
                {referralActive && (
                  <Link
                    to="/referrals"
                    className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200"
                  >
                    Refer a Friend
                  </Link>
                )}
                <Link
                  to="/dashboard"
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200"
                >
                  Dashboard
                </Link>
                <span className="text-sm text-muted-foreground truncate max-w-[180px]">
                  {user.email}
                </span>
                <button
                  onClick={signOut}
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsSignInOpen(true)}
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200"
              >
                Sign In
              </button>
            )}
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-foreground focus:outline-none"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-md shadow-md border-t border-border animate-fade-in">
            <div className="container mx-auto py-4 px-6 flex flex-col space-y-4">
              <a
                href="/#how-it-works"
                className="text-sm font-medium text-foreground hover:text-primary transition-colors duration-200 py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                How It Works
              </a>
              <Link
                to="/about"
                className="text-sm font-medium text-foreground hover:text-primary transition-colors duration-200 py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                About
              </Link>
              <Link
                to="/contact"
                className="text-sm font-medium text-foreground hover:text-primary transition-colors duration-200 py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Contact
              </Link>
              <Link
                to="/pricing"
                className="text-sm font-medium text-foreground hover:text-primary transition-colors duration-200 py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Pricing
              </Link>

              {user ? (
                <>
                  {referralActive && (
                    <Link
                      to="/referrals"
                      className="text-sm font-medium text-foreground hover:text-primary transition-colors duration-200 py-2"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Refer a Friend
                    </Link>
                  )}
                  <Link
                    to="/dashboard"
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors duration-200 py-2"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <span className="text-sm text-muted-foreground py-2 truncate">
                    {user.email}
                  </span>
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      signOut();
                    }}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors duration-200 py-2 text-left"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsSignInOpen(true);
                  }}
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors duration-200 py-2 text-left"
                >
                  Sign In
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <SignInModal isOpen={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
    </>
  );
};

export default NavBar;
