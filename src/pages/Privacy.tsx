import React from 'react';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import AnimatedBackground from '@/components/AnimatedBackground';
import { useSettings } from '@/contexts/SettingsContext';

const Privacy = () => {
  const { publicEmail } = useSettings();

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatedBackground />
      <NavBar />
      <main className="flex-1 pt-28 pb-16">
        <div className="container mx-auto px-4 max-w-3xl prose prose-gray">
          <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground mb-8">Effective Date: April 6, 2026</p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Information We Collect</h2>
          <p className="text-muted-foreground mb-4">
            When you use ThirstyGrass, we collect the following personal information:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-1">
            <li><strong>Email address</strong> — used for account login, watering alerts, and seasonal notifications</li>
            <li><strong>Phone number</strong> — if you opt in to SMS alerts, used solely to deliver watering and seasonal text messages</li>
            <li><strong>ZIP code</strong> — used to fetch local weather data for your watering recommendation</li>
            <li><strong>Lawn profile details</strong> — grass type and irrigation type, used to personalize your recommendation</li>
            <li><strong>Usage data</strong> — general page views and feature interactions for improving the service</li>
          </ul>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">How We Use Your Information</h2>
          <p className="text-muted-foreground mb-4">
            Your information is used exclusively to operate and improve the ThirstyGrass service:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-1">
            <li>Provide personalized lawn watering recommendations based on local weather</li>
            <li>Send email alerts (watering reminders, seasonal dormancy/frost notifications)</li>
            <li>Send SMS alerts if you have opted in (watering reminders, seasonal notifications)</li>
            <li>Manage your account and subscription</li>
            <li>Improve our recommendation engine and service reliability</li>
          </ul>
          <p className="text-muted-foreground mb-4">
            <strong>We do not use your data for marketing or advertising purposes.</strong> We will never sell, rent, or share your personal information with third parties for their marketing purposes.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">SMS/Text Messaging</h2>
          <p className="text-muted-foreground mb-4">
            If you opt in to receive SMS notifications from ThirstyGrass:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-1">
            <li>Your phone number is collected solely to deliver watering and seasonal alert messages</li>
            <li>Your phone number is <strong>not shared with third parties</strong> for marketing or any other purpose</li>
            <li>SMS delivery is handled by Twilio as our messaging provider; Twilio processes your phone number only to deliver messages on our behalf under their <a href="https://www.twilio.com/legal/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">privacy policy</a></li>
            <li>You can opt out of SMS at any time by replying <strong>STOP</strong> to any message</li>
            <li>Message and data rates may apply depending on your wireless plan</li>
          </ul>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Data Sharing</h2>
          <p className="text-muted-foreground mb-4">
            <strong>We do not sell your data.</strong> We do not share your personal information with third parties for marketing purposes. Your data is only shared with the following service providers who process it on our behalf to operate the service:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-1">
            <li><strong>Twilio</strong> — SMS message delivery only (<a href="https://www.twilio.com/legal/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Twilio Privacy Policy</a>)</li>
            <li><strong>Stripe</strong> — payment processing only (<a href="https://stripe.com/privacy" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">Stripe Privacy Policy</a>)</li>
            <li><strong>Resend</strong> — email delivery only</li>
          </ul>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Data Retention</h2>
          <p className="text-muted-foreground mb-4">
            We retain your data for as long as your account is active. Weather lookup logs are retained for analytics purposes. If you opt out of SMS, your phone number is removed from our messaging list. You may request full deletion of your account and all associated data at any time.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Your Rights</h2>
          <p className="text-muted-foreground mb-4">
            You have the right to:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-1">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and all associated data</li>
            <li>Opt out of SMS notifications at any time by replying STOP</li>
            <li>Opt out of email notifications via the unsubscribe link in any email</li>
          </ul>
          <p className="text-muted-foreground mb-4">
            To exercise any of these rights, email <a href={`mailto:${publicEmail}`} className="text-primary hover:underline">{publicEmail}</a>.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Contact</h2>
          <p className="text-muted-foreground mb-4">
            ThirstyGrass is provided by 110 Labs. For questions about this policy, contact <a href={`mailto:${publicEmail}`} className="text-primary hover:underline">{publicEmail}</a>.
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
