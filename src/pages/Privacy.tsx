import React from 'react';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import AnimatedBackground from '@/components/AnimatedBackground';

const Privacy = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <AnimatedBackground />
      <NavBar />
      <main className="flex-1 pt-28 pb-16">
        <div className="container mx-auto px-4 max-w-3xl prose prose-gray">
          <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-8">Effective Date: April 3, 2026</p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Information We Collect</h2>
          <p className="text-muted-foreground mb-4">
            We collect the following information when you use ThirstyGrass: email address, ZIP code, lawn profile details (grass type, irrigation type), and general usage data such as page views and feature interactions.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">How We Use It</h2>
          <p className="text-muted-foreground mb-4">
            Your information is used to provide personalized watering recommendations, send email and SMS alerts (if subscribed), and manage your account. We do not use your data for advertising.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Data Sharing</h2>
          <p className="text-muted-foreground mb-4">
            We do not sell your data. Payment processing is handled by Stripe under their own <a href="https://stripe.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">privacy policy</a>. SMS delivery is handled by Twilio under their own <a href="https://www.twilio.com/legal/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">privacy policy</a>.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Data Retention</h2>
          <p className="text-muted-foreground mb-4">
            We retain your data for as long as your account is active. Weather lookup logs are retained for analytics purposes. You may request deletion at any time.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Your Rights</h2>
          <p className="text-muted-foreground mb-4">
            To delete your account and all associated data, email <a href="mailto:admin@110labs.com" className="text-primary hover:underline">admin@110labs.com</a>.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Contact</h2>
          <p className="text-muted-foreground mb-4">
            ThirstyGrass is provided by 110 Labs. For questions about this policy, contact <a href="mailto:admin@110labs.com" className="text-primary hover:underline">admin@110labs.com</a>.
          </p>

          <div className="mt-8 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground italic">
              ThirstyGrass is provided as-is without warranty of any kind. We are not liable for lawn damage, water waste, or any outcomes resulting from use of this service.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Privacy;
