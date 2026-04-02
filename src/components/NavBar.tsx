
import React, { useState, useEffect } from 'react';
import { Menu, X, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';

const NavBar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
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
            href="#how-it-works" 
            className="text-sm font-medium text-gray-600 hover:text-primary transition-colors duration-200"
          >
            How It Works
          </a>
          <a 
            href="#about" 
            className="text-sm font-medium text-gray-600 hover:text-primary transition-colors duration-200"
          >
            About
          </a>
          <a 
            href="#contact" 
            className="text-sm font-medium text-gray-600 hover:text-primary transition-colors duration-200"
          >
            Contact
          </a>
        </nav>

        {/* Mobile menu button */}
        <button 
          className="md:hidden text-gray-700 focus:outline-none" 
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
        <div className="md:hidden absolute top-full left-0 right-0 bg-white/95 backdrop-blur-md shadow-md border-t border-gray-100 animate-fade-in">
          <div className="container mx-auto py-4 px-6 flex flex-col space-y-4">
            <a 
              href="#how-it-works" 
              className="text-sm font-medium text-gray-800 hover:text-primary transition-colors duration-200 py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              How It Works
            </a>
            <a 
              href="#about" 
              className="text-sm font-medium text-gray-800 hover:text-primary transition-colors duration-200 py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              About
            </a>
            <a 
              href="#contact" 
              className="text-sm font-medium text-gray-800 hover:text-primary transition-colors duration-200 py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Contact
            </a>
          </div>
        </div>
      )}
    </header>
  );
};

export default NavBar;
