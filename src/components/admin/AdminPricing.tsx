import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const AdminPricing = () => {
  const [price, setPrice] = useState('24');
  const [publicEmail, setPublicEmail] = useState('hello@thirstygrass.com');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['annual_price_usd', 'public_contact_email']);
      if (data) {
        for (const row of data) {
          if (row.key === 'annual_price_usd') setPrice(row.value);
          if (row.key === 'public_contact_email') setPublicEmail(row.value);
        }
      }
    };
    fetch();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const now = new Date().toISOString();

    const { error: priceErr } = await supabase
      .from('app_settings')
      .update({ value: price, updated_at: now })
      .eq('key', 'annual_price_usd');

    const { error: emailErr } = await supabase
      .from('app_settings')
      .update({ value: publicEmail, updated_at: now })
      .eq('key', 'public_contact_email');

    if (priceErr || emailErr) {
      toast.error('Failed to save settings');
    } else {
      toast.success('Settings updated');
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">App Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Annual Price (USD)
          </label>
          <input
            type="number"
            min="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full max-w-[200px] px-4 py-2 rounded-lg border border-input bg-background text-foreground"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            Public Contact Email
          </label>
          <input
            type="email"
            value={publicEmail}
            onChange={(e) => setPublicEmail(e.target.value)}
            className="w-full max-w-[360px] px-4 py-2 rounded-lg border border-input bg-background text-foreground"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Shown on Privacy, Terms, Contact pages, and Footer. Admin email (admin@110labs.com) is separate.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminPricing;
