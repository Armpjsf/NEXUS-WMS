"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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
          top: 20,
          right: 30,
          left: 0,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
        <XAxis 
          dataKey="month" 
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
          cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
          contentStyle={{
            backgroundColor: '#171c23',
            border: '1px solid #30353d',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
            color: '#dee2ec'
          }}
          itemStyle={{ color: '#dee2ec', fontSize: '12px', fontWeight: 600 }}
          // Use the series name (e.g. "Inbound 2026") as the label instead of a
          // generic "Qty" so each row says which year and inbound/outbound it is.
          formatter={(value: any, name: any) => [value?.toLocaleString() || '0', name] as [string, string]}
        />
        <Legend 
            verticalAlign="top" 
            align="right" 
            height={36} 
            iconType="circle"
            wrapperStyle={{ fontSize: '11px', fontWeight: 500, color: '#dee2ec' }}
        />
        {/* Inbound Bars */}
        <Bar 
          name={`Inbound ${year2Label}`} 
          dataKey="inYear2" 
          fill="#bbf7d0" // Green-200
          radius={[4, 4, 0, 0]} 
          barSize={12}
        />
        <Bar 
          name={`Inbound ${year1Label}`} 
          dataKey="inYear1" 
          fill="#10b981" // Emerald-500
          radius={[4, 4, 0, 0]} 
          barSize={12}
        />
        
        {/* Outbound Bars */}
        <Bar 
          name={`Outbound ${year2Label}`} 
          dataKey="outYear2" 
          fill="#cbd5e1" // Slate-300
          radius={[4, 4, 0, 0]} 
          barSize={12}
        />
        <Bar 
          name={`Outbound ${year1Label}`} 
          dataKey="outYear1" 
          fill="#6366f1" // Indigo-500
          radius={[4, 4, 0, 0]} 
          barSize={12}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
