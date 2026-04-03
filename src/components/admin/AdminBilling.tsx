import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const AdminBilling = () => {
  const [paidCount, setPaidCount] = useState(0);
  const [freeCount, setFreeCount] = useState(0);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCounts();
  }, []);

  const loadCounts = async () => {
    const { data: profiles } = await supabase.from('profiles').select('tier');
    if (profiles) {
      setPaidCount(profiles.filter(p => p.tier === 'paid').length);
      setFreeCount(profiles.filter(p => p.tier === 'free').length);
    }
  };

  const updateTierByEmail = async (tier: string) => {
    if (!email.trim()) {
      toast.error('Please enter an email');
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .update({ tier })
      .eq('email', email.trim())
      .select();

    if (error) {
      toast.error('Failed to update: ' + error.message);
    } else if (!data || data.length === 0) {
      toast.error('No user found with that email');
    } else {
      toast.success(`User ${tier === 'paid' ? 'upgraded to paid' : 'downgraded to free'}`);
      setEmail('');
      loadCounts();
    }
    setIsLoading(false);
  };

  const arr = paidCount * 24;

  return (
    <div className="space-y-6">
      {/* Metric strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Paid users</p>
          <p className="text-2xl font-bold text-foreground">{paidCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">ARR</p>
          <p className="text-2xl font-bold text-foreground">${arr.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Free users</p>
          <p className="text-2xl font-bold text-foreground">{freeCount}</p>
        </Card>
      </div>

      {/* Manual override */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Manual Tier Override</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="User email..."
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="flex-1"
          />
          <Button
            onClick={() => updateTierByEmail('paid')}
            disabled={isLoading}
            className="bg-[#16a34a] hover:bg-[#16a34a]/90 text-white"
          >
            Upgrade to Paid
          </Button>
          <Button
            variant="outline"
            onClick={() => updateTierByEmail('free')}
            disabled={isLoading}
          >
            Downgrade to Free
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default AdminBilling;
