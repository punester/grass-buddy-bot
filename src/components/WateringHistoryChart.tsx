import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  ComposedChart,
  Bar,
  Cell,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { Droplets } from 'lucide-react';

interface HistoryRow {
  date: string;
  recommendation: string | null;
  alert_type: string | null;
  deficit: number | null;
  et_loss_7d: number | null;
  rain_5d: number | null;
  forecast_5d: number | null;
}

interface ChartDataPoint {
  date: string;
  label: string;
  netBalance: number;
  recommendation: string;
  alertType: string | null;
  rain5d: number;
  etLoss7d: number;
}

const DOT_COLORS: Record<string, string> = {
  WATER: '#dc2626',
  MONITOR: '#d97706',
  SKIP: '#16a34a',
  FROST_INCOMING: '#3b82f6',
  DORMANCY_START: '#6b7280',
  DORMANCY_END: '#6b7280',
};

const REC_LABELS: Record<string, string> = {
  WATER: '💧 Water',
  MONITOR: '⚠️ Monitor',
  SKIP: '✅ Skip',
};

const formatDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as ChartDataPoint;
  const recColor = DOT_COLORS[d.recommendation] || '#6b7280';

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm max-w-[200px]">
      <p className="font-semibold text-foreground mb-1">{formatDate(d.date)}</p>
      <p style={{ color: recColor }} className="font-medium mb-1.5">
        {REC_LABELS[d.recommendation] || d.recommendation}
      </p>
      <div className="space-y-0.5 text-muted-foreground text-xs">
        <p>Rain received: {d.rain5d.toFixed(2)}"</p>
        <p>Evaporated (ET): {d.etLoss7d.toFixed(2)}"</p>
        <p>Net balance: {d.netBalance >= 0 ? '+' : ''}{d.netBalance.toFixed(2)}"</p>
        {d.alertType && <p className="text-blue-500 mt-1">Alert: {d.alertType.replace(/_/g, ' ')}</p>}
      </div>
    </div>
  );
};

const WateringHistoryChart: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().slice(0, 10);

      const { data: rows } = await supabase
        .from('recommendation_history' as any)
        .select('date, recommendation, alert_type, deficit, et_loss_7d, rain_5d, forecast_5d')
        .eq('user_id', user.id)
        .gte('date', dateStr)
        .order('date', { ascending: true });

      if (rows && rows.length > 0) {
        setData(
          (rows as unknown as HistoryRow[]).map((r) => ({
            date: r.date,
            label: formatDate(r.date),
            netBalance: (r.rain_5d ?? 0) - (r.et_loss_7d ?? 0),
            recommendation: r.recommendation || 'SKIP',
            alertType: r.alert_type,
            rain5d: r.rain_5d ?? 0,
            etLoss7d: r.et_loss_7d ?? 0,
          }))
        );
      }
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="bg-card rounded-2xl shadow-md border border-border p-6 mt-6 text-center">
        <p className="text-sm text-muted-foreground">Loading history…</p>
      </div>
    );
  }

  if (data.length < 3) {
    return (
      <div className="bg-card rounded-2xl shadow-md border border-border p-6 mt-6">
        <div className="flex items-center gap-2 mb-2">
          <Droplets className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">History Building</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Your 30-day watering history will appear here. Check back tomorrow — we track every recommendation automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl shadow-md border border-border p-6 mt-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">30-Day Water Balance</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Green bars = surplus · Red bars = deficit · Dots show daily recommendation
          </p>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap mt-1">Last 30 days</span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -16 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            interval={Math.max(0, Math.ceil(data.length / 6) - 1)}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            label={{ value: 'inches', angle: -90, position: 'insideLeft', offset: 20, style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
          <ReferenceLine
            y={-0.5}
            stroke="#dc2626"
            strokeDasharray="4 4"
            strokeWidth={1}
            label={{ value: 'Water threshold', position: 'right', style: { fontSize: 10, fill: '#dc2626' } }}
          />
          <Bar dataKey="netBalance" radius={[2, 2, 0, 0]} maxBarSize={14}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.netBalance >= 0 ? '#16a34a' : '#dc2626'} fillOpacity={0.75} />
            ))}
          </Bar>
          {/* Recommendation dots as a line with no stroke */}
          <Line
            dataKey={() => null}
            stroke="none"
            dot={({ cx, cy, index }: any) => {
              if (cx == null || index == null) return <></>;
              const pt = data[index];
              if (!pt) return <></>;
              const color = DOT_COLORS[pt.alertType || pt.recommendation] || DOT_COLORS[pt.recommendation] || '#6b7280';
              return <circle key={index} cx={cx} cy={12} r={4} fill={color} />;
            }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 justify-center">
        {[
          { label: 'Water', color: '#dc2626' },
          { label: 'Monitor', color: '#d97706' },
          { label: 'Skip', color: '#16a34a' },
          { label: 'Frost', color: '#3b82f6' },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default WateringHistoryChart;
