import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserTier } from '@/hooks/useUserTier';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';

interface SmsProfile {
  sms_phone: string | null;
  sms_opted_in: boolean;
  sms_phone_verified: boolean;
  sms_last_sent_at: string | null;
}

interface SmsSettingsCardProps {
  /** Pre-fill phone from onboarding and auto-show code entry */
  pendingPhone?: string | null;
  onPendingPhoneHandled?: () => void;
}

const SmsSettingsCard: React.FC<SmsSettingsCardProps> = ({ pendingPhone, onPendingPhoneHandled }) => {
  const { user } = useAuth();
  const { isFree } = useUserTier();
  const [smsProfile, setSmsProfile] = useState<SmsProfile | null>(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [submittedPhone, setSubmittedPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchSmsProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('sms_phone, sms_opted_in, sms_phone_verified, sms_last_sent_at')
      .eq('id', user.id)
      .single();
    if (data) setSmsProfile(data as SmsProfile);
  };

  useEffect(() => {
    fetchSmsProfile();
  }, [user]);

  // Handle pending phone from onboarding
  useEffect(() => {
    if (pendingPhone && smsProfile && !smsProfile.sms_phone_verified) {
      setPhone(pendingPhone);
      setSubmittedPhone(pendingPhone);
      setShowCodeEntry(true);
      onPendingPhoneHandled?.();
    }
  }, [pendingPhone, smsProfile]);

  const formatToE164 = (input: string): string => {
    const digits = input.replace(/\D/g, '');
    if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    if (input.startsWith('+')) return input.replace(/[^\d+]/g, '');
    return `+${digits}`;
  };

  const handleSendCode = async () => {
    setError('');
    const e164 = formatToE164(phone);
    if (!/^\+[1-9]\d{6,14}$/.test(e164)) {
      setError('Enter a valid phone number (e.g. +16175551234)');
      return;
    }

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('verify-phone', {
        body: { action: 'send', phoneNumber: e164 },
      });
      if (fnError) throw fnError;
      if (data?.success) {
        setSubmittedPhone(e164);
        setShowCodeEntry(true);
      } else {
        setError(data?.error || 'Failed to send code');
      }
    } catch (e) {
      setError('Failed to send verification code');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckCode = async () => {
    setError('');
    if (!/^\d{4,8}$/.test(code)) {
      setError('Enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('verify-phone', {
        body: { action: 'check', phoneNumber: submittedPhone, code },
      });
      if (fnError) throw fnError;
      if (data?.verified) {
        toast.success('SMS alerts activated');
        await fetchSmsProfile();
        setShowCodeEntry(false);
        setCode('');
      } else {
        setError("That code didn't match — try again");
      }
    } catch (e) {
      setError('Verification failed');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke('verify-phone', {
        body: { action: 'send', phoneNumber: submittedPhone },
      });
      if (data?.success) {
        toast.success('Code resent');
      } else {
        setError(data?.error || 'Failed to resend');
      }
    } catch (e) {
      setError('Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    if (!user) return;
    setLoading(true);
    await supabase.from('profiles').update({ sms_opted_in: false } as any).eq('id', user.id);
    await fetchSmsProfile();
    setLoading(false);
    toast.success('SMS alerts paused');
  };

  const handleResume = async () => {
    if (!user) return;
    setLoading(true);
    await supabase.from('profiles').update({ sms_opted_in: true } as any).eq('id', user.id);
    await fetchSmsProfile();
    setLoading(false);
    toast.success('SMS alerts resumed');
  };

  const handleChangeNumber = async () => {
    if (!user) return;
    setLoading(true);
    await supabase.from('profiles').update({ sms_phone: null, sms_phone_verified: false } as any).eq('id', user.id);
    setPhone('');
    setCode('');
    setShowCodeEntry(false);
    setSubmittedPhone('');
    setError('');
    await fetchSmsProfile();
    setLoading(false);
  };

  if (!smsProfile) return null;

  // Free user state
  if (isFree) {
    return (
      <div className="bg-card rounded-2xl shadow-md border border-border p-6 mt-8">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Daily SMS Alerts</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Get a text only when your lawn needs action. No spam, no noise.
        </p>
        <Link
          to="/pricing"
          className="block w-full text-center px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors"
        >
          Upgrade to Pro — $24/year
        </Link>
      </div>
    );
  }

  // Paid — State B: Active
  if (smsProfile.sms_opted_in && smsProfile.sms_phone_verified && smsProfile.sms_phone) {
    const lastSent = smsProfile.sms_last_sent_at
      ? new Date(smsProfile.sms_last_sent_at).toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        })
      : null;

    return (
      <div className="bg-card rounded-2xl shadow-md border border-border p-6 mt-8">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">SMS Alerts Active</h2>
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
        </div>
        <p className="text-sm text-foreground mb-1">{smsProfile.sms_phone}</p>
        <p className="text-sm text-muted-foreground mb-4">
          {lastSent ? `Last alert sent ${lastSent}` : 'No alerts sent yet'}
        </p>
        <button
          onClick={handlePause}
          disabled={loading}
          className="w-full px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          Pause Alerts
        </button>
        <button
          onClick={handleChangeNumber}
          disabled={loading}
          className="w-full mt-2 text-sm text-primary hover:underline disabled:opacity-50"
        >
          Change Number
        </button>
      </div>
    );
  }

  // Paid — State C: Paused
  if (smsProfile.sms_phone && !smsProfile.sms_opted_in) {
    return (
      <div className="bg-card rounded-2xl shadow-md border border-border p-6 mt-8">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">SMS Alerts Paused</h2>
        </div>
        <p className="text-sm text-foreground mb-4">{smsProfile.sms_phone}</p>
        <button
          onClick={handleResume}
          disabled={loading}
          className="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          Resume Alerts
        </button>
        <button
          onClick={handleChangeNumber}
          disabled={loading}
          className="w-full mt-2 text-sm text-primary hover:underline disabled:opacity-50"
        >
          Change Number
        </button>
      </div>
    );
  }

  // Paid — State A: Not enrolled (or code entry)
  return (
    <div className="bg-card rounded-2xl shadow-md border border-border p-6 mt-8">
      <div className="flex items-center gap-2 mb-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Get Daily SMS Alerts</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        We'll text you only when your lawn needs action — no daily spam.
      </p>

      {!showCodeEntry ? (
        <>
          <input
            type="tel"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setError(''); }}
            placeholder="+1 (617) 555-1234"
            className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mb-3"
          />
          {error && <p className="text-sm text-destructive mb-3">{error}</p>}
          <button
            onClick={handleSendCode}
            disabled={loading || !phone.trim()}
            className="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Sending…' : 'Send Verification Code'}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-3">
            Enter the 6-digit code we just sent to {submittedPhone}
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
            placeholder="123456"
            className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-foreground text-center text-lg tracking-widest placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 mb-3"
          />
          {error && <p className="text-sm text-destructive mb-3">{error}</p>}
          <button
            onClick={handleCheckCode}
            disabled={loading || code.length < 4}
            className="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Verify Number'}
          </button>
          <div className="flex justify-between mt-3">
            <button onClick={handleResend} disabled={loading} className="text-sm text-primary hover:underline disabled:opacity-50">
              Resend code
            </button>
            <button
              onClick={() => { setShowCodeEntry(false); setCode(''); setError(''); }}
              disabled={loading}
              className="text-sm text-primary hover:underline disabled:opacity-50"
            >
              Use a different number
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default SmsSettingsCard;
