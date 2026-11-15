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
import { TACTICAL_TOOLTIP_STYLE } from '@/lib/chartTheme';

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
    // Risk color semantics
    const riskColor = daysLeft < 7 ? '#ff5449' : daysLeft < 14 ? '#facc15' : '#57ec7f';
    const riskBadgeBg = daysLeft < 7 
      ? 'bg-[#ff5449]/15 text-[#ffb4ab] border-[#ff5449]/40' 
      : daysLeft < 14 
        ? 'bg-[#facc15]/15 text-[#facc15] border-[#facc15]/40' 
        : 'bg-[#57ec7f]/15 text-[#57ec7f] border-[#57ec7f]/40';

    const firstPredictedIndex = data.findIndex(d => d.predicted === true);
    const todayIndex = firstPredictedIndex;

    // Transform series data to seamlessly bridge actual and predicted lines
    const chartData = data.map((d, index) => {
      let actualStock: number | null = null;
      let predictedStock: number | null = null;

      if (firstPredictedIndex === -1) {
        // All actual
        actualStock = d.stock;
      } else if (firstPredictedIndex === 0) {
        // All predicted
        predictedStock = d.stock;
      } else {
        if (index < firstPredictedIndex - 1) {
          actualStock = d.stock;
        } else if (index === firstPredictedIndex - 1) {
          // Bridge point: both actual and predicted share this value to connect lines
          actualStock = d.stock;
          predictedStock = d.stock;
        } else {
          predictedStock = d.stock;
        }
      }

      return {
        ...d,
        actualStock,
        predictedStock,
      };
    });

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#171c23] p-6 rounded-xl shadow-lg border border-[#30353d]"
        >
            <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                <div>
                    <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-[#dee2ec]">Stock Depletion Projection</h3>
                    <p className="text-xs text-[#8a92a6] mt-1 font-mono">
                        Visualizing burnout for <span className="font-bold text-[#facc15]">{productName}</span>
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-bold flex items-center gap-1.5 shadow-sm ${riskBadgeBg}`}>
                        <span className="text-[10px] uppercase opacity-75">Days Left:</span>
                        <span className="text-sm tabular-nums">{daysLeft}d</span>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-mono font-bold text-[#d1c6ab] uppercase">Burn Rate</p>
                        <p className="text-xl font-mono font-bold text-[#dee2ec]">
                            {burnRate.toFixed(1)} <span className="text-xs font-normal text-[#8a92a6]">/day</span>
                        </p>
                    </div>
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 15, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
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
                            contentStyle={TACTICAL_TOOLTIP_STYLE}
                            labelStyle={{ color: '#facc15', fontSize: '12px', fontWeight: 'bold' }}
                            itemStyle={{ color: '#dee2ec' }}
                        />
                        <Legend 
                            verticalAlign="top"
                            align="right"
                            height={32}
                            iconType="circle"
                            wrapperStyle={{ color: '#dee2ec', fontSize: '11px', fontFamily: 'monospace' }} 
                        />
                        
                        {/* Actual Historical Line */}
                        <Line 
                            type="monotone" 
                            dataKey="actualStock" 
                            name="Actual Stock" 
                            stroke="#4cd7f6" 
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: '#4cd7f6' }}
                            activeDot={{ r: 5 }}
                            connectNulls={false}
                        />

                        {/* Predicted Future Line */}
                        <Line 
                            type="monotone" 
                            dataKey="predictedStock" 
                            name="Predicted Depletion" 
                            stroke={riskColor} 
                            strokeWidth={2.5}
                            strokeDasharray="6 4"
                            dot={{ r: 3, fill: riskColor }}
                            activeDot={{ r: 5 }}
                            connectNulls={false}
                        />

                        {/* Zero Line */}
                        <ReferenceLine y={0} stroke="#ff5449" strokeDasharray="3 3" />
                        
                        {/* Today Marker */}
                        {todayIndex > 0 && todayIndex < data.length && (
                            <ReferenceLine 
                                x={data[todayIndex].date} 
                                stroke="#facc15" 
                                strokeDasharray="4 4"
                                label={{ value: 'TODAY', fill: '#facc15', fontSize: 10, position: 'insideTopRight' }} 
                            />
                        )}

                    </LineChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
    );
}
