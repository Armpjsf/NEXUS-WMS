"use client";

import { getApiUrl } from "@/lib/config";
import { useEffect, useState } from "react";
import CountUp from 'react-countup';
import {
  Activity,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle,
  MapPin,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
} from 'recharts';
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/Skeleton";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import DashboardAlertsBanner from "@/components/DashboardAlertsBanner";
import QuickActionsPanel from "@/components/QuickActionsPanel";
import { DashboardCustomizer, useDashboardCustomization } from "@/components/DashboardCustomizer";
import { DashboardGridLayout } from "@/components/dashboard/DashboardGridLayout";
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import StockDepletionChart from "@/components/StockDepletionChart";
import { generateDepletionData } from "@/lib/forecast";
import StitchTelemetryStrip from "@/components/dashboard/StitchTelemetryStrip";
import StitchDockMatrix from "@/components/dashboard/StitchDockMatrix";
import { TACTICAL_TOOLTIP_STYLE } from "@/lib/chartTheme";

// Lazy-load the heavy chart components
const chartLoading = () => <div className="h-64 w-full rounded-xl bg-[#1b2027] border border-[#30353d]/60 animate-pulse" />;
const WaterfallChart = dynamic(() => import("@/components/charts/WaterfallChart"), { ssr: false, loading: chartLoading });
const YearlyComparisonChart = dynamic(() => import("@/components/charts/YearlyComparisonChart"), { ssr: false, loading: chartLoading });
const AnnualTrendChart = dynamic(() => import("@/components/charts/AnnualTrendChart"), { ssr: false, loading: chartLoading });

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#090f15]/95 backdrop-blur-xl border border-[#30353d] p-3 rounded-xl shadow-2xl text-[#dee2ec] text-xs font-mono">
        <p className="font-bold mb-1.5 text-[#facc15] border-b border-[#30353d] pb-1">{label}</p>
        {payload.map((pld: any, index: number) => (
          <div key={index} className="flex justify-between items-center gap-4 py-0.5">
            <span className="flex items-center gap-1.5 text-[#8a92a6]">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pld.color || pld.fill }} />
              {pld.name || pld.dataKey}:
            </span>
            <span className="font-bold text-[#dee2ec]">{typeof pld.value === 'number' ? pld.value.toLocaleString() : pld.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"operational" | "executive" | "forecast">("operational");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");

  // Date Filter State
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedYear1, setSelectedYear1] = useState(new Date().getFullYear().toString());
  const [selectedYear2, setSelectedYear2] = useState((new Date().getFullYear() - 1).toString());
  
  // Dashboard Customization
  const { visibleWidgets, toggleWidget, mounted } = useDashboardCustomization();
  const [selectedForecastItem, setSelectedForecastItem] = useState<any>(null);
  const [activityDays, setActivityDays] = useState<7 | 30>(7);
  const [forecastHistory, setForecastHistory] = useState<Array<{ date: string; stock: number }>>([]);

  // Real 7-day stock history for the selected SKU (depletion chart).
  useEffect(() => {
    const sku = selectedForecastItem?.sku;
    setForecastHistory([]);
    if (!sku) return;
    let cancelled = false;
    fetch(getApiUrl(`/api/stock/history?sku=${encodeURIComponent(sku)}&days=7`), { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled && d?.history) setForecastHistory(d.history); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedForecastItem?.sku]);

  // Set default date range on mount
  useEffect(() => {
     const now = new Date();
     const firstDay = new Date(2024, 0, 1);
     setStartDate(firstDay.toISOString().split('T')[0]);
     setEndDate(now.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!startDate || !endDate) return;

      try {
        setLoading(true);
        
        const urlParams = new URLSearchParams(window.location.search);
        const branchId = urlParams.get('branchId') || 'hq';
        
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        params.append('year1', selectedYear1);
        params.append('year2', selectedYear2);
        params.append('branchId', branchId);
        
        const url = getApiUrl(`/api/dashboard?${params.toString()}`);
        setDebugInfo(url);
        
        const res = await fetch(url, { cache: 'no-store' });
        
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`API Error ${res.status}: ${errText}`);
        }

        const json = await res.json();
        setData(json);
        if (json?.forecasts?.length > 0) {
           setSelectedForecastItem(json.forecasts[0]);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        setError((error as Error).message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [startDate, endDate, selectedYear1, selectedYear2]);

  if (loading && !data && !startDate) {
    return (
      <div className="min-h-screen p-6 space-y-6 bg-[#0f141b]">
         <div className="flex justify-between items-center bg-[#171c23] p-5 rounded-xl border border-[#30353d]">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48 bg-[#252a32]" />
              <Skeleton className="h-4 w-64 bg-[#252a32]" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28 bg-[#252a32]" />
              <Skeleton className="h-9 w-28 bg-[#252a32]" />
            </div>
         </div>
         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-28 rounded-xl bg-[#171c23] border border-[#30353d]" />)}
         </div>
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-80 rounded-xl col-span-2 bg-[#171c23] border border-[#30353d]" />
            <Skeleton className="h-80 rounded-xl bg-[#171c23] border border-[#30353d]" />
         </div>
      </div>
    );
  }

  if (error && !data) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-[#0f141b]">
            <div className="max-w-md w-full bg-[#171c23] border border-[#ff5449]/40 p-6 rounded-xl shadow-2xl text-[#dee2ec]">
                <AlertTriangle className="h-12 w-12 text-[#ff5449] mb-4 mx-auto" />
                <h2 className="text-xl font-bold font-headline text-center mb-2">Connection Error</h2>
                <p className="text-[#ffb4ab] text-center font-mono text-xs mb-4">{error}</p>
                <div className="bg-[#090f15] border border-[#30353d] p-3 rounded-lg text-xs font-mono text-[#d1c6ab] break-all mb-4">
                    Attempted URL: {debugInfo}
                </div>
                <button 
                    onClick={() => window.location.reload()}
                    className="w-full py-2.5 bg-[#ff5449] hover:bg-[#ff5449]/90 text-[#090f15] rounded-lg font-mono font-bold transition-colors shadow-lg"
                >
                    Retry Connection
                </button>
            </div>
        </div>
      );
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen relative px-4 py-6 pb-32 sm:px-6 lg:p-8">
      <AmbientBackground />
      
      {/* Critical Alerts & Quick Actions */}
      <div className="max-w-[1500px] mx-auto mb-6 flex flex-col gap-4">
        {visibleWidgets['alerts'] && <DashboardAlertsBanner />}
        {visibleWidgets['quick_actions'] && <QuickActionsPanel />}
      </div>
      
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-[1500px] mx-auto space-y-6"
      >
        {/* Variation A: Unified Tactical Command Header */}
        <div className="relative overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23]/95 p-4 sm:p-5 shadow-2xl backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#facc15] via-[#4cd7f6] to-[#57ec7f]" />
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Branding & Title */}
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#facc15] text-[#1b1600] font-headline text-base font-extrabold shadow-md">
                WMS
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#4cd7f6]">
                    Tactical Operations Command Platform
                  </span>
                  <span className="font-mono text-[9px] bg-[#57ec7f]/15 text-[#57ec7f] border border-[#57ec7f]/30 px-1.5 py-0.2 rounded font-bold">
                    ONLINE
                  </span>
                </div>
                <h1 className="font-headline text-xl md:text-2xl font-black tracking-tight text-[#dee2ec]">
                  {t('dashboard_title')}
                </h1>
                <p className="font-mono text-xs text-[#d1c6ab]">{t('dashboard_subtitle')}</p>
              </div>
            </div>

            {/* Right: Integrated Tabs, Date Range & Customizer */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Integrated Tabs */}
              <div className="flex items-center rounded-lg border border-[#30353d] bg-[#090f15] p-1 font-mono text-xs">
                <button
                  onClick={() => setActiveTab("operational")}
                  className={cn(
                    "px-3.5 py-1.5 rounded-md font-bold transition-all",
                    activeTab === "operational"
                      ? "bg-[#facc15] text-[#1b1600] shadow-sm"
                      : "text-[#d1c6ab] hover:text-[#dee2ec] hover:bg-[#252a32]"
                  )}
                >
                  {t('tab_operational')}
                </button>
                <button
                  onClick={() => setActiveTab("executive")}
                  className={cn(
                    "px-3.5 py-1.5 rounded-md font-bold transition-all",
                    activeTab === "executive"
                      ? "bg-[#4cd7f6] text-[#001f26] shadow-sm"
                      : "text-[#d1c6ab] hover:text-[#dee2ec] hover:bg-[#252a32]"
                  )}
                >
                  {t('tab_executive')}
                </button>
                <button
                  onClick={() => setActiveTab("forecast")}
                  className={cn(
                    "px-3.5 py-1.5 rounded-md font-bold transition-all flex items-center gap-1",
                    activeTab === "forecast"
                      ? "bg-[#57ec7f] text-[#002109] shadow-sm"
                      : "text-[#d1c6ab] hover:text-[#dee2ec] hover:bg-[#252a32]"
                  )}
                >
                  <span>Forecast</span>
                  <span className="px-1 rounded text-[9px] uppercase font-mono font-black bg-black/20">
                    AI
                  </span>
                </button>
              </div>

              {/* Date Range Picker */}
              <div className="flex items-center gap-1.5 rounded-lg border border-[#30353d] bg-[#090f15] p-1 shadow-inner">
                <div className="relative group">
                  <Calendar className="absolute left-2 top-1.5 h-3.5 w-3.5 text-[#d1c6ab]" />
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-7 pr-2 py-1 bg-[#171c23] border border-[#30353d] rounded text-xs font-mono text-[#dee2ec] focus:border-[#facc15] outline-none transition-all cursor-pointer"
                  />
                </div>
                <span className="text-[#8a92a6] font-mono text-xs">→</span>
                <div className="relative group">
                  <Calendar className="absolute left-2 top-1.5 h-3.5 w-3.5 text-[#d1c6ab]" />
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pl-7 pr-2 py-1 bg-[#171c23] border border-[#30353d] rounded text-xs font-mono text-[#dee2ec] focus:border-[#facc15] outline-none transition-all cursor-pointer"
                  />
                </div>
              </div>

              {/* Customizer */}
              <DashboardCustomizer visibleWidgets={visibleWidgets} toggleWidget={toggleWidget} />
            </div>
          </div>
        </div>

        {/* Primary Telemetry Strip (Immediately below Command Header) */}
        <motion.div variants={item}>
          <StitchTelemetryStrip summary={data?.summary} />
        </motion.div>

        {activeTab === "operational" && (
           <DashboardGridLayout 
              defaultLayout={[
                  'kpi_grid', 
                  'chart_top_sellers', 
                  'chart_inventory_health', 
                  'chart_sales_category', 
                  'chart_weekly_activity',
                  'table_low_stock',
                  'table_recent_activity'
              ]}
              widgets={{
                  kpi_grid: visibleWidgets['stats'] ? (
                     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {/* 1. Flow Ratio (Inbound / Outbound Ratio) */}
                        <motion.div variants={item}>
                            <KpiCard 
                              label={t('kpi_flow_ratio')} 
                              value={data?.summary?.inboundPeriod && data?.summary?.outboundPeriod ? (data.summary.inboundPeriod / (data.summary.outboundPeriod || 1)).toFixed(2) : "0.00"}
                              icon={Activity} 
                              color="cyan"
                              subtitle="In / Out Ratio"
                              title={t('tooltip_flow_ratio') || "อัตราส่วนระหว่างยอดรับเข้าสะสมเทียบกับยอดจ่ายออกสะสมในช่วงเวลาที่เลือก"}
                            />
                        </motion.div>

                        {/* 2. Turnover Rate */}
                        <motion.div variants={item}>
                           <KpiCard 
                             label={t('kpi_turnover_rate')} 
                             value={`${(data?.summary?.turnoverRate || 0).toFixed(1)}%`} 
                             icon={Activity} 
                             color="emerald"
                             subtitle="Velocity Rate"
                             title={t('tooltip_turnover_rate') || "อัตราส่วนการหมุนเวียนสินค้าคำนวณจาก ยอดจ่ายออกสะสม / ยอดสินค้าคงเหลือทั้งหมด"}
                           />
                        </motion.div>

                        {/* 3. Space Occupancy */}
                        <motion.div variants={item}>
                            <KpiCard 
                              label={t('kpi_space_occupancy')} 
                              value={`${(data?.executive?.spaceEfficiency || 0).toFixed(1)}%`}
                              icon={MapPin} 
                              color="gold"
                              subtitle="Utilization"
                            />
                        </motion.div>

                        {/* 4. Low Stock SKUs */}
                        <motion.div variants={item}>
                           <KpiCard 
                             label={t('kpi_low_stock')} 
                             value={data?.summary?.lowStockCount || 0} 
                             icon={AlertTriangle} 
                             color={(data?.summary?.lowStockCount || 0) > 0 ? "rose" : "gold"} 
                             href="/inventory?status=LOW" 
                             subtitle="Reorder Required"
                           />
                        </motion.div>

                        {/* 5. Aging Stock */}
                        <motion.div variants={item}>
                           <KpiCard 
                             label={t('kpi_aging_stock')} 
                             value={data?.summary?.agingStockCount || 0} 
                             icon={Clock} 
                             color="rose" 
                             href="/analytics/aging" 
                             subtitle="> 90 Days Holding"
                           />
                        </motion.div>

                        {/* 6. Dead Stock with Empty Location Note */}
                        <motion.div variants={item}>
                           <KpiCard 
                             label={t('kpi_dead_stock')} 
                             value={data?.summary?.deadStockCount || 0} 
                             icon={Package} 
                             color="rose" 
                             href="/inventory?movement=Deadstock" 
                             subtitle={`Empty Locs: ${data?.summary?.emptyLocationCount || 0}`}
                             title={data?.summary?.emptyLocationList?.join('\n')}
                           />
                        </motion.div>
                     </div>
                  ) : null,

                  chart_top_sellers: visibleWidgets['charts'] ? (
                      <div className="h-96 rounded-xl border border-[#30353d] bg-[#171c23] p-5 shadow-lg flex flex-col">
                          <h3 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-[#facc15] rounded-full"></span>
                            {t('chart_top_sellers')}
                          </h3>
                          <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                               <BarChart
                                     data={data?.topSellers?.slice(0, 10) || []}
                                     layout="vertical"
                                     margin={{ top: 10, right: 30, left: 30, bottom: 0 }}
                                 >
                                     <defs>
                                         <linearGradient id="bestSellerGrad" x1="0" y1="0" x2="1" y2="0">
                                             <stop offset="0%" stopColor="#facc15" stopOpacity={0.95}/>
                                             <stop offset="100%" stopColor="#eab308" stopOpacity={0.5}/>
                                         </linearGradient>
                                     </defs>
                                     <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" horizontal={true} vertical={false} />
                                     <XAxis 
                                       type="number" 
                                       stroke="#64748b" 
                                       fontSize={10} 
                                       tick={{ fill: '#d1c6ab', fontFamily: 'monospace' }} 
                                       tickFormatter={(v) => Number(v || 0).toLocaleString()} 
                                     />
                                     <YAxis 
                                       type="category" 
                                       dataKey="name" 
                                       stroke="#64748b" 
                                       fontSize={10} 
                                       tick={{ fill: '#d1c6ab', fontFamily: 'monospace' }} 
                                       width={120} 
                                       tickFormatter={(val) => typeof val === 'string' && val.length > 15 ? `${val.slice(0, 15)}…` : val} 
                                     />
                                     <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }} />
                                     <Bar dataKey="qty" name="Sold Qty" fill="url(#bestSellerGrad)" radius={[0, 6, 6, 0]} barSize={14} />
                                 </BarChart>
                            </ResponsiveContainer>
                         </div>
                      </div>
                  ) : null,

                  chart_inventory_health: visibleWidgets['charts'] ? (() => {
                      const healthData = data?.healthData || [];
                      const totalHealthSKUs = healthData.reduce((acc: number, curr: any) => acc + (Number(curr.value) || 0), 0);
                      const healthyItem = healthData.find((h: any) => h.name === 'Healthy' || h.name === 'ปกติ');
                      const healthyCount = healthyItem ? Number(healthyItem.value) : 0;
                      const healthyPct = totalHealthSKUs > 0 ? Math.round((healthyCount / totalHealthSKUs) * 100) : 0;
                      const lowCount = healthData.find((h: any) => h.name === 'Low' || h.name === 'ใกล้หมด')?.value || 0;
                      const outCount = healthData.find((h: any) => h.name === 'Out' || h.name === 'หมดสต็อก')?.value || 0;

                      return (
                        <div className="h-96 rounded-xl border border-[#30353d] bg-[#171c23] p-5 shadow-lg flex flex-col justify-between">
                            <h3 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider mb-2 flex items-center gap-2">
                              <span className="w-1.5 h-4 bg-[#57ec7f] rounded-full"></span>
                              {t('chart_inventory_health')}
                           </h3>
                           <div className="relative flex-1 w-full min-h-0">
                              {/* Center Metric Overlay */}
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-4">
                                <span className="font-mono text-2xl font-black text-[#57ec7f] tabular-nums">{healthyPct}%</span>
                                <span className="font-mono text-[9px] uppercase tracking-wider text-[#8a92a6]">Healthy</span>
                              </div>
                              <ResponsiveContainer width="100%" height="100%">
                                 <PieChart>
                                    <Pie 
                                       data={healthData} 
                                       dataKey="value" 
                                       nameKey="name"
                                       cx="50%" cy="50%" 
                                       innerRadius={58} outerRadius={78}
                                       paddingAngle={4} cornerRadius={6}
                                    >
                                       {healthData.map((entry: any, index: number) => {
                                          const isHealthy = entry.name === 'Healthy' || entry.name === 'ปกติ';
                                          const isLow = entry.name === 'Low' || entry.name === 'ใกล้หมด';
                                          const fill = isHealthy ? '#57ec7f' : isLow ? '#facc15' : '#ffb4ab';
                                          return <Cell key={`cell-${index}`} fill={fill} stroke="none" />;
                                       })}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                 </PieChart>
                              </ResponsiveContainer>
                           </div>
                           {/* 3-Column Structured Summary Footer */}
                           <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#30353d]/50 font-mono text-center text-xs">
                             <div className="p-1.5 rounded bg-[#090f15]/60 border border-[#30353d]/40">
                               <span className="text-[10px] text-[#57ec7f] block font-bold">Healthy</span>
                               <span className="text-[#dee2ec] font-bold">{healthyCount.toLocaleString()}</span>
                             </div>
                             <div className="p-1.5 rounded bg-[#090f15]/60 border border-[#30353d]/40">
                               <span className="text-[10px] text-[#facc15] block font-bold">Low</span>
                               <span className="text-[#dee2ec] font-bold">{Number(lowCount).toLocaleString()}</span>
                             </div>
                             <div className="p-1.5 rounded bg-[#090f15]/60 border border-[#30353d]/40">
                               <span className="text-[10px] text-[#ffb4ab] block font-bold">Out</span>
                               <span className="text-[#dee2ec] font-bold">{Number(outCount).toLocaleString()}</span>
                             </div>
                           </div>
                        </div>
                      );
                  })() : null,
                  
                  chart_sales_category: visibleWidgets['charts'] ? (() => {
                       const catData = data?.categorySales || [];
                       const totalCatQty = catData.reduce((acc: number, c: any) => acc + (Number(c.value) || 0), 0);
                       const palette = ['#4cd7f6', '#57ec7f', '#facc15', '#f59e0b', '#ff5449'];

                       return (
                          <div className="h-96 rounded-xl border border-[#30353d] bg-[#171c23] p-5 shadow-lg flex flex-col justify-between">
                              <h3 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider mb-2 flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-[#4cd7f6] rounded-full"></span>
                                {t('chart_sales_category')}
                              </h3>
                              <div className="flex-1 w-full min-h-0 grid grid-cols-1 md:grid-cols-2 items-center gap-3">
                                  <div className="h-full min-h-[170px] w-full">
                                      <ResponsiveContainer width="100%" height="100%">
                                          <PieChart>
                                              <Pie
                                                  data={catData}
                                                  dataKey="value"
                                                  nameKey="name"
                                                  cx="50%" cy="50%"
                                                  innerRadius={46} outerRadius={66}
                                                  paddingAngle={3} cornerRadius={5}
                                              >
                                                  {catData.map((entry: any, index: number) => (
                                                      <Cell key={`cell-${index}`} fill={palette[index % palette.length]} stroke="none" />
                                                  ))}
                                              </Pie>
                                              <Tooltip content={<CustomTooltip />} />
                                          </PieChart>
                                      </ResponsiveContainer>
                                  </div>
                                  <div className="space-y-1.5 font-mono text-xs max-h-[220px] overflow-y-auto pr-1">
                                    {catData.slice(0, 5).map((cat: any, idx: number) => {
                                      const color = palette[idx % palette.length];
                                      const share = totalCatQty > 0 ? Math.round((Number(cat.value || 0) / totalCatQty) * 100) : 0;
                                      return (
                                        <div key={idx} className="p-1.5 rounded bg-[#090f15]/60 border border-[#30353d]/40">
                                          <div className="flex items-center justify-between text-[11px] mb-1">
                                            <span className="flex items-center gap-1.5 text-[#dee2ec] font-bold truncate max-w-[100px]">
                                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                              <span className="truncate">{cat.name}</span>
                                            </span>
                                            <span className="text-[#d1c6ab] font-bold">{share}% <span className="text-[#8a92a6] font-normal">({Number(cat.value).toLocaleString()})</span></span>
                                          </div>
                                          <div className="w-full bg-[#1b2027] h-1 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: color }} />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                              </div>
                          </div>
                       );
                  })() : null,

                  chart_weekly_activity: visibleWidgets['charts'] ? (() => {
                       const rows = (data?.movementData || []).slice(-activityDays);
                       const totalInWindow = rows.reduce((sum: number, r: any) => sum + (Number(r.in) || 0), 0);
                       const totalOutWindow = rows.reduce((sum: number, r: any) => sum + (Number(r.out) || 0), 0);

                       return (
                          <div className="h-96 rounded-xl border border-[#30353d] bg-[#171c23] p-5 shadow-lg flex flex-col">
                              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider flex items-center gap-2">
                                  <span className="w-1.5 h-4 bg-[#facc15] rounded-full"></span>
                                  {activityDays === 7 ? t('chart_weekly_activity') : 'กิจกรรม 30 วัน'}
                                </h3>
                                
                                <div className="flex items-center gap-2">
                                  {/* Inline Summary Pill */}
                                  <div className="hidden sm:flex items-center gap-2 font-mono text-[10px] bg-[#090f15] border border-[#30353d] px-2.5 py-1 rounded-md text-[#d1c6ab]">
                                    <span className="text-[#57ec7f] font-bold">IN: {totalInWindow.toLocaleString()}</span>
                                    <span className="text-[#8a92a6]">|</span>
                                    <span className="text-[#4cd7f6] font-bold">OUT: {totalOutWindow.toLocaleString()}</span>
                                  </div>

                                  <div className="flex gap-1 font-mono">
                                    {([7, 30] as const).map(n => (
                                      <button 
                                        key={n} 
                                        onClick={() => setActivityDays(n)}
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                                          activityDays === n 
                                            ? 'bg-[#facc15] text-[#1b1600] border-[#facc15]' 
                                            : 'text-[#8a92a6] border-[#30353d] hover:text-[#dee2ec] hover:bg-[#252a32]'
                                        }`}
                                      >
                                        {n} วัน
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {rows.length > 0 && rows.every((r: any) => !r.in && !r.out) && (
                                <p className="mb-2 text-[11px] font-mono text-[#8a92a6]">ไม่มีการรับเข้า/จ่ายออกในช่วงนี้</p>
                              )}

                              <div className="flex-1 w-full min-h-0">
                                 <ResponsiveContainer width="100%" height="100%">
                                     <BarChart data={rows} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                         <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" vertical={false} />
                                         <XAxis dataKey="name" stroke="#64748b" fontSize={10} tick={{ fill: '#d1c6ab', fontFamily: 'monospace' }} />
                                         <YAxis stroke="#64748b" fontSize={10} tick={{ fill: '#d1c6ab', fontFamily: 'monospace' }} tickFormatter={(v) => Number(v || 0).toLocaleString()} />
                                         <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.04)' }} />
                                         <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: '#dee2ec', fontFamily: 'monospace' }} />
                                         <Bar dataKey="in" name={t('legend_inbound')} fill="#57ec7f" radius={[4, 4, 0, 0]} barSize={activityDays === 7 ? 12 : 5} />
                                         <Bar dataKey="out" name={t('legend_outbound')} fill="#4cd7f6" radius={[4, 4, 0, 0]} barSize={activityDays === 7 ? 12 : 5} />
                                     </BarChart>
                                 </ResponsiveContainer>
                             </div>
                          </div>
                       );
                  })() : null,

                  table_low_stock: visibleWidgets['recent_activity'] ? (
                     <div className="h-96 rounded-xl border border-[#30353d] bg-[#171c23] p-5 shadow-lg overflow-hidden flex flex-col">
                        <h3 className="text-xs font-mono font-bold text-[#ffb4ab] uppercase tracking-wider mb-3 flex items-center gap-2">
                           <AlertTriangle className="h-4 w-4" /> {t('section_low_stock_alert')}
                        </h3>
                        <div className="flex-1 overflow-auto">
                           <table className="w-full text-xs font-mono">
                              <thead className="text-[#d1c6ab] uppercase font-bold text-[10px] sticky top-0 bg-[#090f15] border-b border-[#30353d]">
                                  <tr>
                                     <th className="text-left py-2.5 pl-2">{t('col_product_name')}</th>
                                     <th className="text-right py-2.5">{t('col_qty')}</th>
                                     <th className="text-center py-2.5">{t('col_status')}</th>
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-[#30353d]/50">
                                  {data?.lowStock?.map((item: any, index: number) => (
                                     <tr key={index} className="hover:bg-[#1d232c] transition-colors">
                                        <td className="py-2.5 pl-2 text-[#dee2ec] font-medium flex items-center gap-2">
                                           {item.image ? (
                                               <img src={`/api/proxy/image?url=${encodeURIComponent(item.image)}`} alt={item.name} className="w-6 h-6 rounded object-cover border border-[#30353d]" />
                                           ) : <div className="w-6 h-6 bg-[#252a32] rounded border border-[#30353d]"></div>}
                                           <span className="truncate max-w-[140px]">{item.name}</span>
                                        </td>
                                        <td className="py-2.5 text-right text-[#ffb4ab] font-bold">{item.qty}</td>
                                        <td className="py-2.5 text-center">
                                          <span className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold ${
                                             item.status === 'Fast Moving' ? 'bg-[#57ec7f]/10 text-[#57ec7f] border border-[#57ec7f]/30' : 'bg-[#93000a]/20 text-[#ffb4ab] border border-[#ffb4ab]/30'
                                          }`}>
                                             {item.status?.split(' ')[0]}
                                          </span>
                                        </td>
                                     </tr>
                                  ))}
                               </tbody>
                            </table>
                        </div>
                     </div>
                  ) : null,

                  table_recent_activity: visibleWidgets['recent_activity'] ? (
                     <div className="h-96 rounded-xl border border-[#30353d] bg-[#171c23] p-5 shadow-lg overflow-hidden flex flex-col">
                        <h3 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider mb-3 flex items-center gap-2">
                           <Activity className="h-4 w-4 text-[#facc15]" /> {t('section_recent_activity')}
                        </h3>
                        <div className="flex-1 overflow-auto">
                           <ul className="space-y-2.5">
                              {data?.recentActivity?.map((activity: any, index: number) => (
                                 <li key={index} className="flex items-center space-x-3 text-xs p-2 rounded-lg bg-[#090f15]/50 border border-[#30353d]/50 hover:bg-[#1d232c] transition-colors">
                                    {activity.type === 'inbound' ? (
                                       <div className="bg-[#57ec7f]/20 border border-[#57ec7f]/30 p-1.5 rounded"><ArrowDownRight className="h-3 w-3 text-[#57ec7f]" /></div>
                                    ) : (
                                       <div className="bg-[#4cd7f6]/20 border border-[#4cd7f6]/30 p-1.5 rounded"><ArrowUpRight className="h-3 w-3 text-[#4cd7f6]" /></div>
                                    )}
                                    <div className="flex-1 min-w-0 font-mono">
                                       <span className="text-[#dee2ec] font-medium block truncate">{activity.description}</span>
                                       <span className="text-[#8a92a6] text-[10px]">{activity.time}</span>
                                    </div>
                                 </li>
                              ))}
                           </ul>
                        </div>
                     </div>
                  ) : null
              }}
           />
        )}

        {/* Variation A: Dock & Activity Placement at Bottom of Operational Tab */}
        {activeTab === "operational" && (
          <motion.div variants={item} className="pt-2">
            <StitchDockMatrix movements={data?.recentTransactions || []} />
          </motion.div>
        )}

        {/* Executive Tab */}
        {activeTab === "executive" && (
           <motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ duration: 0.5 }}
             className="h-full flex flex-col gap-6 overflow-auto pr-2 pb-8"
           >
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <AdminMetric label={t('metric_accuracy')} value={`${(data?.executive?.accuracy || 0).toFixed(2)}%`} target="100%" color="text-emerald-500" />
                  <AdminMetric label={t('metric_damage')} value={`${(data?.executive?.damageRate || 0).toFixed(2)}%`} target="0.00%" color="text-rose-500" />
                  <AdminMetric label={t('metric_space')} value={`${(data?.executive?.spaceEfficiency || 0).toFixed(1)}%`} target="100%" color="text-amber-500" />
                  <AdminMetric label={t('metric_fulfillment')} value={`${(data?.executive?.otif || 0).toFixed(1)}%`} target="100%" color="text-cyan-500" />
               </div>
               
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   <div className="rounded-xl border border-[#30353d] bg-[#171c23] p-5 shadow-lg">
                      <h3 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider mb-4 flex items-center gap-2">
                         <span className="w-1.5 h-4 bg-[#4cd7f6] rounded-full"></span>
                         {t('chart_flow_analysis')}
                       </h3>
                     <div className="h-64 w-full">
                        {data?.executive?.waterfallData ? (
                           <WaterfallChart data={data.executive.waterfallData} />
                        ) : (
                           <div className="h-full flex items-center justify-center text-[#8a92a6] font-mono text-xs">Loading waterfall...</div>
                        )}
                     </div>
                  </div>
                  
                   <div className="rounded-xl border border-[#30353d] bg-[#171c23] p-5 shadow-lg">
                      <h3 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider mb-4 flex items-center gap-2">
                         <span className="w-1.5 h-4 bg-[#facc15] rounded-full"></span>
                         {t('chart_performance_radar')}
                       </h3>
                      <div className="h-64 w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={data?.executive?.radarData || []}>
                               <PolarGrid stroke="#30353d" />
                               <PolarAngleAxis dataKey="metric" stroke="#64748b" fontSize={11} tick={{ fill: '#d1c6ab', fontWeight: 600, fontFamily: 'monospace' }} />
                               <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#64748b" fontSize={9} tick={false} />
                               <Radar name="Actual" dataKey="actual" stroke="#4cd7f6" fill="#4cd7f6" fillOpacity={0.35} animationDuration={1000} />
                               <Radar name="Target" dataKey="target" stroke="#facc15" fill="#facc15" fillOpacity={0.12} strokeDasharray="4 4" animationDuration={1000} />
                               <Tooltip contentStyle={TACTICAL_TOOLTIP_STYLE} itemStyle={{ color: '#dee2ec', fontFamily: 'monospace' }} />
                               <Legend wrapperStyle={{ color: '#dee2ec', fontSize: '11px', fontFamily: 'monospace' }} />
                            </RadarChart>
                         </ResponsiveContainer>
                      </div>
                   </div>
               </div>

               {/* Year Over Year Comparison */}
               <div className="rounded-xl border border-[#30353d] bg-[#171c23] p-5 shadow-lg">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-4">
                      <h3 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider flex items-center gap-2">
                         <span className="w-1.5 h-4 bg-[#facc15] rounded-full"></span>
                         {t('chart_yoy')}
                       </h3>
                      <div className="flex gap-2 text-xs font-mono">
                         <select 
                            value={selectedYear1} 
                            onChange={(e) => setSelectedYear1(e.target.value)}
                            className="bg-[#090f15] border border-[#30353d] rounded-lg px-2.5 py-1 text-[#dee2ec] font-bold focus:border-[#facc15] outline-none"
                         >
                            {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                         </select>
                         <span className="text-[#8a92a6] font-bold self-center">vs</span>
                         <select 
                            value={selectedYear2} 
                            onChange={(e) => setSelectedYear2(e.target.value)}
                            className="bg-[#090f15] border border-[#30353d] rounded-lg px-2.5 py-1 text-[#dee2ec] font-bold focus:border-[#facc15] outline-none"
                         >
                            {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                         </select>
                      </div>
                  </div>
                  <div className="h-80 w-full">
                     {data?.executive?.yearlyComparison?.data ? (
                        <YearlyComparisonChart 
                            data={data.executive.yearlyComparison.data} 
                            year1Label={data.executive.yearlyComparison.labels.year1}
                            year2Label={data.executive.yearlyComparison.labels.year2}
                        />
                     ) : (
                        <div className="h-full flex items-center justify-center text-[#8a92a6] font-mono text-xs">Loading comparison...</div>
                     )}
                  </div>
               </div>

               {/* All-Time Annual Trend */}
               <div className="rounded-xl border border-[#30353d] bg-[#171c23] p-5 shadow-lg">
                  <h3 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider mb-5 flex items-center gap-2">
                     <span className="w-1.5 h-4 bg-[#57ec7f] rounded-full"></span>
                     {t('chart_growth_trend')}
                   </h3>
                  <div className="h-80 w-full">
                     {data?.executive?.annualTrend ? (
                        <AnnualTrendChart data={data.executive.annualTrend} />
                     ) : (
                        <div className="h-full flex items-center justify-center text-[#8a92a6] font-mono text-xs">Loading trend...</div>
                     )}
                  </div>
               </div>
            </motion.div>
         )}

         {/* Forecast Tab */}
         {activeTab === "forecast" && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="h-full flex flex-col gap-6"
            >
                {/* 1. Depletion Chart (Selected Item) */}
                {selectedForecastItem && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-3">
                             <StockDepletionChart 
                                data={generateDepletionData(selectedForecastItem.stock, selectedForecastItem.burnRate, forecastHistory)}
                                productName={selectedForecastItem.name}
                                burnRate={selectedForecastItem.burnRate}
                                daysLeft={selectedForecastItem.daysLeft}
                             />
                        </div>
                    </div>
                )}

                <div className="rounded-xl border border-[#30353d] bg-[#171c23] p-5 shadow-lg overflow-hidden">
                   <div className="flex justify-between items-center mb-5">
                        <h3 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider flex items-center gap-2">
                          <span className="w-1.5 h-4 bg-[#facc15] rounded-full"></span>
                          Forecast Radar (AI Prediction)
                        </h3>
                        <div className="flex gap-2 font-mono">
                            <span className="px-2.5 py-1 bg-[#93000a]/20 text-[#ffb4ab] rounded-lg text-[10px] font-bold uppercase tracking-wide border border-[#ffb4ab]/30">Critical: &lt; 7 Days</span>
                            <span className="px-2.5 py-1 bg-[#facc15]/10 text-[#facc15] rounded-lg text-[10px] font-bold uppercase tracking-wide border border-[#facc15]/30">High: &lt; 14 Days</span>
                        </div>
                   </div>
                   
                   <div className="overflow-x-auto">
                       <table className="w-full text-xs font-mono">
                            <thead className="text-[#d1c6ab] uppercase font-bold text-[10px] tracking-wider sticky top-0 bg-[#090f15] border-b border-[#30353d]">
                                <tr>
                                    <th className="text-left py-3 pl-3">Product</th>
                                    <th className="text-right py-3">Current Stock</th>
                                    <th className="text-right py-3">Burn Rate (Avg/Day)</th>
                                    <th className="text-right py-3">Days Left</th>
                                    <th className="text-center py-3">Est. Stockout</th>
                                    <th className="text-center py-3 pr-3">Risk Level</th>
                                </tr>
                            </thead>
                           <tbody className="divide-y divide-[#30353d]/50">
                               {data?.forecasts?.length > 0 ? (
                                   data.forecasts.map((item: any, idx: number) => (
                                       <tr 
                                          key={idx} 
                                          onClick={() => setSelectedForecastItem(item)}
                                          className={cn(
                                             "transition-colors group cursor-pointer border-l-2",
                                             selectedForecastItem?.name === item.name 
                                                ? "bg-[#252a32] border-l-[#facc15]" 
                                                : "hover:bg-[#1d232c] border-l-transparent"
                                          )}
                                       >
                                           <td className="py-3 pl-3 font-medium text-[#dee2ec] flex items-center gap-3">
                                               {item.image ? (
                                                   <img src={`/api/proxy/image?url=${encodeURIComponent(item.image)}`} className="w-8 h-8 rounded object-cover border border-[#30353d] group-hover:scale-105 transition-transform" />
                                               ) : (
                                                   <div className="w-8 h-8 rounded bg-[#252a32] border border-[#30353d] flex items-center justify-center text-[10px] text-[#8a92a6] font-bold">N/A</div>
                                               )}
                                               <div>
                                                   <div className="text-xs text-[#dee2ec] font-bold">{item.name}</div>
                                                   <div className="text-[10px] text-[#8a92a6] uppercase">{item.category}</div>
                                               </div>
                                           </td>
                                           <td className="py-3 text-right font-mono text-[#dee2ec]">{item.stock.toLocaleString()}</td>
                                           <td className="py-3 text-right font-mono text-[#d1c6ab]">
                                               {item.burnRate > 0 ? `-${item.burnRate.toFixed(1)}` : '0'} 
                                               <span className="text-[10px] text-[#8a92a6] ml-1">/day</span>
                                           </td>
                                           <td className="py-3 text-right">
                                               <span className={cn(
                                                   "font-bold text-sm",
                                                   item.daysLeft < 7 ? "text-[#ffb4ab]" :
                                                   item.daysLeft < 14 ? "text-[#facc15]" : "text-[#57ec7f]"
                                               )}>
                                                   {item.daysLeft}
                                               </span>
                                           </td>
                                           <td className="py-3 text-center font-medium text-[#dee2ec]">
                                               {new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                           </td>
                                           <td className="py-3 text-center pr-3">
                                               <span className={cn(
                                                   "px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                                                   item.risk === 'CRITICAL' ? "bg-[#93000a]/20 text-[#ffb4ab] border-[#ffb4ab]/30" :
                                                   item.risk === 'HIGH' ? "bg-[#facc15]/10 text-[#facc15] border-[#facc15]/30" : 
                                                   "bg-[#57ec7f]/10 text-[#57ec7f] border-[#57ec7f]/30"
                                               )}>
                                                   {item.risk}
                                               </span>
                                           </td>
                                       </tr>
                                   ))
                               ) : (
                                   <tr>
                                       <td colSpan={6} className="text-center py-12 text-[#8a92a6]">
                                           <CheckCircle className="w-10 h-10 mb-2 text-[#57ec7f] mx-auto" />
                                           <p className="font-mono text-xs text-[#dee2ec]">All systems normal. No stockout risks detected.</p>
                                       </td>
                                   </tr>
                               )}
                           </tbody>
                       </table>
                   </div>
                </div>
            </motion.div>
         )}
       </motion.div>
     </div>
   );
 }
 
function KpiCard({ label, value, icon: Icon, color, border, href, title, subtitle }: any) {
    const accent = color === 'rose' ? {
      rail: 'bg-[#ff5449]',
      icon: 'text-[#ffb4ab] bg-[#93000a]/30',
      value: 'text-[#ffb4ab]',
      border: 'hover:border-[#ff5449]/50',
    } : color === 'gold' ? {
      rail: 'bg-[#facc15]',
      icon: 'text-[#facc15] bg-[#facc15]/15',
      value: 'text-[#facc15]',
      border: 'hover:border-[#facc15]/50',
    } : color === 'emerald' ? {
      rail: 'bg-[#57ec7f]',
      icon: 'text-[#57ec7f] bg-[#57ec7f]/15',
      value: 'text-[#57ec7f]',
      border: 'hover:border-[#57ec7f]/50',
    } : {
      rail: 'bg-[#4cd7f6]',
      icon: 'text-[#4cd7f6] bg-[#4cd7f6]/15',
      value: 'text-[#4cd7f6]',
      border: 'hover:border-[#4cd7f6]/50',
    };

    const Content = (
      <div 
        title={title} 
        className={cn(
          "relative h-28 overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23] p-3 shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between hover:-translate-y-0.5",
          accent.border,
          border
        )}
      >
        <div className={cn("absolute left-0 top-0 h-full w-1", accent.rail)} />

        <div className="flex items-center justify-between gap-1.5 pl-1.5">
           <p className="line-clamp-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#d1c6ab]">{label}</p>
           <div className={cn("p-1 rounded-md shrink-0", accent.icon)}>
             <Icon className="w-3.5 h-3.5" />
           </div>
        </div>

        <div className="pl-1.5">
           <p className={cn("text-2xl leading-none font-bold font-mono tabular-nums tracking-tight", accent.value)}>
              {typeof value === 'number' ? <CountUp end={value} duration={1.5} separator="," /> : value}
           </p>
           {subtitle && (
              <p className="text-[10px] font-mono text-[#8a92a6] truncate mt-1">{subtitle}</p>
           )}
        </div>
      </div>
    );

    if (href) {
        return <Link href={href} className="block">{Content}</Link>;
    }
    return Content;
}
 
function AdminMetric({ label, value, target, color }: { label: string; value: string; target: string; color: string }) {
    const accentColor = color.includes('emerald') || color.includes('green')
      ? '#57ec7f'
      : color.includes('cyan') || color.includes('indigo') || color.includes('blue')
        ? '#4cd7f6'
        : color.includes('amber') || color.includes('gold')
          ? '#facc15'
          : '#ff5449';

    const numericVal = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
    const numericTarget = parseFloat(target.replace(/[^0-9.]/g, '')) || 100;
    const progressPct = Math.min(100, Math.max(0, (numericVal / (numericTarget || 100)) * 100));

    return (
      <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23] p-5 shadow-lg group hover:border-[#30353d]/80 transition-all">
         <div className="absolute inset-x-0 top-0 h-0.5" style={{ backgroundColor: accentColor }} />
         <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#d1c6ab]">{label}</p>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[#090f15] border border-[#30353d] text-[#8a92a6]">
              Target: <span className="text-[#dee2ec] font-bold">{target}</span>
            </span>
         </div>
         <p className="my-1 text-3xl font-mono font-black tabular-nums tracking-tight text-[#dee2ec]">{value}</p>
         <div className="mt-2 w-full bg-[#090f15] h-1.5 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-700" 
              style={{ width: `${progressPct}%`, backgroundColor: accentColor }} 
            />
         </div>
      </div>
    );
}
