import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Profile {
  id: string;
  email: string | null;
  zip_code: string | null;
  grass_type: string | null;
  irrigation_type: string | null;
  tier: string;
  created_at: string;
}

const AdminUsers = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setProfiles(data);
    if (error) toast.error('Failed to load profiles');
  };

  const updateTier = async (id: string, tier: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ tier })
      .eq('id', id);
    if (error) {
      toast.error('Failed to update tier');
    } else {
      toast.success(`User ${tier === 'paid' ? 'upgraded' : 'downgraded'}`);
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, tier } : p));
    }
  };

  const filtered = profiles.filter(p => {
    const matchesSearch =
      !search ||
      (p.email?.toLowerCase().includes(search.toLowerCase())) ||
      (p.zip_code?.includes(search));
    const matchesTier = tierFilter === 'all' || p.tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by email or ZIP..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1"
        />
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Email</th>
                <th className="text-left p-3 font-medium text-muted-foreground">ZIP</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Grass Type</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Tier</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Joined</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <React.Fragment key={p.id}>
                  <tr
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  >
                    <td className="p-3 text-foreground">{p.email || '—'}</td>
                    <td className="p-3 text-foreground font-mono">{p.zip_code || '—'}</td>
                    <td className="p-3 text-foreground hidden md:table-cell">{p.grass_type || '—'}</td>
                    <td className="p-3">
                      <Badge variant={p.tier === 'paid' ? 'default' : 'secondary'}>
                        {p.tier}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {p.tier === 'free' ? (
                          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); updateTier(p.id, 'paid'); }}>
                            Upgrade
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); updateTier(p.id, 'free'); }}>
                            Downgrade
                          </Button>
                        )}
                        {expandedId === p.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </td>
                  </tr>
                  {expandedId === p.id && (
                    <tr className="bg-muted/20">
                      <td colSpan={6} className="p-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div><span className="text-muted-foreground">ID:</span> <span className="font-mono text-xs">{p.id}</span></div>
                          <div><span className="text-muted-foreground">Email:</span> {p.email || '—'}</div>
                          <div><span className="text-muted-foreground">ZIP:</span> {p.zip_code || '—'}</div>
                          <div><span className="text-muted-foreground">Grass:</span> {p.grass_type || '—'}</div>
                          <div><span className="text-muted-foreground">Irrigation:</span> {p.irrigation_type || '—'}</div>
                          <div><span className="text-muted-foreground">Tier:</span> {p.tier}</div>
                          <div><span className="text-muted-foreground">Created:</span> {new Date(p.created_at).toLocaleString()}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default AdminUsers;
