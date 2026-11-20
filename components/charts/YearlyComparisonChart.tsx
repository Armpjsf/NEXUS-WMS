"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { HYBRID_TOOLTIP_STYLE } from '@/lib/chartTheme';

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
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="month"
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
          cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
          contentStyle={HYBRID_TOOLTIP_STYLE}
          labelStyle={{ color: '#0f172a', fontSize: '12px', fontWeight: 'bold' }}
          itemStyle={{ color: '#334155', fontSize: '12px' }}
          formatter={(value: any, name: any) => [Number(value || 0).toLocaleString(), name] as [string, string]}
        />
        <Legend
          verticalAlign="top"
          align="right"
          height={36}
          iconType="circle"
          wrapperStyle={{ fontSize: '12px', color: '#334155' }}
        />
        {/* Inbound Bars */}
        <Bar
          name={`Inbound ${year2Label}`}
          dataKey="inYear2"
          fill="rgba(16, 185, 129, 0.35)"
          radius={[4, 4, 0, 0]}
          barSize={12}
        />
        <Bar
          name={`Inbound ${year1Label}`}
          dataKey="inYear1"
          fill="#10b981"
          radius={[4, 4, 0, 0]}
          barSize={12}
        />

        {/* Outbound Bars */}
        <Bar
          name={`Outbound ${year2Label}`}
          dataKey="outYear2"
          fill="rgba(14, 165, 233, 0.35)"
          radius={[4, 4, 0, 0]}
          barSize={12}
        />
        <Bar
          name={`Outbound ${year1Label}`}
          dataKey="outYear1"
          fill="#0ea5e9"
          radius={[4, 4, 0, 0]}
          barSize={12}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
