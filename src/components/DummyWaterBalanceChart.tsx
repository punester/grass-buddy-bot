import React from 'react';
import {
  ComposedChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';

// Realistic-looking fake data for 30 days
const DUMMY_DATA = [
  { label: 'Mar 7', v: 0.3 }, { label: '', v: -0.15 }, { label: '', v: -0.4 },
  { label: '', v: -0.6 }, { label: 'Mar 12', v: 0.8 }, { label: '', v: 0.5 },
  { label: '', v: 0.1 }, { label: '', v: -0.2 }, { label: '', v: -0.35 },
  { label: 'Mar 17', v: -0.55 }, { label: '', v: 1.2 }, { label: '', v: 0.7 },
  { label: '', v: 0.3 }, { label: '', v: 0.05 }, { label: 'Mar 22', v: -0.1 },
  { label: '', v: -0.3 }, { label: '', v: -0.45 }, { label: '', v: 0.6 },
  { label: '', v: 0.4 }, { label: 'Mar 27', v: 0.15 }, { label: '', v: -0.2 },
  { label: '', v: -0.5 }, { label: '', v: -0.7 }, { label: '', v: 0.9 },
  { label: 'Apr 1', v: 0.55 }, { label: '', v: 0.2 }, { label: '', v: -0.1 },
  { label: '', v: -0.35 }, { label: '', v: -0.5 }, { label: 'Apr 6', v: 0.3 },
];

const DummyWaterBalanceChart: React.FC = () => {
  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">30-Day Water Balance</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Green bars = surplus · Red bars = deficit
          </p>
        </div>
        <span className="text-xs text-muted-foreground mt-1">Last 30 days</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={DUMMY_DATA} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            tickLine={false}
            axisLine={false}
          />
          <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} />
          <ReferenceLine y={-0.5} stroke="#dc2626" strokeDasharray="4 4" strokeWidth={1} />
          <Bar dataKey="v" radius={[2, 2, 0, 0]} maxBarSize={12}>
            {DUMMY_DATA.map((entry, i) => (
              <Cell key={i} fill={entry.v >= 0 ? '#16a34a' : '#dc2626'} fillOpacity={0.6} />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DummyWaterBalanceChart;
