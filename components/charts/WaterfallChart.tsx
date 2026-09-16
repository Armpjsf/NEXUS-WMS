"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const WaterfallChart = ({ data }: { data: any[] }) => {
  // Config for waterfall coloring
  const getBarColor = (name: string, value: number) => {
    if (name === 'Closing') return '#8b5cf6'; // Violet (Final)
    if (name === 'Opening') return '#22c55e'; // Green (Start)
    if (name === 'Outbound') return '#f43f5e'; // Red (Negative)
    if (name === 'Damage') return '#a855f7'; // Purple/Red (Loss) - Let's use Red or distinct
    if (value < 0) return '#f43f5e'; // Fallback
    return '#10b981'; // Emerald (Positive/Inbound)
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
        <XAxis 
          dataKey="name" 
          stroke="#64748b" 
          fontSize={10} 
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#d1c6ab' }}
        />
        <YAxis 
          stroke="#64748b" 
          fontSize={10} 
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#d1c6ab' }}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }}
          contentStyle={{ 
            backgroundColor: '#171c23', 
            borderColor: '#30353d',
            borderRadius: '0.75rem',
            fontSize: '12px',
            color: '#dee2ec',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
          }}
          itemStyle={{ color: '#dee2ec' }}
          formatter={(value: any) => [Math.abs(value), 'Quantity']}
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
