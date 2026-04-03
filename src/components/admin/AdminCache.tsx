import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { fetchPrecipitationData } from '@/utils/weatherApi';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

interface CacheRow {
  zip_code: string;
  weather_data: Record<string, unknown>;
  cached_at: string;
  lookup_count: number;
}

type FilterType = 'all' | 'fresh' | 'stale';

const AdminCache = () => {
  const [rows, setRows] = useState<CacheRow[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshingZip, setRefreshingZip] = useState<string | null>(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  useEffect(() => {
    loadCache();
  }, []);

  const loadCache = async () => {
    const { data } = await supabase
      .from('zip_cache')
      .select('*')
      .order('cached_at', { ascending: false });
    if (data) setRows(data as unknown as CacheRow[]);
  };

  const isFresh = (cachedAt: string) => {
    return (Date.now() - new Date(cachedAt).getTime()) < 24 * 60 * 60 * 1000;
  };

  const filteredRows = rows.filter(r => {
    if (filter === 'fresh') return isFresh(r.cached_at);
    if (filter === 'stale') return !isFresh(r.cached_at);
    return true;
  });

  const cachedCount = rows.length;
  const freshCount = rows.filter(r => isFresh(r.cached_at)).length;
  const staleCount = cachedCount - freshCount;
  const totalLookups = rows.reduce((sum, r) => sum + r.lookup_count, 0);

  const refreshZip = async (zip: string) => {
    setRefreshingZip(zip);
    try {
      // Delete the cache row
      await supabase.from('zip_cache').delete().eq('zip_code', zip);
      // Re-fetch
      await fetchPrecipitationData(zip);
      await loadCache();
      toast.success(`Refreshed cache for ${zip}`);
    } catch {
      toast.error(`Failed to refresh ${zip}`);
    }
    setRefreshingZip(null);
  };

  const refreshAllStale = async () => {
    setRefreshingAll(true);
    const staleRows = rows.filter(r => !isFresh(r.cached_at));
    for (const row of staleRows) {
      try {
        await supabase.from('zip_cache').delete().eq('zip_code', row.zip_code);
        await fetchPrecipitationData(row.zip_code);
      } catch {
        // continue
      }
    }
    await loadCache();
    toast.success(`Refreshed ${staleRows.length} stale entries`);
    setRefreshingAll(false);
  };

  const getRecommendation = (wd: Record<string, unknown>): string => {
    return (wd as { recommendation?: string }).recommendation || '—';
  };

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Cached ZIPs</p>
          <p className="text-2xl font-bold text-foreground">{cachedCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Fresh entries</p>
          <p className="text-2xl font-bold text-foreground">{freshCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Stale entries</p>
          <p className="text-2xl font-bold text-foreground">{staleCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total cache lookups</p>
          <p className="text-2xl font-bold text-foreground">{totalLookups}</p>
        </Card>
      </div>

      {/* Filter pills + refresh all */}
      <div className="flex items-center gap-3 flex-wrap">
        {(['all', 'fresh', 'stale'] as FilterType[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        {staleCount > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={refreshAllStale}
            disabled={refreshingAll}
            className="ml-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${refreshingAll ? 'animate-spin' : ''}`} />
            Refresh all stale
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">ZIP</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Last Fetched</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Recommendation</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Lookups</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(r => {
                const fresh = isFresh(r.cached_at);
                return (
                  <tr key={r.zip_code} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-foreground">{r.zip_code}</td>
                    <td className="p-3 text-muted-foreground">{new Date(r.cached_at).toLocaleString()}</td>
                    <td className="p-3 hidden md:table-cell">
                      <Badge variant={fresh ? 'default' : 'secondary'}>
                        {getRecommendation(r.weather_data)}
                      </Badge>
                    </td>
                    <td className="p-3 text-foreground">{r.lookup_count}</td>
                    <td className="p-3">
                      <Badge variant={fresh ? 'default' : 'destructive'} className={fresh ? 'bg-[#16a34a]' : ''}>
                        {fresh ? 'Fresh' : 'Stale'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => refreshZip(r.zip_code)}
                        disabled={refreshingZip === r.zip_code}
                      >
                        <RefreshCw className={`h-4 w-4 ${refreshingZip === r.zip_code ? 'animate-spin' : ''}`} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">No cache entries</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AdminCache;
