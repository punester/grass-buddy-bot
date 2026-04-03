import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Mail, RefreshCw, Send, Clock, Database, Users } from 'lucide-react';
import AdminEmailLog from './AdminEmailLog';

const AdminEmailSystem = () => {
  const [loading, setLoading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testZip, setTestZip] = useState('');
  const [stats, setStats] = useState<{
    cachedZips: number;
    lastUpdated: string | null;
    eligibleUsers: number;
  }>({ cachedZips: 0, lastUpdated: null, eligibleUsers: 0 });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Count cached ZIPs and get latest update
      const { data: cacheData, error: cacheErr } = await supabase
        .from('zip_cache')
        .select('last_updated')
        .not('last_updated', 'is', null)
        .order('last_updated', { ascending: false })
        .limit(1);

      const { count: zipCount } = await supabase
        .from('zip_cache')
        .select('zip_code', { count: 'exact', head: true });

      // Count eligible users (have email + zip_code, not unsubscribed)
      const { count: userCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .not('zip_code', 'is', null)
        .not('email', 'is', null)
        .or('email_unsubscribed.is.null,email_unsubscribed.eq.false');

      setStats({
        cachedZips: zipCount || 0,
        lastUpdated: cacheData?.[0]?.last_updated || null,
        eligibleUsers: userCount || 0,
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const runJob = async (forceEmail: boolean, zip?: string) => {
    const setter = forceEmail ? setSendingTest : setLoading;
    setter(true);
    try {
      const body: Record<string, unknown> = {};
      if (forceEmail) body.forceEmail = true;
      if (zip) body.testZip = zip;

      const { data, error } = await supabase.functions.invoke('daily-weather-job', {
        body,
      });

      if (error) throw error;

      const result = data as Record<string, unknown>;
      if (forceEmail) {
        toast.success(
          `Test emails sent: ${result.emailsSent || 0} sent, ${result.emailErrors || 0} errors`
        );
      } else {
        toast.success(
          `Cache refresh complete: ${result.zipsProcessed || 0} ZIPs processed`
        );
      }
      fetchStats();
    } catch (err) {
      toast.error(`Job failed: ${(err as Error).message}`);
    } finally {
      setter(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Weekly Email Digest
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Last Run</p>
                <p className="text-sm font-medium">{formatDate(stats.lastUpdated)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Database className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">ZIPs Cached</p>
                <p className="text-sm font-medium">{stats.cachedZips}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Monday Recipients</p>
                <p className="text-sm font-medium">{stats.eligibleUsers}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Cache Refresh</h3>
              <Button
                variant="outline"
                onClick={() => runJob(false)}
                disabled={loading || sendingTest}
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Run Job Now
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Refreshes weather cache for all ZIPs. Emails only sent on Mondays.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Send Test Email</h3>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="ZIP code (e.g. 01545)"
                  value={testZip}
                  onChange={(e) => setTestZip(e.target.value)}
                  className="max-w-[200px]"
                />
                <Button
                  variant="outline"
                  onClick={() => runJob(true, testZip || undefined)}
                  disabled={loading || sendingTest}
                >
                  {sendingTest ? (
                    <Send className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Test
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Sends digest to all users in the specified ZIP (or all users if blank). Skips Monday check.
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground border-t pt-4">
            Cron schedule: Daily at 11:00 UTC (7am ET). Emails sent on Mondays only via Resend.
          </p>
        </CardContent>
      </Card>
      <AdminEmailLog />
    </div>
  );
};

export default AdminEmailSystem;
