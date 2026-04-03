import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface SubscriptionManagerProps {
  subscriptionCancelAtPeriodEnd: boolean;
  subscriptionEndsAt: string | null;
  onUpdate: () => void;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({
  subscriptionCancelAtPeriodEnd,
  subscriptionEndsAt,
  onUpdate,
}) => {
  const { user } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const formattedEnd = subscriptionEndsAt
    ? format(new Date(subscriptionEndsAt), 'MMMM d, yyyy')
    : null;

  const handleCancel = async () => {
    if (!user) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription', {
        body: { userId: user.id },
      });
      if (error) throw error;
      toast.success('Subscription cancellation scheduled');
      setShowConfirm(false);
      onUpdate();
    } catch (e) {
      toast.error('Failed to cancel subscription');
      console.error(e);
    } finally {
      setCancelling(false);
    }
  };

  if (subscriptionCancelAtPeriodEnd) {
    return (
      <div className="bg-card rounded-2xl shadow-md border border-border p-6 mt-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">Subscription</h2>
        <p className="text-sm text-muted-foreground">
          Pro access active until <span className="font-medium text-foreground">{formattedEnd}</span>. Your subscription will not renew.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-2xl shadow-md border border-border p-6 mt-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">Subscription</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Pro plan · Renews {formattedEnd || 'soon'}
        </p>
        <button
          onClick={() => setShowConfirm(true)}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Cancel Renewal
        </button>
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription Renewal?</DialogTitle>
            <DialogDescription>
              Are you sure? Your Pro access continues until {formattedEnd}. No refunds are issued.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Never Mind
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Yes, Cancel Renewal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SubscriptionManager;
