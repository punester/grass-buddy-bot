
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { MailIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PrecipitationData } from '@/components/PrecipitationDisplay';

interface EmailNotificationFormProps {
  address: string;
  recommendation: 'WATER' | 'MONITOR' | 'SKIP';
  recommendedWateringDay: number;
  weatherData?: PrecipitationData;
  zipCode?: string;
}

const EmailNotificationForm: React.FC<EmailNotificationFormProps> = ({ 
  address, 
  recommendation,
  recommendedWateringDay,
  weatherData,
  zipCode,
}) => {
  const [email, setEmail] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    
    if (!agreeToTerms) {
      toast.error('Please agree to receive email notifications');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // 1. Trigger magic link signup/signin via OTP
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (otpError) {
        throw new Error(otpError.message);
      }

      // 2. Send a sample weekly digest email so they see what they'll get
      if (weatherData && zipCode) {
        try {
          await supabase.functions.invoke('send-weekly-digest', {
            body: {
              singleEmail: email.trim(),
              zipCode,
              grassType: weatherData.grassType || 'Mixed',
            },
          });
        } catch (digestErr) {
          console.error('Sample digest send failed (non-critical):', digestErr);
        }
      }

      toast.success(
        'Check your inbox! We sent a magic link to sign in and a sample of your weekly watering report.',
        { duration: 8000 }
      );
      setEmail('');
      setAgreeToTerms(false);
    } catch (error) {
      console.error('Error during signup:', error);
      toast.error('There was an error signing up. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
      <div className="flex items-center mb-4 text-primary">
        <MailIcon className="h-5 w-5 mr-2" />
        <h3 className="text-lg font-semibold">Get Email Notifications</h3>
      </div>
      
      <p className="text-gray-600 mb-4">
        Get a <strong>weekly email</strong> with personalized recommendations on which days to water your grass, based on real-time weather data for your area.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Your Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="youremail@example.com"
            value={email}
            onChange={handleEmailChange}
            className="w-full"
            disabled={isSubmitting}
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="terms" 
            checked={agreeToTerms} 
            onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
          />
          <Label 
            htmlFor="terms" 
            className="text-sm text-gray-600 cursor-pointer"
          >
            I agree to receive <strong>weekly watering recommendation emails</strong>.
          </Label>
        </div>
        
        <Button 
          type="submit" 
          className="w-full bg-primary hover:bg-primary/90"
          disabled={isSubmitting || !email.trim() || !validateEmail(email.trim()) || !agreeToTerms}
        >
          {isSubmitting ? 'Signing Up...' : 'Sign Up for Email Alerts'}
        </Button>
      </form>
    </div>
  );
};

export default EmailNotificationForm;
