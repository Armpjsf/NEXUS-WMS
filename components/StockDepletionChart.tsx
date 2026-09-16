
'use client';

import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { motion } from 'framer-motion';

interface StockData {
    date: string;
    stock: number;
    predicted?: boolean;
}

interface Props {
    data: StockData[];
    productName: string;
    burnRate: number;
    daysLeft: number;
}

export default function StockDepletionChart({ data, productName, burnRate, daysLeft }: Props) {
    // Determine color based on risk
    let lineColor = "#10b981"; // Green
    if (daysLeft < 7) lineColor = "#ef4444"; // Red
    else if (daysLeft < 14) lineColor = "#f59e0b"; // Orange

    // Add a reference line for today if we have mixed data
    const todayIndex = data.findIndex(d => d.predicted === true);
    
    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#171c23] p-6 rounded-xl shadow-lg border border-[#30353d]"
        >
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[#dee2ec]">Stock Depletion Projection</h3>
                    <p className="text-xs text-[#8a92a6] mt-1 font-mono">
                        Visualizing burnout for <span className="font-bold text-[#facc15]">{productName}</span>
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-mono font-bold text-[#d1c6ab] uppercase">Burn Rate</p>
                    <p className="text-xl font-mono font-bold text-[#dee2ec]">
                        {burnRate.toFixed(1)} <span className="text-xs font-normal text-[#8a92a6]">/day</span>
                    </p>
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis 
                            dataKey="date" 
                            stroke="#64748b"
                            tick={{ fontSize: 10, fill: '#d1c6ab' }} 
                            tickMargin={10}
                        />
                        <YAxis 
                            stroke="#64748b"
                            tick={{ fontSize: 10, fill: '#d1c6ab' }} 
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#171c23', borderRadius: '12px', border: '1px solid #30353d', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)', color: '#dee2ec' }}
                            labelStyle={{ color: '#facc15', fontSize: '12px', fontWeight: 'bold' }}
                            itemStyle={{ color: '#dee2ec' }}
                        />
                        <Legend wrapperStyle={{ color: '#dee2ec', fontSize: '11px' }} />
                        
                        {/* Historical Line */}
                        <Line 
                            type="monotone" 
                            dataKey="stock" 
                            name="Stock Level" 
                            stroke={lineColor} 
                            strokeWidth={3}
                            dot={{ r: 3, fill: lineColor }}
                            activeDot={{ r: 6 }}
                        />

                        {/* Zero Line */}
                        <ReferenceLine y={0} stroke="red" strokeDasharray="3 3" />
                        
                        {/* Today Marker */}
                        {todayIndex > 0 && (
                            <ReferenceLine x={data[todayIndex].date} stroke="#6366f1" label="Today" strokeDasharray="5 5" />
                        )}

                    </LineChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
    );
}
