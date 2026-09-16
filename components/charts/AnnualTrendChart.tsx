"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
          top: 20,
          right: 30,
          left: 0,
          bottom: 5,
        }}
      >
        <defs>
          <linearGradient id="colorOutbound" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorInbound" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
        <XAxis 
          dataKey="year" 
          stroke="#64748b" 
          fontSize={11} 
          tickLine={false} 
          axisLine={false} 
          tick={{ fill: '#d1c6ab' }}
        />
        <YAxis 
          stroke="#64748b" 
          fontSize={11} 
          tickLine={false} 
          axisLine={false} 
          tick={{ fill: '#d1c6ab' }}
          tickFormatter={(value) => `${value}`} 
        />
        <Tooltip
          cursor={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '3 3' }}
          contentStyle={{
            backgroundColor: '#171c23',
            border: '1px solid #30353d',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
            color: '#dee2ec'
          }}
          itemStyle={{ fontSize: '12px', fontWeight: 600, color: '#dee2ec' }}
          formatter={(value: any, name: any) => [value?.toLocaleString() || '0', name === 'inbound' ? 'Inbound' : 'Outbound'] as [string, string]}
        />
        <Area 
          type="monotone" 
          dataKey="inbound" 
          name="inbound"
          stroke="#10b981" // Emerald-500
          strokeWidth={3}
          fillOpacity={1} 
          fill="url(#colorInbound)" 
        />
        <Area 
          type="monotone" 
          dataKey="outbound" 
          name="outbound"
          stroke="#8b5cf6" // Violet-500
          strokeWidth={3}
          fillOpacity={1} 
          fill="url(#colorOutbound)" 
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
