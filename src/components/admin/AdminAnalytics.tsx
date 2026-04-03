import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DailyCount {
  date: string;
  count: number;
}

interface TopZip {
  zip_code: string;
  count: number;
}

interface RecDist {
  recommendation: string;
  count: number;
}

const AdminAnalytics = () => {
  const [lookupsToday, setLookupsToday] = useState(0);
  const [uniqueZipsToday, setUniqueZipsToday] = useState(0);
  const [signupsThisWeek, setSignupsThisWeek] = useState(0);
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([]);
  const [topZips, setTopZips] = useState<TopZip[]>([]);
  const [recDist, setRecDist] = useState<RecDist[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Lookups today
    const { data: todayLookups } = await supabase
      .from('zip_lookup_log')
      .select('id, zip_code')
      .gte('created_at', todayISO);

    if (todayLookups) {
      setLookupsToday(todayLookups.length);
      const uniqueZips = new Set(todayLookups.map(r => r.zip_code));
      setUniqueZipsToday(uniqueZips.size);
    }

    // Signups this week
    const { data: weekProfiles } = await supabase
      .from('profiles')
      .select('id')
      .gte('created_at', weekAgo);
    setSignupsThisWeek(weekProfiles?.length ?? 0);

    // Daily counts for last 7 days
    const { data: allLogs } = await supabase
      .from('zip_lookup_log')
      .select('created_at, recommendation')
      .gte('created_at', weekAgo);

    if (allLogs) {
      // Group by day
      const byDay: Record<string, number> = {};
      const recCounts: Record<string, number> = { WATER: 0, MONITOR: 0, SKIP: 0 };

      allLogs.forEach(log => {
        const day = new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        byDay[day] = (byDay[day] || 0) + 1;
        if (log.recommendation in recCounts) {
          recCounts[log.recommendation]++;
        }
      });

      // Fill last 7 days
      const days: DailyCount[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        days.push({ date: label, count: byDay[label] || 0 });
      }
      setDailyCounts(days);
      setRecDist(Object.entries(recCounts).map(([recommendation, count]) => ({ recommendation, count })));
    }

    // Top 5 ZIPs (all time)
    const { data: allZipLogs } = await supabase
      .from('zip_lookup_log')
      .select('zip_code');

    if (allZipLogs) {
      const zipCounts: Record<string, number> = {};
      allZipLogs.forEach(r => {
        zipCounts[r.zip_code] = (zipCounts[r.zip_code] || 0) + 1;
      });
      const sorted = Object.entries(zipCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([zip_code, count]) => ({ zip_code, count }));
      setTopZips(sorted);
    }
  };

  const maxZipCount = topZips.length > 0 ? topZips[0].count : 1;
  const maxRecCount = Math.max(...recDist.map(r => r.count), 1);

  const recColors: Record<string, string> = {
    WATER: '#dc2626',
    MONITOR: '#d97706',
    SKIP: '#16a34a',
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">ZIP lookups today</p>
          <p className="text-2xl font-bold text-foreground">{lookupsToday}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Unique ZIPs today</p>
          <p className="text-2xl font-bold text-foreground">{uniqueZipsToday}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Signups this week</p>
          <p className="text-2xl font-bold text-foreground">{signupsThisWeek}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Cache hit rate</p>
          <p className="text-2xl font-bold text-foreground">—</p>
        </Card>
      </div>

      {/* Bar Chart */}
      <Card className="p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Daily ZIP Lookups (Last 7 Days)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyCounts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Bottom cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top 5 ZIPs */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Top 5 ZIPs (All Time)</h3>
          <div className="space-y-3">
            {topZips.map((z, i) => (
              <div key={z.zip_code} className="flex items-center gap-3">
                <span className="text-sm font-mono text-muted-foreground w-6">#{i + 1}</span>
                <span className="text-sm font-medium text-foreground w-16">{z.zip_code}</span>
                <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(z.count / maxZipCount) * 100}%`,
                      backgroundColor: '#16a34a',
                    }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-8 text-right">{z.count}</span>
              </div>
            ))}
            {topZips.length === 0 && (
              <p className="text-sm text-muted-foreground">No data yet</p>
            )}
          </div>
        </Card>

        {/* Recommendation Distribution */}
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Recommendation Distribution</h3>
          <div className="space-y-3">
            {recDist.map(r => (
              <div key={r.recommendation} className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground w-20">{r.recommendation}</span>
                <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(r.count / maxRecCount) * 100}%`,
                      backgroundColor: recColors[r.recommendation] || '#888',
                    }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-8 text-right">{r.count}</span>
              </div>
            ))}
            {recDist.length === 0 && (
              <p className="text-sm text-muted-foreground">No data yet</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminAnalytics;
