
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { MailIcon } from 'lucide-react';

interface EmailNotificationFormProps {
  address: string;
  recommendation: 'WATER' | 'MONITOR' | 'SKIP';
  recommendedWateringDay: number;
}

const EmailNotificationForm: React.FC<EmailNotificationFormProps> = ({ 
  address, 
  recommendation,
  recommendedWateringDay 
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
      // In a real application, this would call an API to register the email
      // For demonstration purposes, we'll simulate a successful registration
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('You have successfully signed up for email notifications!');
      setEmail('');
      setAgreeToTerms(false);
    } catch (error) {
      console.error('Error registering for email notifications:', error);
      toast.error('There was an error signing up for notifications. Please try again.');
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
        Receive an email <strong>only when your lawn needs watering</strong> based on real-time precipitation data for your address.
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
            I agree to receive email notifications <strong>only when my lawn needs watering</strong>.
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

