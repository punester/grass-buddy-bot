import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserTier } from '@/hooks/useUserTier';
import { PrecipitationData } from '@/components/PrecipitationDisplay';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface DashboardFeedbackProps {
  profile: {
    zip_code: string | null;
    grass_type: string | null;
    irrigation_type: string | null;
  } | null;
  weatherData: PrecipitationData | null;
}

const DashboardFeedback: React.FC<DashboardFeedbackProps> = ({ profile, weatherData }) => {
  const { user } = useAuth();
  const { isPaid } = useUserTier();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user) return null;

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'user-feedback',
          recipientEmail: 'hello@thirstygrass.com',
          idempotencyKey: `feedback-${user.id}-${Date.now()}`,
          templateData: {
            userEmail: user.email,
            zipCode: profile?.zip_code || 'N/A',
            grassType: profile?.grass_type || 'N/A',
            irrigationType: profile?.irrigation_type || 'N/A',
            tier: isPaid ? 'paid' : 'free',
            recommendation: weatherData?.recommendation || 'N/A',
            recommendationReason: weatherData?.recommendationReason || 'N/A',
            message: message.trim(),
            sentAt: new Date().toLocaleString(),
          },
        },
      });
      setSent(true);
      setOpen(false);
      setMessage('');
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="mt-6 text-center">
        <p className="text-sm text-green-600 font-medium">Thanks — we'll look into it.</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Something look off? Send feedback →
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {open && (
        <div className="mt-4 bg-card rounded-xl border border-border p-5 space-y-4">
          <h4 className="text-sm font-semibold text-foreground">How's the recommendation looking?</h4>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value.slice(0, 1000))}
            placeholder="e.g. It says WATER but it's been raining all week..."
            rows={4}
            maxLength={1000}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{message.length}/1000</p>
          <button
            onClick={handleSubmit}
            disabled={sending || !message.trim()}
            className="w-full px-4 py-2 rounded-lg bg-green-600 text-white font-medium text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send Feedback'}
          </button>
        </div>
      )}
    </div>
  );
};

export default DashboardFeedback;
