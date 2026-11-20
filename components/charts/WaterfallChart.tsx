"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { HYBRID_TOOLTIP_STYLE } from '@/lib/chartTheme';

const WaterfallChart = ({ data }: { data: any[] }) => {
  // Config for V31 waterfall coloring
  const getBarColor = (name: string, value: number) => {
    if (name === 'Opening') return '#64748b'; // Neutral Slate Baseline
    if (name === 'Inbound') return '#10b981'; // Emerald
    if (name === 'Outbound') return '#0ea5e9'; // Sky
    if (name === 'Damage') return '#ef4444'; // Rose
    if (name === 'Closing') return '#f59e0b'; // Warm Amber Final Balance
    if (value < 0) return '#ef4444'; // Fallback negative
    return '#10b981'; // Fallback positive
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 15, right: 30, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="name"
          stroke="#94a3b8"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#64748b' }}
        />
        <YAxis
          stroke="#94a3b8"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#64748b' }}
          tickFormatter={(val) => Number(val || 0).toLocaleString()}
        />
        <Tooltip
          cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
          contentStyle={HYBRID_TOOLTIP_STYLE}
          labelStyle={{ color: '#0f172a', fontSize: '12px', fontWeight: 'bold' }}
          itemStyle={{ color: '#334155' }}
          formatter={(value: any, name: any, item: any) => {
            const rawVal = item?.payload?.rawDiff ?? item?.payload?.barValue ?? value;
            const sign = Number(rawVal) > 0 ? '+' : '';
            return [`${sign}${Number(rawVal).toLocaleString()} ชิ้น`, 'ปริมาณ'];
          }}
        />
        <Bar dataKey="value" stackId="a" fill="transparent" />
        <Bar dataKey="barValue" stackId="a" radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.name, entry.barValue)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default WaterfallChart;
