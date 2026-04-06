import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── SMS Logs Sub-Tab ───────────────────────────────────────

interface SmsLog {
  id: string;
  user_id: string;
  alert_type: string;
  message_body: string;
  status: string;
  error_message: string | null;
  twilio_sid: string | null;
  created_at: string;
  user_email?: string;
}

const ALERT_TYPES = ['All', 'WATER', 'MONITOR', 'SKIP', 'DORMANCY_START', 'DORMANCY_END', 'FROST_INCOMING', 'OPT_IN_CONFIRM', 'TEST'];
const STATUS_OPTIONS = ['All', 'sent', 'failed', 'skipped'];

const SmsLogsTab = () => {
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertFilter, setAlertFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [userSearch, setUserSearch] = useState('');
  const [dateFrom, setDateFrom] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d;
  });
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);

  const PAGE_SIZE = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      // Build query
      let query = supabase
        .from('sms_logs')
        .select('*', { count: 'exact' })
        .gte('created_at', dateFrom.toISOString())
        .lte('created_at', new Date(dateTo.getTime() + 86400000).toISOString())
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (alertFilter !== 'All') query = query.eq('alert_type', alertFilter);
      if (statusFilter !== 'All') query = query.eq('status', statusFilter);

      const { data, count, error } = await query;
      if (error) throw error;

      // Fetch user emails for these logs
      const userIds = [...new Set((data || []).map(l => l.user_id))];
      let emailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds);
        if (profiles) {
          emailMap = Object.fromEntries(profiles.map(p => [p.id, p.email || '']));
        }
      }

      const enriched = (data || []).map(l => ({
        ...l,
        user_email: emailMap[l.user_id] || l.user_id,
      }));

      // Client-side email filter
      if (userSearch.trim()) {
        const search = userSearch.toLowerCase();
        const filtered = enriched.filter(l => l.user_email?.toLowerCase().includes(search));
        setLogs(filtered);
        setTotalCount(filtered.length);
      } else {
        setLogs(enriched);
        setTotalCount(count || 0);
      }
    } catch (e) {
      console.error('Failed to fetch SMS logs:', e);
    } finally {
      setLoading(false);
    }
  }, [alertFilter, statusFilter, dateFrom, dateTo, page, userSearch]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const clearFilters = () => {
    setAlertFilter('All');
    setStatusFilter('All');
    setUserSearch('');
    const d = new Date(); d.setDate(d.getDate() - 7);
    setDateFrom(d);
    setDateTo(new Date());
    setPage(0);
  };

  const sentCount = logs.filter(l => l.status === 'sent').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;
  const skippedCount = logs.filter(l => l.status === 'skipped').length;

  const statusBadge = (status: string) => {
    const variant = status === 'sent' ? 'default' : status === 'failed' ? 'destructive' : 'secondary';
    return <Badge variant={variant} className="text-xs">{status}</Badge>;
  };

  const searchEmails = async (val: string) => {
    setTestEmail(val);
    if (val.length < 2) { setEmailSuggestions([]); return; }
    const { data } = await supabase.from('profiles').select('email').ilike('email', `%${val}%`).limit(5);
    setEmailSuggestions((data || []).map(p => p.email).filter(Boolean) as string[]);
  };

  const handleTestSend = async () => {
    setTestSending(true);
    setTestResult(null);
    try {
      const { data: profile } = await supabase.from('profiles').select('id').eq('email', testEmail).single();
      if (!profile) { setTestResult({ ok: false, text: '✗ User not found' }); return; }

      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: { userId: profile.id, message: testMessage, alertType: 'TEST' },
      });
      if (error) throw error;
      if (data?.status === 'sent') {
        setTestResult({ ok: true, text: `✓ Sent — Twilio SID: ${data.twilio_sid}` });
        fetchLogs();
      } else {
        setTestResult({ ok: false, text: `✗ ${data?.status || 'Failed'} — ${data?.reason || data?.error || 'Unknown'}` });
      }
    } catch (e) {
      setTestResult({ ok: false, text: `✗ Failed — ${(e as Error).message}` });
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Type</label>
          <select value={alertFilter} onChange={e => { setAlertFilter(e.target.value); setPage(0); }}
            className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm">
            {ALERT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Status</label>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
            className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm">
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">From</label>
          <Popover>
            <PopoverTrigger asChild>
              <button className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm inline-flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5" />
                {format(dateFrom, 'MMM d, yyyy')}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={d => d && setDateFrom(d)} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">To</label>
          <Popover>
            <PopoverTrigger asChild>
              <button className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm inline-flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5" />
                {format(dateTo, 'MMM d, yyyy')}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={d => d && setDateTo(d)} className={cn("p-3 pointer-events-auto")} />
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">User</label>
          <input type="text" value={userSearch} onChange={e => { setUserSearch(e.target.value); setPage(0); }}
            placeholder="Search by email" className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm w-48" />
        </div>
        <button onClick={clearFilters} className="text-sm text-primary hover:underline pb-2">Clear filters</button>
      </div>

      {/* Summary */}
      <p className="text-sm text-muted-foreground">
        Showing {logs.length} results — <span className="text-green-600">{sentCount} sent</span>, <span className="text-destructive">{failedCount} failed</span>, <span className="text-muted-foreground">{skippedCount} skipped</span>
      </p>

      {/* Test Send Panel */}
      <div className="border border-border rounded-lg">
        <button onClick={() => setShowTestPanel(!showTestPanel)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-sm font-medium text-foreground hover:bg-muted/50 rounded-lg">
          Send Test Message
          {showTestPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showTestPanel && (
          <div className="px-4 pb-4 space-y-3">
            <div className="relative">
              <input type="email" value={testEmail} onChange={e => searchEmails(e.target.value)}
                placeholder="User email" className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
              {emailSuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg">
                  {emailSuggestions.map(e => (
                    <button key={e} onClick={() => { setTestEmail(e); setEmailSuggestions([]); }}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-muted">{e}</button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <textarea value={testMessage} onChange={e => setTestMessage(e.target.value.slice(0, 160))}
                placeholder="Message (max 160 chars)" rows={2}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm resize-none" />
              <p className="text-xs text-muted-foreground text-right">{testMessage.length}/160</p>
            </div>
            <button onClick={handleTestSend} disabled={testSending || !testEmail || !testMessage}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
              {testSending ? 'Sending…' : 'Send Test SMS'}
            </button>
            {testResult && (
              <p className={`text-sm ${testResult.ok ? 'text-green-600' : 'text-destructive'}`}>{testResult.text}</p>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Timestamp</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">User</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Alert Type</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <React.Fragment key={log.id}>
                  <tr onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    className="border-t border-border hover:bg-muted/30 cursor-pointer">
                    <td className="px-4 py-2 whitespace-nowrap">{format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}</td>
                    <td className="px-4 py-2 max-w-[180px] truncate">{log.user_email}</td>
                    <td className="px-4 py-2">{log.alert_type}</td>
                    <td className="px-4 py-2">{statusBadge(log.status)}</td>
                    <td className="px-4 py-2 max-w-[200px] truncate">{log.message_body?.slice(0, 80) || '—'}{(log.message_body?.length || 0) > 80 ? '…' : ''}</td>
                  </tr>
                  {expandedId === log.id && (
                    <tr className="border-t border-border bg-muted/20">
                      <td colSpan={5} className="px-4 py-3 space-y-1">
                        <p className="text-sm"><span className="font-medium">Full message:</span> {log.message_body || '—'}</p>
                        {log.twilio_sid && <p className="text-sm"><span className="font-medium">Twilio SID:</span> {log.twilio_sid}</p>}
                        {log.error_message && <p className="text-sm text-destructive"><span className="font-medium">Error:</span> {log.error_message}</p>}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No SMS logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50">← Prev</button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {Math.ceil(totalCount / PAGE_SIZE)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= totalCount}
            className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50">Next →</button>
        </div>
      )}
    </div>
  );
};

// ─── Short Links Sub-Tab ────────────────────────────────────

interface ShortLink {
  id: string;
  code: string;
  destination_url: string;
  created_at: string;
  expires_at: string | null;
}

const ShortLinksTab = () => {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newExpiry, setNewExpiry] = useState<Date | undefined>();
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const PAGE_SIZE = 50;

  const fetchLinks = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('short_links')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, count, error } = await query;
      if (error) throw error;

      let filtered = data || [];
      const now = new Date();
      if (statusFilter === 'Active') {
        filtered = filtered.filter(l => !l.expires_at || new Date(l.expires_at) > now);
      } else if (statusFilter === 'Expired') {
        filtered = filtered.filter(l => l.expires_at && new Date(l.expires_at) <= now);
      }

      setLinks(filtered);
      setTotalCount(statusFilter === 'All' ? (count || 0) : filtered.length);
    } catch (e) {
      console.error('Failed to fetch short links:', e);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const generateCode = (): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
  };

  const handleCreate = async () => {
    if (!newUrl.trim()) return;
    setCreating(true);
    setCreateResult(null);
    try {
      for (let attempt = 0; attempt < 10; attempt++) {
        const code = generateCode();
        const { error } = await supabase.from('short_links').insert({
          code,
          destination_url: newUrl.trim(),
          expires_at: newExpiry ? newExpiry.toISOString() : null,
        });
        if (!error) {
          setCreateResult({ code });
          setNewUrl('');
          setNewExpiry(undefined);
          fetchLinks();
          return;
        }
        if (error.code !== '23505') throw error;
      }
      toast.error('Failed to generate unique code');
    } catch (e) {
      toast.error('Failed to create short link');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(`https://thirstygrass.com/r/${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isExpired = (expiresAt: string | null) => expiresAt && new Date(expiresAt) < new Date();

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Status</label>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
            className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm">
            <option value="All">All</option>
            <option value="Active">Active</option>
            <option value="Expired">Expired</option>
          </select>
        </div>
        <button onClick={() => { setStatusFilter('All'); setPage(0); }} className="text-sm text-primary hover:underline pb-2">Clear filters</button>
      </div>

      {/* Create Panel */}
      <div className="border border-border rounded-lg">
        <button onClick={() => setShowCreate(!showCreate)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-sm font-medium text-foreground hover:bg-muted/50 rounded-lg">
          Create Short Link
          {showCreate ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showCreate && (
          <div className="px-4 pb-4 space-y-3">
            <input type="url" value={newUrl} onChange={e => setNewUrl(e.target.value)}
              placeholder="https://thirstygrass.com/..." className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm" />
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Expires (optional)</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm inline-flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {newExpiry ? format(newExpiry, 'MMM d, yyyy') : 'Never'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={newExpiry} onSelect={setNewExpiry}
                    disabled={d => d < new Date()} className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              {newExpiry && <button onClick={() => setNewExpiry(undefined)} className="text-xs text-primary hover:underline ml-2">Clear</button>}
            </div>
            <button onClick={handleCreate} disabled={creating || !newUrl.trim()}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
              {creating ? 'Creating…' : 'Generate Link'}
            </button>
            {createResult && (
              <div className="flex items-center gap-2">
                <p className="text-sm text-green-600">✓ Created — thirstygrass.com/r/{createResult.code}</p>
                <button onClick={() => handleCopy(createResult.code)} className="p-1 hover:bg-muted rounded">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Code</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Destination</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Created</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Expires</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {links.map(link => (
                <tr key={link.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">thirstygrass.com/r/{link.code}</td>
                  <td className="px-4 py-2 max-w-[250px] truncate">{link.destination_url}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{format(new Date(link.created_at), 'MMM d, yyyy')}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{link.expires_at ? format(new Date(link.expires_at), 'MMM d, yyyy') : 'Never'}</td>
                  <td className="px-4 py-2">
                    {isExpired(link.expires_at)
                      ? <Badge variant="secondary" className="text-xs">Expired</Badge>
                      : <Badge variant="default" className="text-xs">Active</Badge>
                    }
                  </td>
                </tr>
              ))}
              {links.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No short links found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50">← Prev</button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {Math.ceil(totalCount / PAGE_SIZE)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= totalCount}
            className="px-3 py-1.5 text-sm border border-border rounded-lg disabled:opacity-50">Next →</button>
        </div>
      )}
    </div>
  );
};

// ─── Main Communications Component ─────────────────────────

const AdminCommunications = () => {
  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground mb-4">Communications</h2>
      <Tabs defaultValue="sms" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="sms">SMS Logs</TabsTrigger>
          <TabsTrigger value="links">Short Links</TabsTrigger>
        </TabsList>
        <TabsContent value="sms"><SmsLogsTab /></TabsContent>
        <TabsContent value="links"><ShortLinksTab /></TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminCommunications;
