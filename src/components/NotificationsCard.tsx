import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserTier } from '@/hooks/useUserTier';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Bell, Lock, MessageSquare, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface SmsProfile {
  sms_phone: string | null;
  sms_opted_in: boolean;
  sms_phone_verified: boolean;
}

const NotificationsCard: React.FC = () => {
  const { user } = useAuth();
  const { isFree, isPaid } = useUserTier();
  const [smsProfile, setSmsProfile] = useState<SmsProfile | null>(null);
  const [emailDigestEnabled, setEmailDigestEnabled] = useState(true);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [submittedPhone, setSubmittedPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPhoneInput, setShowPhoneInput] = useState(false);

  const fetchSmsProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('sms_phone, sms_opted_in, sms_phone_verified')
      .eq('id', user.id)
      .single();
    if (data) {
      setSmsProfile(data as SmsProfile);
      // If phone exists and is verified, don't show phone input
      if (data.sms_phone && (data as SmsProfile).sms_phone_verified) {
        setShowPhoneInput(false);
      } else if (!data.sms_phone) {
        // No phone — show input when user interacts
        setShowPhoneInput(false);
      }
    }
  };

  useEffect(() => {
    fetchSmsProfile();
  }, [user]);

  const formatToE164 = (input: string): string => {
    const digits = input.replace(/\D/g, '');
    if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    if (input.startsWith('+')) return input.replace(/[^\d+]/g, '');
    return `+${digits}`;
  };

  const handleSendCode = async (phoneOverride?: string) => {
    setError('');
    const e164 = formatToE164(phoneOverride || phone);
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
    } catch {
      setError('Failed to send verification code');
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
        toast.success('Phone verified!');
        await fetchSmsProfile();
        setShowCodeEntry(false);
        setShowPhoneInput(false);
        setCode('');
      } else {
        setError("That code didn't match — try again");
      }
    } catch {
      setError('Verification failed');
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
      if (data?.success) toast.success('Code resent');
      else setError(data?.error || 'Failed to resend');
    } catch {
      setError('Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSms = async (enabled: boolean) => {
    if (!user) return;
    setLoading(true);
    await supabase.from('profiles').update({ sms_opted_in: enabled } as any).eq('id', user.id);
    await fetchSmsProfile();
    setLoading(false);
    toast.success(enabled ? 'SMS alerts enabled' : 'SMS alerts paused');
  };

  const handleChangeNumber = () => {
    setPhone('');
    setCode('');
    setShowCodeEntry(false);
    setSubmittedPhone('');
    setError('');
    setShowPhoneInput(true);
  };

  const handleResetPhone = async () => {
    if (!user) return;
    setLoading(true);
    await supabase.from('profiles').update({ sms_phone: null, sms_phone_verified: false, sms_opted_in: false } as any).eq('id', user.id);
    await fetchSmsProfile();
    setLoading(false);
    handleChangeNumber();
  };

  const hasVerifiedPhone = smsProfile?.sms_phone && smsProfile.sms_phone_verified;
  const needsPhoneEntry = !smsProfile?.sms_phone || showPhoneInput || (smsProfile?.sms_phone && !smsProfile.sms_phone_verified);

  // Determine SMS row state
  const renderSmsSection = () => {
    // State A — no phone, unverified phone, or actively entering
    if (needsPhoneEntry && !hasVerifiedPhone) {
      // Pre-fill phone if exists but unverified
      const prefilledPhone = smsProfile?.sms_phone && !smsProfile.sms_phone_verified && !phone ? smsProfile.sms_phone : phone;
      
      return (
        <div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">SMS Water Alerts</p>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Pro</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Get notified when you need to water</p>
              </div>
            </div>
          </div>

          {/* Phone input — always visible in State A */}
          <div className="mt-3 pl-7">
            {!showCodeEntry ? (
              <div className="space-y-2">
                <input
                  type="tel"
                  value={prefilledPhone || phone}
                  onChange={(e) => { setPhone(e.target.value); setError(''); }}
                  placeholder="Your phone number"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <button
                  onClick={() => {
                    const effectivePhone = phone || prefilledPhone || '';
                    if (!phone && prefilledPhone) setPhone(prefilledPhone);
                    // Use effective phone directly to avoid stale state
                    const e164 = formatToE164(effectivePhone);
                    if (!/^\+[1-9]\d{6,14}$/.test(e164)) {
                      setError('Enter a valid phone number (e.g. +16175551234)');
                      return;
                    }
                    setPhone(effectivePhone);
                    handleSendCode();
                  }}
                  disabled={loading || !(phone.trim() || prefilledPhone)}
                  className="w-full px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Sending…' : 'Send Verification Code'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code sent to {submittedPhone}
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
                  placeholder="123456"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-center text-lg tracking-widest placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <button
                  onClick={handleCheckCode}
                  disabled={loading || code.length < 4}
                  className="w-full px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Verifying…' : 'Verify Number'}
                </button>
                <div className="flex justify-between">
                  <button onClick={handleResend} disabled={loading} className="text-xs text-primary hover:underline disabled:opacity-50">
                    Resend code
                  </button>
                  <button
                    onClick={() => { setShowCodeEntry(false); setCode(''); setError(''); }}
                    disabled={loading}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    Use a different number
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // State B — verified, free user
    if (hasVerifiedPhone && isFree) {
      return (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">SMS Water Alerts</p>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Pro</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{smsProfile!.sms_phone}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <Link to="/pricing" className="text-primary hover:underline">Upgrade to Pro to enable</Link>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <Switch disabled checked={false} />
          </div>
        </div>
      );
    }

    // State C — verified, pro user
    if (hasVerifiedPhone && isPaid) {
      return (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-4 w-4 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">SMS Water Alerts</p>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Pro</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {smsProfile!.sms_phone}
                <button onClick={handleResetPhone} className="ml-2 text-primary hover:underline">
                  Change
                </button>
              </p>
            </div>
          </div>
          <Switch
            checked={smsProfile!.sms_opted_in}
            onCheckedChange={handleToggleSms}
            disabled={loading}
          />
        </div>
      );
    }

    return null;
  };

  if (!smsProfile) return null;

  return (
    <div className="bg-card rounded-2xl shadow-md border border-border p-6 mt-6">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Alerts & Notifications</h2>
      </div>

      {/* ROW 1 — Email */}
      <div className="flex items-center justify-between py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">Weekly Email Digest</p>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">Free</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Monday morning watering summary</p>
          </div>
        </div>
        <Switch
          checked={emailDigestEnabled}
          onCheckedChange={(val) => setEmailDigestEnabled(val)}
        />
      </div>

      {/* ROW 2 — SMS */}
      <div className="py-3">
        {renderSmsSection()}
      </div>
    </div>
  );
};

export default NotificationsCard;
