"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TACTICAL_TOOLTIP_STYLE } from '@/lib/chartTheme';

const WaterfallChart = ({ data }: { data: any[] }) => {
  // Config for tactical waterfall coloring
  const getBarColor = (name: string, value: number) => {
    if (name === 'Opening') return '#8a92a6'; // Neutral Steel Baseline
    if (name === 'Inbound') return '#57ec7f'; // Tactical Emerald
    if (name === 'Outbound') return '#4cd7f6'; // Telemetry Cyan
    if (name === 'Damage') return '#ff5449'; // Signal Rose
    if (name === 'Closing') return '#facc15'; // Tactical Gold Final Balance
    if (value < 0) return '#ff5449'; // Fallback negative
    return '#57ec7f'; // Fallback positive
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 15, right: 30, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
        <XAxis 
          dataKey="name" 
          stroke="#64748b" 
          fontSize={10} 
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#d1c6ab', fontFamily: 'monospace' }}
        />
        <YAxis 
          stroke="#64748b" 
          fontSize={10} 
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#d1c6ab', fontFamily: 'monospace' }}
          tickFormatter={(val) => Number(val || 0).toLocaleString()}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
          contentStyle={TACTICAL_TOOLTIP_STYLE}
          labelStyle={{ color: '#facc15', fontSize: '12px', fontWeight: 'bold' }}
          itemStyle={{ color: '#dee2ec', fontFamily: 'monospace' }}
          formatter={(value: any, name: any, item: any) => {
            const rawVal = item?.payload?.rawDiff ?? item?.payload?.barValue ?? value;
            const sign = Number(rawVal) > 0 ? '+' : '';
            return [`${sign}${Number(rawVal).toLocaleString()} ชิ้น`, 'ปริมาณ'];
          }}
        />
        <Bar dataKey="value" stackId="a" fill="transparent" />
        <Bar dataKey="barValue" stackId="a" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getBarColor(entry.name, entry.barValue)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default WaterfallChart;
