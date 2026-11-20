"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { HYBRID_TOOLTIP_STYLE } from '@/lib/chartTheme';

interface AnnualTrendProps {
  data: {
    year: string;
    inbound: number;
    outbound: number;
  }[];
}

export default function AnnualTrendChart({ data }: AnnualTrendProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{
          top: 15,
          right: 30,
          left: 10,
          bottom: 5,
        }}
      >
        <defs>
          <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35}/>
            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02}/>
          </linearGradient>
          <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0.02}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="year"
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
          tickFormatter={(value) => Number(value || 0).toLocaleString()}
        />
        <Tooltip
          cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
          contentStyle={HYBRID_TOOLTIP_STYLE}
          labelStyle={{ color: '#0f172a', fontSize: '12px', fontWeight: 'bold' }}
          itemStyle={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}
          formatter={(value: any, name: any) => [
            Number(value || 0).toLocaleString(),
            name === 'inbound' ? 'Inbound (รับเข้า)' : 'Outbound (จ่ายออก)'
          ] as [string, string]}
        />
        <Legend
          verticalAlign="top"
          align="right"
          height={32}
          iconType="circle"
          wrapperStyle={{ fontSize: '12px', color: '#334155' }}
        />
        <Area
          type="monotone"
          dataKey="inbound"
          name="Inbound (รับเข้า)"
          stroke="#10b981"
          strokeWidth={2.5}
          fillOpacity={1}
          fill="url(#colorInbound)"
        />
        <Area
          type="monotone"
          dataKey="outbound"
          name="Outbound (จ่ายออก)"
          stroke="#0ea5e9"
          strokeWidth={2.5}
          fillOpacity={1}
          fill="url(#colorOutbound)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
