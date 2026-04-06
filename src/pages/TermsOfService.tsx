import React from 'react';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import AnimatedBackground from '@/components/AnimatedBackground';
import { useSettings } from '@/contexts/SettingsContext';

const TermsOfService = () => {
  const { publicEmail } = useSettings();

  return (
    <div className="min-h-screen flex flex-col">
      <AnimatedBackground />
      <NavBar />
      <main className="flex-1 pt-28 pb-16">
        <div className="container mx-auto px-4 max-w-3xl prose prose-gray">
          <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
          <p className="text-sm text-muted-foreground mb-8">Effective Date: April 6, 2026</p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Acceptance</h2>
          <p className="text-muted-foreground mb-4">
            By using ThirstyGrass, you agree to these Terms of Service. If you do not agree, do not use the service.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Service Description</h2>
          <p className="text-muted-foreground mb-4">
            ThirstyGrass provides personalized lawn watering recommendations based on real-time weather data for your ZIP code. The service includes email notifications and optional SMS text message alerts about watering schedules, seasonal dormancy, and frost warnings.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">SMS/Text Messaging Terms</h2>
          <p className="text-muted-foreground mb-4">
            By opting in to SMS notifications from ThirstyGrass, you agree to the following:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
            <li>
              <strong>Program description:</strong> ThirstyGrass sends automated text messages with lawn watering recommendations, seasonal alerts (dormancy start/end), and frost warnings based on weather conditions in your area.
            </li>
            <li>
              <strong>Opt-out:</strong> <span className="font-bold">You can cancel SMS notifications at any time by texting STOP to the number from which you received messages. After sending STOP, you will receive a confirmation message and will no longer receive SMS messages from ThirstyGrass. You may re-subscribe at any time through your dashboard.</span>
            </li>
            <li>
              <strong>Help:</strong> If you are experiencing issues with the messaging program, reply with the keyword <strong>HELP</strong> for assistance, or contact us directly at <a href={`mailto:${publicEmail}`} className="text-primary hover:underline">{publicEmail}</a>.
            </li>
            <li>
              <strong>Carriers:</strong> Carriers are not liable for delayed or undelivered messages.
            </li>
            <li>
              <strong>Message frequency:</strong> You will receive up to 7 messages per week (daily watering alerts plus occasional seasonal notifications). Message and data rates may apply. Contact your wireless provider for details about your text plan.
            </li>
            <li>
              <strong>Privacy:</strong> Your phone number is collected solely to deliver ThirstyGrass alerts. It is not shared with third parties for marketing purposes. See our <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a> for full details.
            </li>
          </ul>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Disclaimer of Warranties</h2>
          <p className="text-muted-foreground mb-4">
            The service is provided "as is" and "as available" without warranties of any kind, express or implied. ThirstyGrass makes no guarantees regarding recommendation accuracy, uptime, or fitness for a particular purpose.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Limitation of Liability</h2>
          <p className="text-muted-foreground mb-4">
            ThirstyGrass and 110 Labs shall not be liable for any direct, indirect, incidental, or consequential damages arising from use of the service, including but not limited to lawn damage, water bills, or service interruptions.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Payments & Refunds</h2>
          <p className="text-muted-foreground mb-4">
            Subscriptions are billed annually at the then-current rate. All sales are final. No refunds are issued under any circumstances. Cancellations take effect at the end of the current billing period — access continues until that date. To cancel, visit your dashboard.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Cancellation</h2>
          <p className="text-muted-foreground mb-4">
            Users may cancel renewal at any time from their dashboard. Cancellation stops future charges; it does not entitle the user to a refund for any unused portion of the current period.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Changes to Service</h2>
          <p className="text-muted-foreground mb-4">
            We reserve the right to modify or discontinue the service at any time without notice.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Governing Law</h2>
          <p className="text-muted-foreground mb-4">
            These terms shall be governed by and construed in accordance with the laws of the Commonwealth of Massachusetts.
          </p>

          <h2 className="text-xl font-semibold text-foreground mt-8 mb-3">Contact</h2>
          <p className="text-muted-foreground mb-4">
            For questions about these terms, contact <a href={`mailto:${publicEmail}`} className="text-primary hover:underline">{publicEmail}</a>.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsOfService;
