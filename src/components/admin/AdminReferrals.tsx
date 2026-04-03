import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp, AlertTriangle, Shield, ShieldOff } from 'lucide-react';

interface ReferralRow {
  id: string;
  referrer_id: string;
  referred_id: string;
  created_at: string;
  fraud_suspected: boolean;
  fraud_evidence: any;
  counted: boolean;
  referrer_email?: string;
  referred_email?: string;
}

const AdminReferrals = () => {
  const [settings, setSettings] = useState({
    referral_program_active: 'true',
    referral_threshold: '2',
    referral_offer_expires: '2026-12-31',
  });
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
    loadReferrals();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['referral_program_active', 'referral_threshold', 'referral_offer_expires']);
    if (data) {
      const s: any = { ...settings };
      data.forEach(r => { s[r.key] = r.value; });
      setSettings(s);
    }
  };

  const loadReferrals = async () => {
    const { data } = await supabase
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false });

    if (!data) return;

    // Fetch emails for all referrer/referred IDs
    const ids = [...new Set(data.flatMap(r => [r.referrer_id, r.referred_id]))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', ids);

    const emailMap = new Map(profiles?.map(p => [p.id, p.email]) ?? []);

    setReferrals(data.map(r => ({
      ...r,
      referrer_email: emailMap.get(r.referrer_id) || '—',
      referred_email: emailMap.get(r.referred_id) || '—',
    })));
  };

  const saveSettings = async () => {
    setSaving(true);
    for (const [key, value] of Object.entries(settings)) {
      await supabase
        .from('app_settings')
        .update({ value, updated_at: new Date().toISOString() })
        .eq('key', key);
    }
    setSaving(false);
    toast.success('Referral settings saved');
  };

  const toggleFraud = async (id: string, markFraud: boolean) => {
    await supabase
      .from('referrals')
      .update({ fraud_suspected: markFraud, counted: !markFraud })
      .eq('id', id);
    setReferrals(prev => prev.map(r =>
      r.id === id ? { ...r, fraud_suspected: markFraud, counted: !markFraud } : r
    ));
    toast.success(markFraud ? 'Marked as fraud' : 'Fraud flag cleared');
  };

  const toggleCounted = async (id: string, counted: boolean) => {
    await supabase
      .from('referrals')
      .update({ counted })
      .eq('id', id);
    setReferrals(prev => prev.map(r =>
      r.id === id ? { ...r, counted } : r
    ));
  };

  return (
    <div className="space-y-6">
      {/* Settings Panel */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">Referral Program Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="program-active">Referral Program</Label>
            <Switch
              id="program-active"
              checked={settings.referral_program_active === 'true'}
              onCheckedChange={(v) => setSettings(s => ({ ...s, referral_program_active: v ? 'true' : 'false' }))}
            />
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="threshold" className="shrink-0">Threshold</Label>
            <Input
              id="threshold"
              type="number"
              min={1}
              value={settings.referral_threshold}
              onChange={e => setSettings(s => ({ ...s, referral_threshold: e.target.value }))}
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">referrals needed</span>
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="expires" className="shrink-0">Offer Expires</Label>
            <Input
              id="expires"
              type="date"
              value={settings.referral_offer_expires}
              onChange={e => setSettings(s => ({ ...s, referral_offer_expires: e.target.value }))}
              className="w-48"
            />
          </div>
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </Card>

      {/* Referrals Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Referred User</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Referred By</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Counted</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Fraud</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map(r => (
                <React.Fragment key={r.id}>
                  <tr
                    className={`border-b cursor-pointer transition-colors ${r.fraud_suspected ? 'bg-amber-50 dark:bg-amber-950/20' : 'hover:bg-muted/30'}`}
                    onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  >
                    <td className="p-3 text-foreground">{r.referred_email}</td>
                    <td className="p-3 text-foreground">{r.referrer_email}</td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3">
                      <button
                        onClick={e => { e.stopPropagation(); toggleCounted(r.id, !r.counted); }}
                        className="text-sm"
                      >
                        <Badge variant={r.counted ? 'default' : 'secondary'}>
                          {r.counted ? 'Yes' : 'No'}
                        </Badge>
                      </button>
                    </td>
                    <td className="p-3">
                      {r.fraud_suspected && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Suspected
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!r.fraud_suspected ? (
                          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); toggleFraud(r.id, true); }}>
                            <ShieldOff className="h-3.5 w-3.5 mr-1" /> Mark fraud
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); toggleFraud(r.id, false); }}>
                            <Shield className="h-3.5 w-3.5 mr-1" /> Clear flag
                          </Button>
                        )}
                        {expandedId === r.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </td>
                  </tr>
                  {expandedId === r.id && r.fraud_evidence && (
                    <tr className="bg-muted/20">
                      <td colSpan={6} className="p-4">
                        <p className="text-sm font-medium text-foreground mb-2">Fraud Evidence</p>
                        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-2">
                          <span>IP match: {r.fraud_evidence.ip_match ? 'Yes' : 'No'}</span>
                          <span>·</span>
                          <span>Device match: {r.fraud_evidence.device_match ? 'Yes' : 'No'}</span>
                          <span>·</span>
                          <span>Browser match: {r.fraud_evidence.browser_match ? 'Yes' : 'No'}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <div>Referred IP: {r.fraud_evidence.referred_ip || '—'}</div>
                          <div>Referrer IP: {r.fraud_evidence.referrer_ip || '—'}</div>
                          <div>Referred device: <span className="font-mono">{r.fraud_evidence.referred_device?.slice(0, 24) || '—'}</span></div>
                          <div>Referrer device: <span className="font-mono">{r.fraud_evidence.referrer_device?.slice(0, 24) || '—'}</span></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {referrals.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">No referrals yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AdminReferrals;
