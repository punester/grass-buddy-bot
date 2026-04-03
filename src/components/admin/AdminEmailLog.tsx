import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Json } from '@/integrations/supabase/types';

interface EmailLog {
  id: string;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  metadata: Json | null;
  created_at: string;
  message_id: string | null;
}

const PAGE_SIZE = 25;

const AdminEmailLog = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [templates, setTemplates] = useState<string[]>([]);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    setPage(0);
  }, [templateFilter, statusFilter]);

  useEffect(() => {
    fetchLogs();
  }, [page, templateFilter, statusFilter]);

  const fetchTemplates = async () => {
    const { data } = await supabase
      .from('email_send_log')
      .select('template_name');
    if (data) {
      const unique = [...new Set(data.map((r) => r.template_name))].sort();
      setTemplates(unique);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('email_send_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (templateFilter !== 'all') {
        query = query.eq('template_name', templateFilter);
      }
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      setLogs((data as EmailLog[]) || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error('Error fetching email logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
      sent: 'default',
      pending: 'secondary',
      failed: 'destructive',
      dlq: 'destructive',
      suppressed: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const MetadataDialog = ({ log }: { log: EmailLog }) => {
    const meta = log.metadata as Record<string, unknown> | null;
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-xs">
            Details
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {log.template_name} → {log.recipient_email}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Status:</span>{' '}
                {statusBadge(log.status)}
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Sent:</span>{' '}
                {new Date(log.created_at).toLocaleString()}
              </div>
              {log.message_id && (
                <div>
                  <span className="font-medium text-muted-foreground">Message ID:</span>{' '}
                  <code className="text-xs bg-muted px-1 rounded">{log.message_id}</code>
                </div>
              )}
              {log.error_message && (
                <div>
                  <span className="font-medium text-muted-foreground">Error:</span>{' '}
                  <span className="text-destructive">{log.error_message}</span>
                </div>
              )}
              {meta && (
                <div>
                  <span className="font-medium text-muted-foreground">Metadata:</span>
                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(meta, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Send Log
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <Select value={templateFilter} onValueChange={setTemplateFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All templates" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All templates</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="dlq">DLQ</SelectItem>
              <SelectItem value="suppressed">Suppressed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <span className="text-sm text-muted-foreground ml-auto">
            {totalCount} total
          </span>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {loading ? 'Loading...' : 'No emails found'}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.template_name}</TableCell>
                    <TableCell className="text-sm">{log.recipient_email}</TableCell>
                    <TableCell>{statusBadge(log.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(log.created_at)}</TableCell>
                    <TableCell><MetadataDialog log={log} /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline" size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline" size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminEmailLog;
