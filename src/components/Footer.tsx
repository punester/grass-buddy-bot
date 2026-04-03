import React from 'react';
import { Droplets } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 bg-gradient-to-b from-transparent to-gray-50 border-t border-border">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-grass-400 to-sky-400 flex items-center justify-center">
                <Droplets className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-semibold text-foreground">ThirstyGrass</span>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Helping homeowners maintain beautiful lawns with precision watering schedules based on real-time data.
            </p>
          </div>
          
          <div className="md:col-span-1">
            <h3 className="text-sm font-semibold text-foreground uppercase mb-4">Resources</h3>
            <ul className="space-y-3">
              <li><a href="/#how-it-works" className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200">How It Works</a></li>
              <li><Link to="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200">About</Link></li>
              <li><Link to="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200">Contact</Link></li>
            </ul>
          </div>
          
          <div className="md:col-span-1">
            <h3 className="text-sm font-semibold text-foreground uppercase mb-4">Company</h3>
            <ul className="space-y-3">
              <li><Link to="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200">About Us</Link></li>
              <li><Link to="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200">Privacy Policy</Link></li>
              <li><Link to="/tos" className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200">Terms of Service</Link></li>
              <li><Link to="/pricing" className="text-sm text-muted-foreground hover:text-primary transition-colors duration-200">Pricing</Link></li>
            </ul>
          </div>
          
          <div className="md:col-span-1">
            <h3 className="text-sm font-semibold text-foreground uppercase mb-4">Contact</h3>
            <ul className="space-y-3">
              <li className="text-sm text-muted-foreground">info@thirstygrass.com</li>
              <li className="text-sm text-muted-foreground">110 Labs 300A Apex Dr<br />Marlborough, MA 01752</li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-center text-sm text-muted-foreground">
            © {currentYear} ThirstyGrass. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
