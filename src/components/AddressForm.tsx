
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Search, MapPin, RefreshCw } from 'lucide-react';
import { validateAddress } from '@/utils/addressValidation';

interface AddressFormProps {
  onSubmit: (address: string) => void;
  isLoading: boolean;
}

const AddressForm: React.FC<AddressFormProps> = ({ onSubmit, isLoading }) => {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset error
    setError('');
    
    // Validate address
    const validation = validateAddress(address);
    if (!validation.isValid) {
      setError(validation.error);
      toast.error(validation.error);
      return;
    }
    
    // Submit address
    onSubmit(address);
  };

  return (
    <div className="w-full max-w-md mx-auto glass-card rounded-xl p-6 transition-all duration-300 transform hover:scale-[1.01]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label 
            htmlFor="address" 
            className="text-sm font-medium text-gray-700 flex items-center gap-1.5"
          >
            <MapPin className="h-4 w-4 text-primary" />
            Your Address
          </Label>
          <div className="relative">
            <Input
              id="address"
              placeholder="Enter your full address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className={`pl-10 h-12 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm ${error ? 'border-red-300' : 'border-gray-200'}`}
              disabled={isLoading}
            />
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <Search className="h-5 w-5" />
            </div>
          </div>
          {error && (
            <p className="text-xs text-red-500 mt-1 animate-fade-in">{error}</p>
          )}
        </div>
        
        <Button 
          type="submit" 
          disabled={isLoading || !address.trim()} 
          className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-lg transition-all duration-200 transform hover:translate-y-[-2px] hover:shadow-md"
        >
          {isLoading ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Checking Data...
            </>
          ) : (
            'Check Watering Needs'
          )}
        </Button>
      </form>
      
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          We'll use your address to check historical precipitation data for your area.
        </p>
      </div>
    </div>
  );
};

export default AddressForm;
