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

// Lazy-load the heavy chart components so the dashboard shell paints fast
// instead of blocking on the full chart bundle.
const chartLoading = () => <div className="h-64 w-full rounded-2xl bg-slate-100 animate-pulse" />;
const WaterfallChart = dynamic(() => import("@/components/charts/WaterfallChart"), { ssr: false, loading: chartLoading });
const YearlyComparisonChart = dynamic(() => import("@/components/charts/YearlyComparisonChart"), { ssr: false, loading: chartLoading });
const AnnualTrendChart = dynamic(() => import("@/components/charts/AnnualTrendChart"), { ssr: false, loading: chartLoading });

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#171c23]/95 backdrop-blur-xl border border-[#30353d] p-3 rounded-xl shadow-2xl text-[#dee2ec] text-xs font-mono">
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

  // Set default date range on mount (Start from 2024 to include historical data)
  useEffect(() => {
     const now = new Date();
     const firstDay = new Date(2024, 0, 1); // Jan 1st, 2024
     setStartDate(firstDay.toISOString().split('T')[0]);
     setEndDate(now.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!startDate || !endDate) return; // Wait for initialization

      try {
        setLoading(true); // Show loading state on refetch
        
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
        console.log("[Dashboard] Fetching URL:", url);
        
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
  }, [startDate, endDate, selectedYear1, selectedYear2]); // Trigger on changes

  if (loading && !data && !startDate) { // Only show full screen loader on initial load
    return (
      <div className="min-h-screen p-8 space-y-8">
         <div className="flex justify-between items-center">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-40 rounded-[2rem]" />)}
         </div>
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-96 rounded-3xl col-span-2" />
            <Skeleton className="h-96 rounded-3xl" />
         </div>
      </div>
    );
  }

  // ... Error handling remains the same ...
  if (error && !data) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
            <div className="max-w-md w-full bg-white border border-red-200 p-6 rounded-2xl shadow-lg">
                <AlertTriangle className="h-12 w-12 text-red-500 mb-4 mx-auto" />
                <h2 className="text-xl font-bold text-slate-900 text-center mb-2">Connection Error</h2>
                <p className="text-red-600 text-center mb-4">{error}</p>
                <div className="bg-slate-100 p-3 rounded-lg text-xs font-mono text-slate-600 break-all mb-4">
                    Attempted URL: {debugInfo}
                </div>
                <button 
                    onClick={() => window.location.reload()}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-200"
                >
                    Retry Connection
                </button>
            </div>
        </div>
      );
  }

  // Stagger children animation
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  if (!mounted) return null; // Prevent hydration mismatch

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
        className="max-w-[1500px] mx-auto space-y-7"
      >
        {/* Stitch Top Telemetry Strip */}
        <motion.div variants={item}>
          <StitchTelemetryStrip summary={data?.summary} />
        </motion.div>

        {/* Header Section (Stitch Tactical Command Card) */}
        <div className="relative overflow-hidden rounded-xl border border-[#30353d] bg-[#171c23]/90 p-5 shadow-2xl backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#facc15] via-[#4cd7f6] to-[#57ec7f]" />
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <motion.div variants={item} className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#facc15] text-[#1b1600] font-headline text-base font-extrabold shadow-md">
                WMS
              </div>
              <div>
                <p className="mb-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#4cd7f6]">
                  Tactical Operations Command Platform
                </p>
                <h1 className="font-headline text-2xl md:text-3xl font-black tracking-tight text-[#dee2ec]">
                  {t('dashboard_title')}
                </h1>
                <p className="font-mono text-xs text-[#d1c6ab]">{t('dashboard_subtitle')}</p>
              </div>
            </motion.div>
            
            <motion.div variants={item} className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <DashboardCustomizer visibleWidgets={visibleWidgets} toggleWidget={toggleWidget} />
              
              <div className="flex items-center gap-2 rounded-lg border border-[#30353d] bg-[#090f15] p-1.5 shadow-inner">
                <div className="relative group">
                  <Calendar className="absolute left-2.5 top-2 h-4 w-4 text-[#d1c6ab]" />
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-8 pr-2 py-1 bg-[#171c23] border border-[#30353d] rounded text-xs font-mono text-[#dee2ec] focus:border-[#facc15] outline-none transition-all cursor-pointer"
                  />
                </div>
                <span className="text-[#d1c6ab] font-mono text-xs">→</span>
                <div className="relative group">
                  <Calendar className="absolute left-2.5 top-2 h-4 w-4 text-[#d1c6ab]" />
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pl-8 pr-2 py-1 bg-[#171c23] border border-[#30353d] rounded text-xs font-mono text-[#dee2ec] focus:border-[#facc15] outline-none transition-all cursor-pointer"
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Tab Navigation (Stitch Tactical Tabs) */}
        <motion.div variants={item} className="flex w-full max-w-xl flex-wrap gap-1.5 rounded-lg border border-[#30353d] bg-[#171c23]/90 p-1.5 shadow-lg backdrop-blur-xl font-mono text-xs">
          <button
            onClick={() => setActiveTab("operational")}
            className={cn(
              "px-5 py-2 rounded font-bold transition-all duration-200",
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
              "px-5 py-2 rounded font-bold transition-all duration-200",
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
              "px-5 py-2 rounded font-bold transition-all duration-200 flex items-center gap-1.5",
              activeTab === "forecast"
                ? "bg-[#57ec7f] text-[#002109] shadow-sm"
                : "text-[#d1c6ab] hover:text-[#dee2ec] hover:bg-[#252a32]"
            )}
          >
            <span>Forecast</span>
            <span className="px-1 py-0.2 rounded text-[9px] uppercase font-mono font-black bg-black/20">
              AI
            </span>
          </button>
        </motion.div>

        {activeTab === "operational" && (
          <motion.div variants={item}>
            <StitchDockMatrix movements={data?.recentTransactions || []} />
          </motion.div>
        )}

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
                     <div className="grid grid-cols-2 lg:grid-cols-6 gap-6">
                        <motion.div variants={item} transition={{ delay: 0.05 }}>
                           <KpiCard label={t('kpi_active_items')} value={data?.summary?.activeSkuCount || 0} icon={CheckCircle} bg="bg-violet-50" color="text-violet-500" href="/inventory?status=ALL" />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.1 }}>
                           <KpiCard label={t('kpi_total_stock')} value={data?.summary?.totalStock || 0} icon={Package} bg="bg-blue-50" color="text-blue-500" href="/inventory?status=ALL" />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.15 }}>
                           <KpiCard label={t('kpi_total_value')} value={`฿${(data?.summary?.totalValue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={DollarSign} bg="bg-green-50" color="text-green-600" />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.2 }}>
                           <KpiCard label={t('kpi_inbound_total')} value={data?.summary?.inboundPeriod || 0} icon={ArrowDownRight} bg="bg-indigo-50" color="text-indigo-500" href="/ops/receiving" />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.25 }}>
                            <KpiCard label={t('kpi_outbound_total')} value={data?.summary?.outboundPeriod || 0} icon={ArrowUpRight} bg="bg-emerald-50" color="text-emerald-500" href="/ops/outbound" />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.28 }}>
                            <KpiCard 
                              label={t('kpi_flow_ratio')} 
                              value={data?.summary?.inboundPeriod && data?.summary?.outboundPeriod ? (data.summary.inboundPeriod / (data.summary.outboundPeriod || 1)).toFixed(2) : "0.00"}
                              icon={Activity} 
                              bg="bg-indigo-50" 
                              color="text-indigo-600" 
                              title={t('tooltip_flow_ratio') || "อัตราส่วนระหว่างยอดรับเข้าสะสมเทียบกับยอดจ่ายออกสะสมในช่วงเวลาที่เลือก (Inbound Total / Outbound Total)"}
                            />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.3 }}>
                           <KpiCard label={t('kpi_dead_stock')} value={data?.summary?.deadStockCount || 0} icon={Clock} bg="bg-slate-100" color="text-slate-500" href="/inventory?movement=Deadstock" />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.35 }}>
                           <KpiCard label={t('kpi_aging_stock')} value={data?.summary?.agingStockCount || 0} icon={Clock} bg="bg-rose-50" color="text-rose-600" border={data?.summary?.agingStockCount > 10 ? "border-rose-200" : ""} href="/analytics/aging" />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.4 }}>
                           <KpiCard label={t('kpi_low_stock')} value={data?.summary?.lowStockCount || 0} icon={AlertTriangle} bg="bg-rose-50" color="text-rose-500" border={data?.summary?.lowStockCount > 0 ? "border-rose-200" : ""} href="/inventory?status=LOW" />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.45 }}>
                            <KpiCard 
                              label={t('kpi_space_occupancy')} 
                              value={`${(data?.executive?.spaceEfficiency || 0).toFixed(1)}%`}
                              icon={MapPin} 
                              bg="bg-violet-50" 
                              color="text-violet-600" 
                            />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.5 }}>
                           <KpiCard 
                             label={t('kpi_turnover_rate')} 
                             value={`${(data?.summary?.turnoverRate || 0).toFixed(1)}%`} 
                             icon={Activity} 
                             bg="bg-emerald-50" 
                             color="text-emerald-500" 
                             title={t('tooltip_turnover_rate') || "อัตราส่วนการหมุนเวียนสินค้าคำนวณจาก ยอดจ่ายออกสะสม / ยอดสินค้าคงเหลือทั้งหมด (Outbound Period / Total Stock)"}
                           />
                        </motion.div>
                        <motion.div variants={item} transition={{ delay: 0.6 }}>
                           <KpiCard 
                             label={t('kpi_empty_locations') || "Empty Locations"} 
                             value={data?.summary?.emptyLocationCount || 0} 
                             icon={MapPin} 
                             bg="bg-gray-50" 
                             color="text-gray-500"
                             title={data?.summary?.emptyLocationList?.join('\n')}
                           />
                        </motion.div>
                     </div>
                  ) : null,

                  chart_top_sellers: visibleWidgets['charts'] ? (
                      <div className="h-96 rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-lg flex flex-col">
                          <h3 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider mb-6 flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-[#facc15] rounded-full"></span>
                            {t('chart_top_sellers')}
                          </h3>
                          <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                               <BarChart
                                     data={data?.topSellers?.slice(0, 10) || []}
                                     layout="vertical"
                                     margin={{ top: 10, right: 30, left: 40, bottom: 0 }}
                                 >
                                     <defs>
                                         <linearGradient id="bestSellerGrad" x1="0" y1="0" x2="1" y2="0">
                                             <stop offset="0%" stopColor="#facc15" stopOpacity={0.95}/>
                                             <stop offset="100%" stopColor="#eab308" stopOpacity={0.6}/>
                                         </linearGradient>
                                     </defs>
                                     <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" horizontal={true} vertical={false} />
                                     <XAxis type="number" stroke="#64748b" fontSize={10} tick={{fill: '#d1c6ab'}} />
                                     <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={10} tick={{fill: '#d1c6ab'}} width={100} />
                                     <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255, 255, 255, 0.04)'}} />
                                     <Bar dataKey="qty" name="Sold Qty" fill="url(#bestSellerGrad)" radius={[0, 6, 6, 0]} barSize={14} />
                                 </BarChart>
                            </ResponsiveContainer>
                         </div>
                     </div>
                  ) : null,

                  chart_inventory_health: visibleWidgets['charts'] ? (
                      <div className="h-96 rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-lg flex flex-col">
                          <h3 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider mb-6 flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-[#57ec7f] rounded-full"></span>
                            {t('chart_inventory_health')}
                         </h3>
                         <div className="flex-1 w-full min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                               <PieChart>
                                  <Pie 
                                     data={data?.healthData || []} 
                                     dataKey="value" 
                                     nameKey="name"
                                     cx="50%" cy="50%" 
                                     innerRadius={50} outerRadius={70}
                                     paddingAngle={4} cornerRadius={6}
                                     label={({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
                                        if (!value) return null;
                                        const RADIAN = Math.PI / 180;
                                        const r = (outerRadius || 0) * 1.25;
                                        const x = (cx || 0) + r * Math.cos(-(midAngle || 0) * RADIAN);
                                        const y = (cy || 0) + r * Math.sin(-(midAngle || 0) * RADIAN);
                                        return <text x={x} y={y} fill="#dee2ec" textAnchor={x > (cx || 0) ? 'start' : 'end'} dominantBaseline="central" fontSize={11} fontWeight="bold" fontFamily="monospace">{value}</text>;
                                     }}
                                  >
                                     {(data?.healthData || []).map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={entry.name === 'Healthy' ? '#57ec7f' : entry.name === 'Low' ? '#facc15' : '#ffb4ab'} stroke="none" />
                                     ))}
                                  </Pie>
                                  <Tooltip content={<CustomTooltip />} />
                                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ color: '#dee2ec', fontSize: '11px' }} />
                               </PieChart>
                            </ResponsiveContainer>
                         </div>
                     </div>
                  ) : null,
                  
                  chart_sales_category: visibleWidgets['charts'] ? (
                       <div className="h-96 rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-lg flex flex-col">
                           <h3 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider mb-6 flex items-center gap-2">
                             <span className="w-1.5 h-4 bg-[#4cd7f6] rounded-full"></span>
                             {t('chart_sales_category')}
                           </h3>
                           <div className="flex-1 w-full min-h-0">
                               <ResponsiveContainer width="100%" height="100%">
                                   <PieChart>
                                       <Pie
                                           data={data?.categorySales || []}
                                           dataKey="value"
                                           nameKey="name"
                                           cx="50%" cy="50%"
                                           innerRadius={55} outerRadius={70}
                                           paddingAngle={3} cornerRadius={5}
                                       >
                                           {(data?.categorySales || []).map((entry: any, index: number) => (
                                               <Cell key={`cell-${index}`} fill={['#4cd7f6', '#57ec7f', '#facc15', '#a78bfa', '#f43f5e'][index % 5]} stroke="none" />
                                           ))}
                                       </Pie>
                                       <Tooltip content={<CustomTooltip />} />
                                       <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', color: '#dee2ec' }} />
                                   </PieChart>
                               </ResponsiveContainer>
                           </div>
                       </div>
                  ) : null,

                  chart_weekly_activity: visibleWidgets['charts'] ? (
                       <div className="h-96 rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-lg flex flex-col">
                           <h3 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider mb-6 flex items-center gap-2">
                             <span className="w-1.5 h-4 bg-[#f97316] rounded-full"></span>
                             {t('chart_weekly_activity')}
                           </h3>
                           <div className="flex-1 w-full min-h-0">
                              <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={data?.movementData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                      <defs>
                                           <linearGradient id="colorInGrad" x1="0" y1="0" x2="0" y2="1">
                                               <stop offset="5%" stopColor="#4cd7f6" stopOpacity={0.9}/>
                                               <stop offset="95%" stopColor="#0284c7" stopOpacity={0.4}/>
                                           </linearGradient>
                                           <linearGradient id="colorOutGrad" x1="0" y1="0" x2="0" y2="1">
                                               <stop offset="5%" stopColor="#57ec7f" stopOpacity={0.9}/>
                                               <stop offset="95%" stopColor="#16a34a" stopOpacity={0.4}/>
                                           </linearGradient>
                                       </defs>
                                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
                                      <XAxis dataKey="name" stroke="#64748b" fontSize={10} tick={{fill: '#d1c6ab'}} />
                                      <YAxis stroke="#64748b" fontSize={10} tick={{fill: '#d1c6ab'}} />
                                      <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255, 255, 255, 0.04)'}} />
                                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', color: '#dee2ec' }} />
                                      <Bar dataKey="in" name={t('legend_inbound')} fill="url(#colorInGrad)" radius={[4, 4, 0, 0]} barSize={12} />
                                      <Bar dataKey="out" name={t('legend_outbound')} fill="url(#colorOutGrad)" radius={[4, 4, 0, 0]} barSize={12} />
                                  </BarChart>
                              </ResponsiveContainer>
                          </div>
                       </div>
                  ) : null,

                  table_low_stock: visibleWidgets['recent_activity'] ? (
                     <div className="h-96 rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-lg overflow-hidden flex flex-col">
                        <h3 className="text-xs font-mono font-bold text-[#ffb4ab] uppercase tracking-wider mb-4 flex items-center gap-2">
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
                     <div className="h-96 rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-lg overflow-hidden flex flex-col">
                        <h3 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider mb-4 flex items-center gap-2">
                           <Activity className="h-4 w-4 text-[#facc15]" /> {t('section_recent_activity')}
                        </h3>
                        <div className="flex-1 overflow-auto">
                           <ul className="space-y-3">
                              {data?.recentActivity?.map((activity: any, index: number) => (
                                 <li key={index} className="flex items-center space-x-3 text-xs p-2 rounded-lg bg-[#090f15]/50 border border-[#30353d]/50 hover:bg-[#1d232c] transition-colors">
                                    {activity.type === 'inbound' ? (
                                       <div className="bg-[#57ec7f]/20 border border-[#57ec7f]/30 p-1.5 rounded"><ArrowDownRight className="h-3 w-3 text-[#57ec7f]" /></div>
                                    ) : (
                                       <div className="bg-[#ffb4ab]/20 border border-[#ffb4ab]/30 p-1.5 rounded"><ArrowUpRight className="h-3 w-3 text-[#ffb4ab]" /></div>
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

        {/* Executive Tab - including Waterfall and Radar */}
        {activeTab === "executive" && (
           <motion.div 
             initial={{ opacity: 0, x: 20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ duration: 0.5 }}
             className="h-full flex flex-col gap-8 overflow-auto pr-2 pb-8"
           >
               <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <AdminMetric label={t('metric_accuracy')} value={`${(data?.executive?.accuracy || 0).toFixed(2)}%`} target="100%" color="text-indigo-500" />
                  <AdminMetric label={t('metric_damage')} value={`${(data?.executive?.damageRate || 0).toFixed(2)}%`} target="0.00%" color="text-rose-500" />
                  <AdminMetric label={t('metric_space')} value={`${(data?.executive?.spaceEfficiency || 0).toFixed(1)}%`} target="100%" color="text-amber-500" />
                  <AdminMetric label={t('metric_fulfillment')} value={`${(data?.executive?.otif || 0).toFixed(1)}%`} target="100%" color="text-emerald-500" />
               </div>
               
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   <div className="rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-lg">
                      <h3 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider mb-6 flex items-center gap-2">
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
                  
                   <div className="rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-lg">
                      <h3 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider mb-6 flex items-center gap-2">
                         <span className="w-1.5 h-4 bg-[#a78bfa] rounded-full"></span>
                         {t('chart_performance_radar')}
                       </h3>
                      <div className="h-64 w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={data?.executive?.radarData || []}>
                               <PolarGrid stroke="#30353d" />
                               <PolarAngleAxis dataKey="metric" stroke="#64748b" fontSize={11} tick={{ fill: '#d1c6ab', fontWeight: 600 }} />
                               <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#64748b" fontSize={9} tick={false} />
                               <Radar name="Actual" dataKey="actual" stroke="#818cf8" fill="#818cf8" fillOpacity={0.6} animationDuration={1000} />
                               <Radar name="Target" dataKey="target" stroke="#57ec7f" fill="#57ec7f" fillOpacity={0.2} animationDuration={1000} />
                               <Tooltip contentStyle={{ background: '#171c23', border: '1px solid #30353d', borderRadius: '12px', color: '#dee2ec', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }} itemStyle={{ color: '#dee2ec' }} />
                               <Legend wrapperStyle={{ color: '#dee2ec', fontSize: '11px' }} />
                            </RadarChart>
                         </ResponsiveContainer>
                      </div>
                   </div>
               </div>

               {/* Year Over Year Comparison */}
               <div className="rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-lg">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
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
               <div className="rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-lg">
                  <h3 className="text-xs font-mono font-bold text-[#dee2ec] uppercase tracking-wider mb-6 flex items-center gap-2">
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

                <div className="rounded-xl border border-[#30353d] bg-[#171c23] p-6 shadow-lg overflow-hidden">
                   <div className="flex justify-between items-center mb-6">
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
                                       <td colSpan={6} className="text-center py-12 text-[#8a92a6] flex flex-col items-center">
                                           <CheckCircle className="w-10 h-10 mb-2 text-[#57ec7f]" />
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
 
function KpiCard({ label, value, icon: Icon, color, bg, border, href, title }: any) {
    const palette = color.includes('rose') ? {
      shell: 'border-[#30353d] bg-[#171c23] hover:border-[#ffb4ab]/60',
      icon: 'bg-[#93000a] text-[#ffdad6]',
      rail: 'bg-[#ffb4ab]',
      value: 'text-[#ffb4ab]',
    } : color.includes('amber') ? {
      shell: 'border-[#30353d] bg-[#171c23] hover:border-[#facc15]/60',
      icon: 'bg-[#facc15]/20 text-[#facc15]',
      rail: 'bg-[#facc15]',
      value: 'text-[#facc15]',
    } : color.includes('green') || color.includes('emerald') ? {
      shell: 'border-[#30353d] bg-[#171c23] hover:border-[#57ec7f]/60',
      icon: 'bg-[#57ec7f]/20 text-[#57ec7f]',
      rail: 'bg-[#57ec7f]',
      value: 'text-[#57ec7f]',
    } : color.includes('violet') || color.includes('cyan') ? {
      shell: 'border-[#30353d] bg-[#171c23] hover:border-[#4cd7f6]/60',
      icon: 'bg-[#4cd7f6]/20 text-[#4cd7f6]',
      rail: 'bg-[#4cd7f6]',
      value: 'text-[#4cd7f6]',
    } : color.includes('blue') || color.includes('indigo') ? {
      shell: 'border-[#30353d] bg-[#171c23] hover:border-[#facc15]/60',
      icon: 'bg-[#facc15]/20 text-[#facc15]',
      rail: 'bg-[#facc15]',
      value: 'text-[#dee2ec]',
    } : {
      shell: 'border-[#30353d] bg-[#171c23] hover:border-[#facc15]/60',
      icon: 'bg-[#252a32] text-[#dee2ec]',
      rail: 'bg-[#30353d]',
      value: 'text-[#dee2ec]',
    };

    const Content = (
      <div title={title} className={cn("relative h-40 overflow-hidden rounded-xl border p-5 shadow-lg transition-all duration-300 cursor-pointer group hover:-translate-y-0.5 hover:shadow-xl", palette.shell, border)}>
        <div className={cn("absolute left-0 top-0 h-full w-1", palette.rail)} />

        <div className="relative z-10 flex items-start justify-between">
           <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg shadow", palette.icon)}>
             <Icon className="h-5 w-5" />
           </div>
        </div>

        <div className="relative z-10 mt-3">
           <p className="mb-1.5 line-clamp-2 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-[#d1c6ab]">{label}</p>
           <p className={cn("text-[2.2rem] leading-none font-bold font-mono tabular-nums tracking-tight", palette.value)}>
              {typeof value === 'number' ? <CountUp end={value} duration={1.8} separator="," /> : value}
           </p>
        </div>
      </div>
    );

    if (href) {
        return <Link href={href} className="block">{Content}</Link>;
    }
    return Content;
}
 
 function AdminMetric({ label, value, target, color }: any) {
    const accent = color.includes('indigo') ? {
      shell: 'border-blue-400/30 bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 shadow-blue-900/18',
      rail: 'bg-cyan-300',
      glow: 'bg-cyan-300/16',
    } : color.includes('rose') ? {
      shell: 'border-rose-300/30 bg-gradient-to-br from-rose-700 via-rose-600 to-pink-500 shadow-rose-900/18',
      rail: 'bg-pink-200',
      glow: 'bg-pink-200/16',
    } : color.includes('amber') ? {
      shell: 'border-amber-300/30 bg-gradient-to-br from-amber-700 via-orange-600 to-amber-500 shadow-amber-900/18',
      rail: 'bg-amber-100',
      glow: 'bg-amber-100/16',
    } : color.includes('emerald') ? {
      shell: 'border-emerald-300/30 bg-gradient-to-br from-emerald-800 via-teal-700 to-emerald-600 shadow-emerald-900/18',
      rail: 'bg-teal-100',
      glow: 'bg-teal-100/16',
    } : {
      shell: 'border-slate-300/30 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 shadow-slate-900/18',
      rail: 'bg-slate-200',
      glow: 'bg-white/10',
    };

    return (
      <div className={cn("relative flex h-36 flex-col overflow-hidden rounded-2xl border p-5 text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl", accent.shell)}>
         <div className={cn("absolute inset-x-0 top-0 h-1", accent.rail)} />
         <div className={cn("absolute -right-10 -top-10 h-28 w-28 rounded-full", accent.glow)} />
         <div className="relative z-10">
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/78">{label}</p>
            <p className="mb-1 text-3xl font-black tracking-tight text-white drop-shadow-sm">{value}</p>
            <p className="text-[10px] font-semibold text-white/72">Target: <span className="font-black text-white">{target}</span></p>
         </div>
      </div>
    );
  }
