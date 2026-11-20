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
import { HYBRID_TOOLTIP_STYLE } from '@/lib/chartTheme';

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
    const riskColor = daysLeft < 7 ? '#ef4444' : daysLeft < 14 ? '#f59e0b' : '#10b981';
    const riskBadgeBg = daysLeft < 7
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : daysLeft < 14
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-emerald-50 text-emerald-700 border-emerald-200';

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
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="nx-glass-card p-6"
        >
            <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">Stock Depletion Projection</h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Visualizing burnout for <span className="font-semibold text-amber-600">{productName}</span>
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${riskBadgeBg}`}>
                        <span className="text-[10px] uppercase opacity-80">Days Left:</span>
                        <span className="text-sm tabular-nums">{daysLeft}d</span>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase">Burn Rate</p>
                        <p className="text-xl font-bold text-slate-900 tabular-nums">
                            {burnRate.toFixed(1)} <span className="text-xs font-normal text-slate-500">/day</span>
                        </p>
                    </div>
                </div>
            </div>

            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 15, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                            dataKey="date"
                            stroke="#94a3b8"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            tickMargin={10}
                        />
                        <YAxis
                            stroke="#94a3b8"
                            tick={{ fontSize: 11, fill: '#64748b' }}
                        />
                        <Tooltip
                            contentStyle={HYBRID_TOOLTIP_STYLE}
                            labelStyle={{ color: '#0f172a', fontSize: '12px', fontWeight: 'bold' }}
                            itemStyle={{ color: '#334155' }}
                        />
                        <Legend
                            verticalAlign="top"
                            align="right"
                            height={32}
                            iconType="circle"
                            wrapperStyle={{ color: '#334155', fontSize: '12px' }}
                        />

                        {/* Actual Historical Line */}
                        <Line
                            type="monotone"
                            dataKey="actualStock"
                            name="Actual Stock"
                            stroke="#0ea5e9"
                            strokeWidth={2.5}
                            dot={{ r: 3, fill: '#0ea5e9' }}
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
                        <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />

                        {/* Today Marker */}
                        {todayIndex > 0 && todayIndex < data.length && (
                            <ReferenceLine
                                x={data[todayIndex].date}
                                stroke="#f59e0b"
                                strokeDasharray="4 4"
                                label={{ value: 'TODAY', fill: '#d97706', fontSize: 10, position: 'insideTopRight' }}
                            />
                        )}

                    </LineChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
    );
}
