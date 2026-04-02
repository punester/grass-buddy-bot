import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Search, MapPin, RefreshCw } from 'lucide-react';

interface AddressFormProps {
  onSubmit: (zipCode: string) => void;
  isLoading: boolean;
}

const AddressForm: React.FC<AddressFormProps> = ({ onSubmit, isLoading }) => {
  const [zipCode, setZipCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = zipCode.trim();
    if (!trimmed) {
      const msg = 'ZIP Code is required';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!/^\d{5}$/.test(trimmed)) {
      const msg = 'Please enter a valid 5-digit ZIP Code';
      setError(msg);
      toast.error(msg);
      return;
    }

    onSubmit(trimmed);
  };

  return (
    <div className="w-full max-w-md mx-auto glass-card rounded-xl p-6 transition-all duration-300 transform hover:scale-[1.01]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label
            htmlFor="zipCode"
            className="text-sm font-medium text-foreground flex items-center gap-1.5"
          >
            <MapPin className="h-4 w-4 text-primary" />
            Your ZIP Code
          </Label>
          <div className="relative">
            <Input
              id="zipCode"
              inputMode="numeric"
              maxLength={5}
              placeholder="Enter your ZIP code"
              value={zipCode}
              onChange={(e) => {
                setZipCode(e.target.value.replace(/\D/g, ''));
                if (error) setError('');
              }}
              className={`pl-10 h-12 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm ${error ? 'border-destructive' : 'border-input'}`}
              disabled={isLoading}
            />
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
              <Search className="h-5 w-5" />
            </div>
          </div>
          {error && (
            <p className="text-xs text-destructive mt-1 animate-fade-in">{error}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isLoading || !zipCode.trim()}
          className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all duration-200 transform hover:translate-y-[-2px] hover:shadow-md"
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
        <p className="text-xs text-muted-foreground">
          We'll check real-time precipitation data for your area.
        </p>
      </div>
    </div>
  );
};

export default AddressForm;
