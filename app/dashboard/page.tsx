"use client";

import { getApiUrl } from "@/lib/config";
import { useEffect, useState } from "react";
import CountUp from 'react-countup';
import {
  Activity,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Calendar,
  Clock,
  CheckCircle,
  MapPin,
  ScanLine,
  ShieldAlert,
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
import DashboardAlertsBanner from "@/components/DashboardAlertsBanner";
import QuickActionsPanel from "@/components/QuickActionsPanel";
import { DashboardCustomizer, useDashboardCustomization } from "@/components/DashboardCustomizer";
import { DashboardGridLayout } from "@/components/dashboard/DashboardGridLayout";
import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import StockDepletionChart from "@/components/StockDepletionChart";
import { generateDepletionData } from "@/lib/forecast";
import StitchDockMatrix from "@/components/dashboard/StitchDockMatrix";
import { HYBRID_TOOLTIP_STYLE } from "@/lib/chartTheme";

// Lazy-load the heavy chart components
const chartLoading = () => <div className="h-64 w-full rounded-2xl bg-slate-100 border border-slate-200 animate-pulse" />;
const WaterfallChart = dynamic(() => import("@/components/charts/WaterfallChart"), { ssr: false, loading: chartLoading });
const YearlyComparisonChart = dynamic(() => import("@/components/charts/YearlyComparisonChart"), { ssr: false, loading: chartLoading });
const AnnualTrendChart = dynamic(() => import("@/components/charts/AnnualTrendChart"), { ssr: false, loading: chartLoading });

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-md border border-slate-200 p-3 rounded-xl shadow-lg text-slate-900 text-xs">
        <p className="font-bold mb-1.5 text-slate-900 border-b border-slate-100 pb-1.5">{label}</p>
        {payload.map((pld: any, index: number) => (
          <div key={index} className="flex justify-between items-center gap-4 py-0.5">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pld.color || pld.fill }} />
              {pld.name || pld.dataKey}:
            </span>
            <span className="font-bold text-slate-900 tabular-nums">{typeof pld.value === 'number' ? pld.value.toLocaleString() : pld.value}</span>
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
      <div className="min-h-screen p-6 space-y-6 bg-transparent">
         <div className="flex justify-between items-center nx-glass-card p-5">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48 bg-slate-200/80" />
              <Skeleton className="h-4 w-64 bg-slate-200/60" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28 bg-slate-200/80 rounded-full" />
              <Skeleton className="h-9 w-28 bg-slate-200/80 rounded-full" />
            </div>
         </div>
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <Skeleton className="h-64 lg:col-span-5 nx-glass-card" />
            <Skeleton className="h-64 lg:col-span-4 nx-glass-card" />
            <Skeleton className="h-64 lg:col-span-3 nx-dark-accent-card" />
         </div>
         <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-28 nx-glass-card" />)}
         </div>
      </div>
    );
  }

  if (error && !data) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-transparent">
            <div className="max-w-md w-full nx-glass-card border-rose-200 p-6 text-slate-900">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-7 w-7" />
                </div>
                <h2 className="text-xl font-bold text-center mb-2">Connection Error</h2>
                <p className="text-rose-600 text-center text-xs font-medium mb-4">{error}</p>
                <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-mono text-slate-600 break-all mb-4">
                    Attempted URL: {debugInfo}
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-sm"
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
        staggerChildren: 0.06
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 }
  };

  if (!mounted) return null;

  const summary = data?.summary || {};
  const heroTotalValue = Number(summary.totalValue || 0);
  const heroTotalStock = Number(summary.totalStock || 0);
  const heroInbound = Number(summary.inboundPeriod || 0);
  const heroOutbound = Number(summary.outboundPeriod || 0);
  const heroFlowRatio = heroOutbound > 0
    ? (heroInbound / heroOutbound).toFixed(2)
    : heroInbound > 0
      ? heroInbound.toFixed(2)
      : "0.00";

  const movementPoints: number[] = (data?.movementData || [])
    .slice(-14)
    .map((d: any) => (Number(d.in) || 0) + (Number(d.out) || 0));
  const flowPoints: number[] =
    movementPoints.filter((v: number) => v > 0).length >= 2
      ? movementPoints
      : (data?.topSellers || []).length >= 2
        ? data.topSellers.slice(0, 10).map((s: any) => Number(s.totalSold || s.qty || s.value || 0))
        : (data?.categoryDistribution || []).length >= 2
          ? data.categoryDistribution.map((c: any) => Number(c.value || c.count || 0))
          : [12, 18, 14, 22, 19, 27, 25];
  const minFlow = Math.min(...flowPoints);
  const maxFlow = Math.max(...flowPoints);
  const span = Math.max(1, maxFlow - minFlow);
  const sparkW = 280;
  const sparkH = 64;
  const sparkCoords = flowPoints.map((val, idx) => {
    const x = flowPoints.length > 1 ? (idx / (flowPoints.length - 1)) * sparkW : sparkW / 2;
    const y = sparkH - 8 - (((val - minFlow) / span) * (sparkH - 18));
    return { x, y };
  });
  const sparkLinePath = sparkCoords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const sparkAreaPath = `${sparkLinePath} L ${sparkW} ${sparkH} L 0 ${sparkH} Z`;

  const heroHealthData = data?.healthData || [];
  const heroTotalHealthSKUs = heroHealthData.reduce((acc: number, curr: any) => acc + (Number(curr.value) || 0), 0);
  const heroHealthyItem = heroHealthData.find((h: any) => h.name === 'Healthy' || h.name === 'ปกติ');
  const heroHealthyCount = heroHealthyItem ? Number(heroHealthyItem.value) : 0;
  const heroHealthyPct = heroTotalHealthSKUs > 0 ? Math.round((heroHealthyCount / heroTotalHealthSKUs) * 100) : 0;
  const heroHealthLow = Number(heroHealthData.find((h: any) => h.name === 'Low' || h.name === 'ใกล้หมด')?.value ?? summary.lowStockCount ?? 0);
  const heroHealthOut = Number(heroHealthData.find((h: any) => h.name === 'Out' || h.name === 'หมดสต็อก')?.value ?? summary.outOfStockCount ?? 0);

  const gaugeRadius = 82;
  const gaugeArcLen = Math.PI * gaugeRadius;
  const gaugeOffset = gaugeArcLen * (1 - Math.max(0, Math.min(100, heroHealthyPct)) / 100);
  const gaugeColor = heroHealthyPct >= 75 ? '#10b981' : heroHealthyPct >= 50 ? '#f59e0b' : '#ef4444';
  const gaugeTicks = Array.from({ length: 19 }, (_, idx) => {
    const angle = Math.PI - (idx / 18) * Math.PI;
    const rOuter = 68;
    const rInner = idx % 3 === 0 ? 59 : 63;
    return {
      x1: 110 + rInner * Math.cos(angle),
      y1: 112 - rInner * Math.sin(angle),
      x2: 110 + rOuter * Math.cos(angle),
      y2: 112 - rOuter * Math.sin(angle),
      major: idx % 3 === 0,
    };
  });

  const heroLowCount = Number(summary.lowStockCount || 0);
  const heroOutCount = Number(summary.outOfStockCount || 0);
  const heroAgingCount = Number(summary.agingStockCount || 0);
  const exceptionsCount = heroLowCount + heroOutCount;

  return (
    <div className="min-h-screen relative px-4 py-6 pb-32 sm:px-6 lg:p-8 bg-transparent text-[#0f172a]">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-[1500px] mx-auto space-y-6"
      >
        {/* V7 Open Greeting Row */}
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800 bg-white/65 backdrop-blur-md border border-white/80 px-2.5 py-0.5 rounded-full shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Operations Command Platform
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
              {t('dashboard_title')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">{t('dashboard_subtitle')}</p>
          </div>

          {/* Right: Pill Segmented Mode Switcher, Date Range Pill & Customize Pill */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center rounded-full border border-white/85 bg-white/65 backdrop-blur-md p-1 text-xs shadow-xs">
              <button
                onClick={() => setActiveTab("operational")}
                className={cn(
                  "px-4 py-1.5 rounded-full font-semibold transition-all",
                  activeTab === "operational"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {t('tab_operational')}
              </button>
              <button
                onClick={() => setActiveTab("executive")}
                className={cn(
                  "px-4 py-1.5 rounded-full font-semibold transition-all",
                  activeTab === "executive"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {t('tab_executive')}
              </button>
              <button
                onClick={() => setActiveTab("forecast")}
                className={cn(
                  "px-4 py-1.5 rounded-full font-semibold transition-all flex items-center gap-1.5",
                  activeTab === "forecast"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <span>Forecast</span>
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[9px] uppercase font-bold",
                  activeTab === "forecast"
                    ? "bg-white/20 text-white"
                    : "bg-emerald-500/15 text-emerald-700"
                )}>
                  AI
                </span>
              </button>
            </div>

            {/* Date Range Pill */}
            <div className="flex items-center gap-1.5 rounded-full border border-white/85 bg-white/75 backdrop-blur-md px-3 py-1 shadow-xs">
              <Calendar className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-slate-800 font-medium outline-none cursor-pointer tabular-nums"
              />
              <span className="text-slate-400 text-xs">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-slate-800 font-medium outline-none cursor-pointer tabular-nums"
              />
            </div>

            {/* Customizer */}
            <DashboardCustomizer visibleWidgets={visibleWidgets} toggleWidget={toggleWidget} />
          </div>
        </div>

        {/* Critical Alerts & Quick Actions (Preserved Customization Widgets) */}
        {(visibleWidgets['alerts'] || visibleWidgets['quick_actions']) && (
          <div className="flex flex-col gap-3">
            {visibleWidgets['alerts'] && <DashboardAlertsBanner />}
            {visibleWidgets['quick_actions'] && <QuickActionsPanel />}
          </div>
        )}

        {/* 3-Column V7 + V31 Hero Bento Row */}
        <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left (5 cols): Inventory Value + Inbound/Outbound + Sparkline */}
          <div className="lg:col-span-5 nx-glass-card p-6 flex flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Inventory Value
                </p>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 tabular-nums">
                    ฿{heroTotalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 tabular-nums">
                  On-hand {heroTotalStock.toLocaleString()} units across warehouse
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/12 text-emerald-700 border border-emerald-500/20 tabular-nums shrink-0">
                In/Out {heroFlowRatio}x
              </span>
            </div>

            {/* Inline SVG Sparkline / Area Curve */}
            <div className="relative w-full h-16">
              <svg viewBox={`0 0 ${sparkW} ${sparkH}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="heroSparkFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                <path d={sparkAreaPath} fill="url(#heroSparkFill)" />
                <path d={sparkLinePath} fill="none" stroke="#10b981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                {sparkCoords.length > 0 && (
                  <circle
                    cx={sparkCoords[sparkCoords.length - 1].x}
                    cy={sparkCoords[sparkCoords.length - 1].y}
                    r="3.5"
                    fill="#10b981"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                )}
              </svg>
            </div>

            {/* Inbound / Outbound Comparison */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-900/8">
              <div className="flex items-center justify-between rounded-xl bg-white/60 border border-white/80 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-emerald-500/12 text-emerald-700">
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-xs font-medium text-slate-600">Inbound</span>
                </div>
                <span className="text-sm font-bold text-slate-900 tabular-nums">{heroInbound.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/60 border border-white/80 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-amber-500/12 text-amber-700">
                    <ArrowUpFromLine className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-xs font-medium text-slate-600">Outbound</span>
                </div>
                <span className="text-sm font-bold text-slate-900 tabular-nums">{heroOutbound.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Middle (4 cols): V7 Semi-Circular Radial Arc Gauge */}
          <div className="lg:col-span-4 nx-glass-card p-6 flex flex-col items-center justify-between">
            <div className="w-full flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Warehouse Health
              </span>
              <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
                {heroTotalHealthSKUs.toLocaleString()} SKUs
              </span>
            </div>

            <div className="relative w-full max-w-[240px] flex flex-col items-center my-1">
              <svg viewBox="0 0 220 124" className="w-full overflow-visible">
                {/* Subtle perimeter tick marks */}
                {gaugeTicks.map((tick, idx) => (
                  <line
                    key={idx}
                    x1={tick.x1}
                    y1={tick.y1}
                    x2={tick.x2}
                    y2={tick.y2}
                    stroke={tick.major ? 'rgba(15, 23, 42, 0.25)' : 'rgba(15, 23, 42, 0.12)'}
                    strokeWidth={tick.major ? 1.8 : 1.1}
                    strokeLinecap="round"
                  />
                ))}
                {/* Track Arc */}
                <path
                  d="M 28 112 A 82 82 0 0 1 192 112"
                  fill="none"
                  stroke="rgba(15, 23, 42, 0.08)"
                  strokeWidth="14"
                  strokeLinecap="round"
                />
                {/* Progress Arc */}
                <path
                  d="M 28 112 A 82 82 0 0 1 192 112"
                  fill="none"
                  stroke={gaugeColor}
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={gaugeArcLen}
                  strokeDashoffset={gaugeOffset}
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
              </svg>
              <div className="absolute bottom-2 flex flex-col items-center">
                <span className="text-4xl font-bold tracking-tight text-slate-900 tabular-nums leading-none">
                  {heroHealthyPct}%
                </span>
                <span className="text-[11px] font-semibold text-slate-500 mt-1">
                  Healthy Stock
                </span>
              </div>
            </div>

            <div className="w-full flex items-center justify-center gap-2 flex-wrap pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/12 text-emerald-700 border border-emerald-500/20 tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                OK {heroHealthyCount.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/12 text-amber-800 border border-amber-500/25 tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Low {heroHealthLow.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/12 text-rose-700 border border-rose-500/20 tabular-nums">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                Out {heroHealthOut.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Right (3 cols): V31 Dark Frosted Highlight Card (Exceptions & Quick Actions) */}
          <div className="lg:col-span-3 nx-dark-accent-card p-6 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Exceptions
              </span>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                exceptionsCount > 0
                  ? "bg-amber-500/20 border-amber-400/35 text-amber-300"
                  : "bg-emerald-500/20 border-emerald-400/35 text-emerald-300"
              )}>
                {exceptionsCount > 0 ? 'Action Needed' : 'All Clear'}
              </span>
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-white tabular-nums">
                  {exceptionsCount.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">SKUs</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] tabular-nums">
                <Link
                  href="/inventory?status=LOW"
                  className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-400/25 text-amber-200 hover:bg-amber-500/25 transition-colors font-semibold"
                >
                  Low {heroLowCount.toLocaleString()}
                </Link>
                <Link
                  href="/inventory?status=OUT"
                  className="px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-400/25 text-rose-200 hover:bg-rose-500/25 transition-colors font-semibold"
                >
                  Out {heroOutCount.toLocaleString()}
                </Link>
                <Link
                  href="/analytics/aging"
                  className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-slate-200 hover:bg-white/15 transition-colors font-semibold"
                >
                  Aging {heroAgingCount.toLocaleString()}
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-white/10">
              <Link
                href="/ops/receiving"
                className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white/8 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-400/30 py-2 px-1 text-[11px] font-semibold text-white transition-all"
              >
                <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
                <span>Inbound</span>
              </Link>
              <Link
                href="/ops/outbound"
                className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white/8 hover:bg-amber-500/20 border border-white/10 hover:border-amber-400/30 py-2 px-1 text-[11px] font-semibold text-white transition-all"
              >
                <ArrowUpFromLine className="w-3.5 h-3.5 text-amber-400" />
                <span>Outbound</span>
              </Link>
              <Link
                href="/barcode/scanner"
                className="flex flex-col items-center justify-center gap-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 py-2 px-1 text-[11px] font-bold text-slate-950 transition-all"
              >
                <ScanLine className="w-3.5 h-3.5" />
                <span>Scan F2</span>
              </Link>
            </div>
          </div>
        </motion.div>

        {activeTab === "operational" && (
           <DashboardGridLayout
              defaultLayout={[
                  'kpi_grid',
                  'chart_top_sellers',
                  'chart_sales_category',
                  'chart_weekly_activity',
                  'table_low_stock',
                  'table_recent_activity'
              ]}
              widgets={{
                  kpi_grid: visibleWidgets['stats'] ? (
                     <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
                        {/* 1. Flow Ratio */}
                        <motion.div variants={item}>
                            <KpiCard
                              label={t('kpi_flow_ratio')}
                              value={data?.summary?.inboundPeriod && data?.summary?.outboundPeriod ? (data.summary.inboundPeriod / (data.summary.outboundPeriod || 1)).toFixed(2) : "0.00"}
                              icon={Activity}
                              color="sky"
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
                              color="amber"
                              subtitle="Utilization"
                            />
                        </motion.div>

                        {/* 4. Low Stock SKUs */}
                        <motion.div variants={item}>
                           <KpiCard
                             label={t('kpi_low_stock')}
                             value={data?.summary?.lowStockCount || 0}
                             icon={AlertTriangle}
                             color={(data?.summary?.lowStockCount || 0) > 0 ? "rose" : "amber"}
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
                             color="orange"
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
                      <div className="h-96 nx-glass-card p-6 flex flex-col">
                          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>
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
                                             <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.95}/>
                                             <stop offset="100%" stopColor="#ea580c" stopOpacity={0.85}/>
                                         </linearGradient>
                                     </defs>
                                     <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                                     <XAxis
                                       type="number"
                                       stroke="#94a3b8"
                                       fontSize={11}
                                       tick={{ fill: '#64748b' }}
                                       tickFormatter={(v) => Number(v || 0).toLocaleString()}
                                     />
                                     <YAxis
                                       type="category"
                                       dataKey="name"
                                       stroke="#94a3b8"
                                       fontSize={11}
                                       tick={{ fill: '#334155' }}
                                       width={120}
                                       tickFormatter={(val) => typeof val === 'string' && val.length > 15 ? `${val.slice(0, 15)}…` : val}
                                     />
                                     <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }} />
                                     <Bar dataKey="qty" name="Sold Qty" fill="url(#bestSellerGrad)" radius={[0, 6, 6, 0]} barSize={14} />
                                 </BarChart>
                            </ResponsiveContainer>
                         </div>
                      </div>
                  ) : null,

                  chart_sales_category: visibleWidgets['charts'] ? (() => {
                       const catData = data?.categorySales || [];
                       const totalCatQty = catData.reduce((acc: number, c: any) => acc + (Number(c.value) || 0), 0);
                       const palette = ['#10b981', '#0ea5e9', '#f59e0b', '#ea580c', '#ef4444'];

                       return (
                          <div className="h-96 nx-glass-card p-6 flex flex-col justify-between">
                              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <span className="w-1.5 h-4 bg-sky-500 rounded-full"></span>
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
                                  <div className="space-y-2 text-xs max-h-[220px] overflow-y-auto pr-1">
                                    {catData.slice(0, 5).map((cat: any, idx: number) => {
                                      const color = palette[idx % palette.length];
                                      const share = totalCatQty > 0 ? Math.round((Number(cat.value || 0) / totalCatQty) * 100) : 0;
                                      return (
                                        <div key={idx} className="p-2 rounded-xl bg-slate-50/80 border border-slate-200/70">
                                          <div className="flex items-center justify-between text-[11px] mb-1.5">
                                            <span className="flex items-center gap-1.5 text-slate-800 font-semibold truncate max-w-[110px]">
                                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                              <span className="truncate">{cat.name}</span>
                                            </span>
                                            <span className="text-slate-900 font-bold tabular-nums">{share}% <span className="text-slate-500 font-normal">({Number(cat.value).toLocaleString()})</span></span>
                                          </div>
                                          <div className="w-full bg-slate-200/70 h-1.5 rounded-full overflow-hidden">
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
                          <div className="h-96 nx-glass-card p-6 flex flex-col">
                              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                  <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                                  {activityDays === 7 ? t('chart_weekly_activity') : 'กิจกรรม 30 วัน'}
                                </h3>

                                <div className="flex items-center gap-2">
                                  {/* Inline Summary Pill */}
                                  <div className="hidden sm:flex items-center gap-2 text-[11px] bg-white/75 border border-white/90 px-3 py-1 rounded-full tabular-nums">
                                    <span className="text-emerald-600 font-bold">IN: {totalInWindow.toLocaleString()}</span>
                                    <span className="text-slate-300">|</span>
                                    <span className="text-sky-600 font-bold">OUT: {totalOutWindow.toLocaleString()}</span>
                                  </div>

                                  <div className="flex gap-1">
                                    {([7, 30] as const).map(n => (
                                      <button
                                        key={n}
                                        onClick={() => setActivityDays(n)}
                                        className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                                          activityDays === n
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : 'bg-white/75 text-slate-600 border-white/90 hover:text-slate-900 hover:bg-white'
                                        }`}
                                      >
                                        {n} วัน
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {rows.length > 0 && rows.every((r: any) => !r.in && !r.out) && (
                                <p className="mb-2 text-xs text-slate-500">ไม่มีการรับเข้า/จ่ายออกในช่วงนี้</p>
                              )}

                              <div className="flex-1 w-full min-h-0">
                                 <ResponsiveContainer width="100%" height="100%">
                                     <BarChart data={rows} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                         <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                         <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tick={{ fill: '#64748b' }} />
                                         <YAxis stroke="#94a3b8" fontSize={11} tick={{ fill: '#64748b' }} tickFormatter={(v) => Number(v || 0).toLocaleString()} />
                                         <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }} />
                                         <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: '#334155' }} />
                                         <Bar dataKey="in" name={t('legend_inbound')} fill="#10b981" radius={[4, 4, 0, 0]} barSize={activityDays === 7 ? 12 : 5} />
                                         <Bar dataKey="out" name={t('legend_outbound')} fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={activityDays === 7 ? 12 : 5} />
                                     </BarChart>
                                 </ResponsiveContainer>
                             </div>
                          </div>
                       );
                  })() : null,

                  table_low_stock: visibleWidgets['recent_activity'] ? (
                     <div className="h-96 nx-glass-card p-6 overflow-hidden flex flex-col">
                        <h3 className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                           <AlertTriangle className="h-4 w-4" /> {t('section_low_stock_alert')}
                        </h3>
                        <div className="flex-1 overflow-auto">
                           <table className="w-full text-xs">
                              <thead className="text-slate-500 uppercase font-semibold text-[11px] sticky top-0 bg-white/85 backdrop-blur-md border-b border-slate-200/70">
                                  <tr>
                                     <th className="text-left py-2.5 pl-2.5">{t('col_product_name')}</th>
                                     <th className="text-right py-2.5">{t('col_qty')}</th>
                                     <th className="text-center py-2.5">{t('col_status')}</th>
                                  </tr>
                               </thead>
                               <tbody className="divide-y divide-slate-100">
                                  {data?.lowStock?.map((item: any, index: number) => (
                                     <tr key={index} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-2.5 pl-2.5 text-slate-900 font-medium flex items-center gap-2.5">
                                           {item.image ? (
                                               <img src={`/api/proxy/image?url=${encodeURIComponent(item.image)}`} alt={item.name} className="w-7 h-7 rounded-lg object-cover border border-slate-200" />
                                           ) : <div className="w-7 h-7 bg-slate-100 rounded-lg border border-slate-200"></div>}
                                           <span className="truncate max-w-[160px]">{item.name}</span>
                                        </td>
                                        <td className="py-2.5 text-right text-rose-600 font-bold tabular-nums">{item.qty}</td>
                                        <td className="py-2.5 text-center">
                                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                                             item.status === 'Fast Moving'
                                               ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                               : 'bg-rose-50 text-rose-700 border-rose-200'
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
                     <div className="h-96 nx-glass-card p-6 overflow-hidden flex flex-col">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                           <Activity className="h-4 w-4 text-amber-500" /> {t('section_recent_activity')}
                        </h3>
                        <div className="flex-1 overflow-auto">
                           <ul className="space-y-2">
                              {data?.recentActivity?.map((activity: any, index: number) => (
                                 <li key={index} className="flex items-center space-x-3 text-xs p-2.5 rounded-xl bg-white/60 border border-white/80 hover:bg-white/90 transition-colors">
                                    {activity.type === 'inbound' ? (
                                       <div className="bg-emerald-50 border border-emerald-200 p-1.5 rounded-lg text-emerald-600"><ArrowDownRight className="h-3.5 w-3.5" /></div>
                                    ) : (
                                       <div className="bg-sky-50 border border-sky-200 p-1.5 rounded-lg text-sky-600"><ArrowUpRight className="h-3.5 w-3.5" /></div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                       <span className="text-slate-900 font-semibold block truncate">{activity.description}</span>
                                       <span className="text-slate-500 text-[11px]">{activity.time}</span>
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

        {/* Dock & Activity Placement at Bottom of Operational Tab */}
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
             transition={{ duration: 0.4 }}
             className="h-full flex flex-col gap-6 overflow-auto pr-2 pb-8"
           >
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <AdminMetric label={t('metric_accuracy')} value={`${(data?.executive?.accuracy || 0).toFixed(2)}%`} target="100%" color="text-emerald-600" />
                  <AdminMetric label={t('metric_damage')} value={`${(data?.executive?.damageRate || 0).toFixed(2)}%`} target="0.00%" color="text-rose-600" />
                  <AdminMetric label={t('metric_space')} value={`${(data?.executive?.spaceEfficiency || 0).toFixed(1)}%`} target="100%" color="text-amber-600" />
                  <AdminMetric label={t('metric_fulfillment')} value={`${(data?.executive?.otif || 0).toFixed(1)}%`} target="100%" color="text-sky-600" />
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                   <div className="nx-glass-card p-6">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                         <span className="w-1.5 h-4 bg-sky-500 rounded-full"></span>
                         {t('chart_flow_analysis')}
                       </h3>
                     <div className="h-64 w-full">
                        {data?.executive?.waterfallData ? (
                           <WaterfallChart data={data.executive.waterfallData} />
                        ) : (
                           <div className="h-full flex items-center justify-center text-slate-400 text-xs">Loading waterfall...</div>
                        )}
                     </div>
                  </div>

                   <div className="nx-glass-card p-6">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                         <span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>
                         {t('chart_performance_radar')}
                       </h3>
                      <div className="h-64 w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={data?.executive?.radarData || []}>
                               <PolarGrid stroke="#e2e8f0" />
                               <PolarAngleAxis dataKey="metric" stroke="#94a3b8" fontSize={11} tick={{ fill: '#475569', fontWeight: 600 }} />
                               <PolarRadiusAxis angle={90} domain={[0, 100]} stroke="#94a3b8" fontSize={9} tick={false} />
                               <Radar name="Actual" dataKey="actual" stroke="#10b981" fill="#10b981" fillOpacity={0.28} animationDuration={1000} />
                               <Radar name="Target" dataKey="target" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.12} strokeDasharray="4 4" animationDuration={1000} />
                               <Tooltip contentStyle={HYBRID_TOOLTIP_STYLE} itemStyle={{ color: '#0f172a' }} />
                               <Legend wrapperStyle={{ color: '#334155', fontSize: '12px' }} />
                            </RadarChart>
                         </ResponsiveContainer>
                      </div>
                   </div>
               </div>

               {/* Year Over Year Comparison */}
               <div className="nx-glass-card p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-4">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                         <span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>
                         {t('chart_yoy')}
                       </h3>
                      <div className="flex gap-2 text-xs">
                         <select
                            value={selectedYear1}
                            onChange={(e) => setSelectedYear1(e.target.value)}
                            className="bg-white/80 border border-white/90 rounded-full px-3.5 py-1.5 text-slate-800 font-semibold focus:border-emerald-500 outline-none tabular-nums shadow-xs"
                         >
                            {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                         </select>
                         <span className="text-slate-400 font-semibold self-center">vs</span>
                         <select
                            value={selectedYear2}
                            onChange={(e) => setSelectedYear2(e.target.value)}
                            className="bg-white/80 border border-white/90 rounded-full px-3.5 py-1.5 text-slate-800 font-semibold focus:border-emerald-500 outline-none tabular-nums shadow-xs"
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
                        <div className="h-full flex items-center justify-center text-slate-400 text-xs">Loading comparison...</div>
                     )}
                  </div>
               </div>

               {/* All-Time Annual Trend */}
               <div className="nx-glass-card p-6">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-5 flex items-center gap-2">
                     <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                     {t('chart_growth_trend')}
                   </h3>
                  <div className="h-80 w-full">
                     {data?.executive?.annualTrend ? (
                        <AnnualTrendChart data={data.executive.annualTrend} />
                     ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 text-xs">Loading trend...</div>
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
              transition={{ duration: 0.4 }}
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

                <div className="nx-glass-card p-6 overflow-hidden">
                   <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                          <span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>
                          Forecast Radar (AI Prediction)
                        </h3>
                        <div className="flex gap-2">
                            <span className="px-3 py-1 bg-rose-50/90 text-rose-700 rounded-full text-[11px] font-semibold border border-rose-200">Critical: &lt; 7 Days</span>
                            <span className="px-3 py-1 bg-amber-50/90 text-amber-700 rounded-full text-[11px] font-semibold border border-amber-200">High: &lt; 14 Days</span>
                        </div>
                   </div>

                   <div className="overflow-x-auto">
                       <table className="w-full text-xs">
                            <thead className="text-slate-500 uppercase font-semibold text-[11px] tracking-wider sticky top-0 bg-white/85 backdrop-blur-md border-b border-slate-200/70">
                                <tr>
                                    <th className="text-left py-3 pl-3">Product</th>
                                    <th className="text-right py-3">Current Stock</th>
                                    <th className="text-right py-3">Burn Rate (Avg/Day)</th>
                                    <th className="text-right py-3">Days Left</th>
                                    <th className="text-center py-3">Est. Stockout</th>
                                    <th className="text-center py-3 pr-3">Risk Level</th>
                                </tr>
                            </thead>
                           <tbody className="divide-y divide-slate-100">
                               {data?.forecasts?.length > 0 ? (
                                   data.forecasts.map((item: any, idx: number) => (
                                       <tr
                                          key={idx}
                                          onClick={() => setSelectedForecastItem(item)}
                                          className={cn(
                                             "transition-colors group cursor-pointer border-l-2",
                                             selectedForecastItem?.name === item.name
                                                ? "bg-amber-50/70 border-l-amber-500"
                                                : "hover:bg-slate-50/80 border-l-transparent"
                                          )}
                                       >
                                           <td className="py-3 pl-3 font-medium text-slate-900 flex items-center gap-3">
                                               {item.image ? (
                                                   <img src={`/api/proxy/image?url=${encodeURIComponent(item.image)}`} className="w-8 h-8 rounded-lg object-cover border border-slate-200 group-hover:scale-105 transition-transform" />
                                               ) : (
                                                   <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400 font-bold">N/A</div>
                                               )}
                                               <div>
                                                   <div className="text-xs text-slate-900 font-semibold">{item.name}</div>
                                                   <div className="text-[10px] text-slate-500 uppercase">{item.category}</div>
                                               </div>
                                           </td>
                                           <td className="py-3 text-right font-semibold text-slate-900 tabular-nums">{item.stock.toLocaleString()}</td>
                                           <td className="py-3 text-right text-slate-600 tabular-nums">
                                               {item.burnRate > 0 ? `-${item.burnRate.toFixed(1)}` : '0'}
                                               <span className="text-[10px] text-slate-400 ml-1">/day</span>
                                           </td>
                                           <td className="py-3 text-right">
                                               <span className={cn(
                                                   "font-bold text-sm tabular-nums",
                                                   item.daysLeft < 7 ? "text-rose-600" :
                                                   item.daysLeft < 14 ? "text-amber-600" : "text-emerald-600"
                                               )}>
                                                   {item.daysLeft}
                                               </span>
                                           </td>
                                           <td className="py-3 text-center font-medium text-slate-700 tabular-nums">
                                               {new Date(item.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                           </td>
                                           <td className="py-3 text-center pr-3">
                                               <span className={cn(
                                                   "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                                   item.risk === 'CRITICAL' ? "bg-rose-50 text-rose-700 border-rose-200" :
                                                   item.risk === 'HIGH' ? "bg-amber-50 text-amber-700 border-amber-200" :
                                                   "bg-emerald-50 text-emerald-700 border-emerald-200"
                                               )}>
                                                   {item.risk}
                                               </span>
                                           </td>
                                       </tr>
                                   ))
                               ) : (
                                   <tr>
                                       <td colSpan={6} className="text-center py-12 text-slate-500">
                                           <CheckCircle className="w-10 h-10 mb-2 text-emerald-500 mx-auto" />
                                           <p className="text-xs text-slate-600">All systems normal. No stockout risks detected.</p>
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
      icon: 'text-rose-600 bg-rose-50',
      value: 'text-rose-600',
      badge: 'text-rose-600 bg-rose-50',
      border: 'hover:border-rose-300',
    } : color === 'orange' ? {
      icon: 'text-orange-600 bg-orange-50',
      value: 'text-slate-900',
      badge: 'text-orange-600 bg-orange-50',
      border: 'hover:border-orange-300',
    } : color === 'amber' || color === 'gold' ? {
      icon: 'text-amber-600 bg-amber-50',
      value: 'text-slate-900',
      badge: 'text-amber-700 bg-amber-50',
      border: 'hover:border-amber-300',
    } : color === 'emerald' ? {
      icon: 'text-emerald-600 bg-emerald-50',
      value: 'text-slate-900',
      badge: 'text-emerald-700 bg-emerald-50',
      border: 'hover:border-emerald-300',
    } : {
      icon: 'text-sky-600 bg-sky-50',
      value: 'text-slate-900',
      badge: 'text-sky-700 bg-sky-50',
      border: 'hover:border-sky-300',
    };

    const Content = (
      <div
        title={title}
        className={cn(
          "relative h-32 overflow-hidden nx-glass-card p-4 transition-all duration-200 cursor-pointer group flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5",
          accent.border,
          border
        )}
      >
        <div className="flex items-start justify-between gap-2">
           <p className="line-clamp-1 text-[11px] font-semibold text-slate-500">{label}</p>
           <div className={cn("p-2 rounded-xl shrink-0", accent.icon)}>
             <Icon className="w-4 h-4" />
           </div>
        </div>

        <div>
           <p className={cn("text-2xl leading-none font-bold tabular-nums tracking-tight", accent.value)}>
              {typeof value === 'number' ? <CountUp end={value} duration={1.5} separator="," /> : value}
           </p>
           {subtitle && (
              <span className={cn("inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full truncate mt-2", accent.badge)}>
                {subtitle}
              </span>
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
      ? '#10b981'
      : color.includes('sky') || color.includes('cyan') || color.includes('indigo') || color.includes('blue')
        ? '#0ea5e9'
        : color.includes('amber') || color.includes('gold')
          ? '#f59e0b'
          : '#ef4444';

    const numericVal = parseFloat(value.replace(/[^0-9.]/g, '')) || 0;
    const numericTarget = parseFloat(target.replace(/[^0-9.]/g, '')) || 100;
    const progressPct = Math.min(100, Math.max(0, (numericVal / (numericTarget || 100)) * 100));

    return (
      <div className="relative flex flex-col justify-between overflow-hidden nx-glass-card p-5 group hover:shadow-md transition-all">
         <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums">
              Target: <span className="text-slate-900 font-bold">{target}</span>
            </span>
         </div>
         <p className="my-1 text-3xl font-bold tabular-nums tracking-tight text-slate-900">{value}</p>
         <div className="mt-3 w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%`, backgroundColor: accentColor }}
            />
         </div>
      </div>
    );
}
