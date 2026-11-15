"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TACTICAL_TOOLTIP_STYLE } from '@/lib/chartTheme';

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
            <stop offset="5%" stopColor="#4cd7f6" stopOpacity={0.6}/>
            <stop offset="95%" stopColor="#4cd7f6" stopOpacity={0.02}/>
          </linearGradient>
          <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#57ec7f" stopOpacity={0.6}/>
            <stop offset="95%" stopColor="#57ec7f" stopOpacity={0.02}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
        <XAxis 
          dataKey="year" 
          stroke="#64748b" 
          fontSize={11} 
          tickLine={false} 
          axisLine={false} 
          tick={{ fill: '#d1c6ab', fontFamily: 'monospace' }}
        />
        <YAxis 
          stroke="#64748b" 
          fontSize={11} 
          tickLine={false} 
          axisLine={false} 
          tick={{ fill: '#d1c6ab', fontFamily: 'monospace' }}
          tickFormatter={(value) => Number(value || 0).toLocaleString()} 
        />
        <Tooltip
          cursor={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '3 3' }}
          contentStyle={TACTICAL_TOOLTIP_STYLE}
          labelStyle={{ color: '#facc15', fontSize: '12px', fontWeight: 'bold' }}
          itemStyle={{ fontSize: '12px', fontWeight: 600, color: '#dee2ec' }}
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
          wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', color: '#dee2ec' }} 
        />
        <Area 
          type="monotone" 
          dataKey="inbound" 
          name="Inbound (รับเข้า)"
          stroke="#57ec7f"
          strokeWidth={2.5}
          fillOpacity={1} 
          fill="url(#colorInbound)" 
        />
        <Area 
          type="monotone" 
          dataKey="outbound" 
          name="Outbound (จ่ายออก)"
          stroke="#4cd7f6"
          strokeWidth={2.5}
          fillOpacity={1} 
          fill="url(#colorOutbound)" 
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
