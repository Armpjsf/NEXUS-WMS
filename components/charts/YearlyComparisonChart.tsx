"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TACTICAL_TOOLTIP_STYLE } from '@/lib/chartTheme';

interface YearlyComparisonProps {
  data: {
    month: string;
    outYear1: number;
    outYear2: number;
    inYear1: number;
    inYear2: number;
  }[];
  year1Label?: string;
  year2Label?: string;
}

export default function YearlyComparisonChart({ data, year1Label = "This Year", year2Label = "Last Year" }: YearlyComparisonProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{
          top: 15,
          right: 30,
          left: 10,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
        <XAxis 
          dataKey="month" 
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
          cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
          contentStyle={TACTICAL_TOOLTIP_STYLE}
          labelStyle={{ color: '#facc15', fontSize: '12px', fontWeight: 'bold' }}
          itemStyle={{ color: '#dee2ec', fontSize: '12px', fontFamily: 'monospace' }}
          formatter={(value: any, name: any) => [Number(value || 0).toLocaleString(), name] as [string, string]}
        />
        <Legend 
          verticalAlign="top" 
          align="right" 
          height={36} 
          iconType="circle"
          wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', color: '#dee2ec' }}
        />
        {/* Inbound Bars */}
        <Bar 
          name={`Inbound ${year2Label}`} 
          dataKey="inYear2" 
          fill="rgba(87, 236, 127, 0.32)"
          radius={[4, 4, 0, 0]} 
          barSize={12}
        />
        <Bar 
          name={`Inbound ${year1Label}`} 
          dataKey="inYear1" 
          fill="#57ec7f"
          radius={[4, 4, 0, 0]} 
          barSize={12}
        />
        
        {/* Outbound Bars */}
        <Bar 
          name={`Outbound ${year2Label}`} 
          dataKey="outYear2" 
          fill="rgba(76, 215, 246, 0.32)"
          radius={[4, 4, 0, 0]} 
          barSize={12}
        />
        <Bar 
          name={`Outbound ${year1Label}`} 
          dataKey="outYear1" 
          fill="#4cd7f6"
          radius={[4, 4, 0, 0]} 
          barSize={12}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
