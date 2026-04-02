
import React from 'react';
import { GithubIcon, TwitterIcon, InstagramIcon } from 'lucide-react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 bg-gradient-to-b from-transparent to-gray-50 border-t border-gray-100">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-grass-400 to-sky-400 flex items-center justify-center">
                <span className="text-white font-semibold text-sm">GW</span>
              </div>
              <span className="text-xl font-semibold text-gray-900">GrassWater</span>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Helping homeowners maintain beautiful lawns with precision watering schedules based on real-time data.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-gray-400 hover:text-gray-700 transition-colors duration-200">
                <GithubIcon className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-700 transition-colors duration-200">
                <TwitterIcon className="w-5 h-5" />
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-700 transition-colors duration-200">
                <InstagramIcon className="w-5 h-5" />
              </a>
            </div>
          </div>
          
          <div className="md:col-span-1">
            <h3 className="text-sm font-semibold text-gray-900 uppercase mb-4">Resources</h3>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-sm text-gray-500 hover:text-primary transition-colors duration-200">
                  Lawn Care Guide
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 hover:text-primary transition-colors duration-200">
                  Watering Calculator
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 hover:text-primary transition-colors duration-200">
                  Conservation Tips
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 hover:text-primary transition-colors duration-200">
                  Plant Database
                </a>
              </li>
            </ul>
          </div>
          
          <div className="md:col-span-1">
            <h3 className="text-sm font-semibold text-gray-900 uppercase mb-4">Company</h3>
            <ul className="space-y-3">
              <li>
                <a href="#" className="text-sm text-gray-500 hover:text-primary transition-colors duration-200">
                  About Us
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 hover:text-primary transition-colors duration-200">
                  Careers
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 hover:text-primary transition-colors duration-200">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 hover:text-primary transition-colors duration-200">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
          
          <div className="md:col-span-1">
            <h3 className="text-sm font-semibold text-gray-900 uppercase mb-4">Contact</h3>
            <ul className="space-y-3">
              <li className="text-sm text-gray-500">
                info@grasswater.com
              </li>
              <li className="text-sm text-gray-500">
                (555) 123-4567
              </li>
              <li className="text-sm text-gray-500">
                123 Green Street<br />
                Plant City, CA 94123
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-center text-sm text-gray-500">
            © {currentYear} GrassWater. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
