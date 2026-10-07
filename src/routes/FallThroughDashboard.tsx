import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  TrendingDown,
  AlertTriangle,
  Users,
  Building,
  DollarSign,
  Calendar,
  Filter,
  RefreshCw,
  Layers,
  Settings,
  HelpCircle,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import { LowSampleBadge } from '../components/analytics/LowSampleBadge';
import { DealDrillDownModal, DrillDownDeal } from '../components/analytics/DealDrillDownModal';
import { AdminTriageDrawer } from '../components/analytics/AdminTriageDrawer';

const COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

export const FallThroughDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Filters
  const [dateRange, setDateRange] = useState<'12m' | 'ytd' | '2025' | '2024' | 'all'>('12m');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [selectedSide, setSelectedSide] = useState<'all' | 'buyer' | 'seller'>('all');
  const [agentsList, setAgentsList] = useState<any[]>([]);

  // Modals & Drawers
  const [triageOpen, setTriageOpen] = useState(false);
  const [triageInitialTab, setTriageInitialTab] = useState<'reasons' | 'lenders' | 'bands'>('reasons');
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownTitle, setDrillDownTitle] = useState('');
  const [drillDownSubtitle, setDrillDownSubtitle] = useState('');
  const [drillDownDeals, setDrillDownDeals] = useState<DrillDownDeal[]>([]);
  const [drillDownLoading, setDrillDownLoading] = useState(false);

  // Compute date boundaries
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];

    if (dateRange === '12m') {
      const d = new Date(today);
      d.setFullYear(d.getFullYear() - 1);
      return { startDate: d.toISOString().split('T')[0], endDate: endStr };
    }
    if (dateRange === 'ytd') {
      return { startDate: `${today.getFullYear()}-01-01`, endDate: endStr };
    }
    if (dateRange === '2025') {
      return { startDate: '2025-01-01', endDate: '2025-12-31' };
    }
    if (dateRange === '2024') {
      return { startDate: '2024-01-01', endDate: '2024-12-31' };
    }
    return { startDate: '2020-01-01', endDate: endStr };
  }, [dateRange]);

  // Load agents for filter
  useEffect(() => {
    async function loadAgents() {
      const { data: ags } = await (supabase.from('agents') as any)
        .select('id, name')
        .eq('active', true)
        .order('name');
      setAgentsList(ags || []);
    }
    loadAgents();
  }, []);

  // Fetch aggregated analytics from Supabase SQL Function
  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await (supabase.rpc as any)('get_fall_through_analytics', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_agent_id: selectedAgentId === 'all' ? null : selectedAgentId,
        p_side: selectedSide === 'all' ? null : selectedSide,
      });

      if (error) {
        console.warn('RPC get_fall_through_analytics error:', error);
      } else {
        setData(res);
      }
    } catch (err) {
      console.warn('Failed fetching fall through analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [startDate, endDate, selectedAgentId, selectedSide]);

  // Drilldown deal loader
  const handleDrilldown = async (
    dimensionTitle: string,
    filterPredicate: (deal: any) => boolean,
    subtitle: string = ''
  ) => {
    setDrillDownLoading(true);
    setDrillDownTitle(dimensionTitle);
    setDrillDownSubtitle(subtitle);
    setDrillDownOpen(true);

    try {
      const { data: rawDeals } = await (supabase.from('transactions') as any)
        .select(`
          id, property_address, city, state, zip, status, price, side,
          contract_date, closed_date, lender_name, loan_type, stage_before_cancelled,
          listing_agent:listing_agent_id(name),
          selling_agent:selling_agent_id(name),
          cancellation_reason:cancellation_reason_id(reason)
        `)
        .in('status', ['Closed', 'closed', 'cancelled']);

      const mapped: DrillDownDeal[] = (rawDeals || []).map((t: any) => {
        const lead = t.side === 'seller' ? (t.listing_agent || t.selling_agent) : (t.selling_agent || t.listing_agent);
        return {
          id: t.id,
          property_address: t.property_address,
          city: t.city,
          state: t.state,
          zip: t.zip,
          status: (t.status || '').toLowerCase() === 'closed' ? 'Closed' : 'Cancelled',
          price: t.price,
          side: t.side,
          agent_name: lead?.name || 'Lead Agent',
          lender_name: t.lender_name,
          loan_type: t.loan_type,
          contract_date: t.contract_date,
          closed_date: t.closed_date,
          cancellation_reason: t.cancellation_reason?.reason || null,
          stage_before_cancelled: t.stage_before_cancelled,
        };
      });

      const matched = mapped.filter(filterPredicate);
      setDrillDownDeals(matched);
    } catch (err) {
      console.warn('Error fetching drilldown deals:', err);
    } finally {
      setDrillDownLoading(false);
    }
  };

  const summary = data?.summary || {
    total_deals: 0,
    closed_count: 0,
    cancelled_count: 0,
    fall_through_rate: 0,
    missing_reason_count: 0,
    is_low_sample: false,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#334155] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold font-editorial text-white tracking-tight">
                  Fall-Through Analysis
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                  ADMIN ONLY
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5 font-mono-code">
                Understand why contracts fail • Fall-through rate = Cancelled ÷ (Closed + Cancelled)
              </p>
            </div>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setTriageInitialTab('reasons');
              setTriageOpen(true);
            }}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Settings className="h-4 w-4 text-amber-400" />
            <span>Manage Reasons & Aliases</span>
          </button>
          <button
            onClick={fetchAnalytics}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
            title="Refresh Analytics"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="p-4 bg-[#1e293b] border border-[#334155] rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <Filter className="h-3.5 w-3.5 text-amber-400" />
            <span>Filters:</span>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center bg-slate-900/80 p-1 border border-slate-700 rounded-xl text-xs">
            {(['12m', 'ytd', '2025', '2024', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  dateRange === range
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {range === '12m'
                  ? 'Trailing 12M'
                  : range === 'ytd'
                  ? 'YTD 2026'
                  : range === 'all'
                  ? 'All-Time'
                  : range}
              </button>
            ))}
          </div>

          {/* Agent Dropdown */}
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="px-3 py-1.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
          >
            <option value="all">All Agents</option>
            {agentsList.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* Buyer / Seller Side */}
          <select
            value={selectedSide}
            onChange={(e) => setSelectedSide(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
          >
            <option value="all">All Sides (Buyer + Seller)</option>
            <option value="buyer">Buyer Side Only</option>
            <option value="seller">Seller Side Only</option>
          </select>
        </div>

        {summary.missing_reason_count > 0 && (
          <button
            onClick={() => {
              setTriageInitialTab('reasons');
              setTriageOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold hover:bg-amber-500/25 transition-colors cursor-pointer animate-pulse"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span>{summary.missing_reason_count} Cancelled Deals Missing Reason</span>
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Fall Through Rate */}
        <div
          onClick={() =>
            handleDrilldown('All Analyzed Deals', () => true, `Period: ${startDate} to ${endDate}`)
          }
          className="p-5 bg-[#1e293b] border border-[#334155] rounded-2xl shadow-xl hover:border-amber-500/50 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Overall Fall-Through Rate</span>
            {summary.is_low_sample && <LowSampleBadge dealCount={summary.total_deals} />}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-editorial text-rose-400">
              {summary.fall_through_rate}%
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ({summary.cancelled_count} cancelled / {summary.total_deals} total)
            </span>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2">
            <span>Closed: {summary.closed_count}</span>
            <span className="text-amber-400 group-hover:underline flex items-center gap-0.5">
              Drill down <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* Total Cancelled Contracts */}
        <div
          onClick={() =>
            handleDrilldown('Cancelled Deals', (d) => d.status === 'Cancelled', 'Cancelled contracts')
          }
          className="p-5 bg-[#1e293b] border border-[#334155] rounded-2xl shadow-xl hover:border-rose-500/50 transition-all cursor-pointer group"
        >
          <div className="text-xs text-slate-400 font-medium">Cancelled Contracts</div>
          <div className="mt-2 text-3xl font-extrabold font-editorial text-white">
            {summary.cancelled_count}
          </div>
          <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2">
            <span>Successfully Closed: {summary.closed_count}</span>
            <span className="text-rose-400 group-hover:underline flex items-center gap-0.5">
              View all <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* Top Reason */}
        <div className="p-5 bg-[#1e293b] border border-[#334155] rounded-2xl shadow-xl">
          <div className="text-xs text-slate-400 font-medium">Top Cancellation Driver</div>
          <div className="mt-2 text-lg font-bold text-amber-300 truncate">
            {data?.by_reason?.[0]?.reason || 'None Recorded'}
          </div>
          <div className="mt-3 text-[11px] text-slate-400 border-t border-slate-800 pt-2">
            {data?.by_reason?.[0]
              ? `${data.by_reason[0].deal_count} deals (${data.by_reason[0].percentage}%)`
              : 'Awaiting cancellation records'}
          </div>
        </div>

        {/* Top Stage */}
        <div className="p-5 bg-[#1e293b] border border-[#334155] rounded-2xl shadow-xl">
          <div className="text-xs text-slate-400 font-medium">Most Vulnerable Stage</div>
          <div className="mt-2 text-lg font-bold text-sky-300 truncate">
            {data?.by_stage?.[0]?.stage || 'Pending Escrow'}
          </div>
          <div className="mt-3 text-[11px] text-slate-400 border-t border-slate-800 pt-2">
            {data?.by_stage?.[0]
              ? `${data.by_stage[0].deal_count} deals dropped out here`
              : 'Tracking forward status history'}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center text-slate-400">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-amber-500 mb-3" />
          <p className="text-sm">Calculating Fall-Through analytics from Supabase views...</p>
        </div>
      ) : (
        <>
          {/* Charts Row 1: By Agent & By Normalized Lender */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Rates by Agent */}
            <div className="p-6 bg-[#1e293b] border border-[#334155] rounded-3xl shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold font-editorial text-white">Fall-Through Rate by Agent</h3>
                  <p className="text-xs text-slate-400">
                    Click any bar to view that agent's closed and cancelled deals
                  </p>
                </div>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(data?.by_agent || []).slice(0, 10)}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 70, bottom: 5 }}
                    onClick={(entry: any) => {
                      if (entry && entry.activePayload && entry.activePayload[0]) {
                        const agName = entry.activePayload[0].payload.agent_name;
                        handleDrilldown(
                          `Deals for ${agName}`,
                          (d) => d.agent_name === agName,
                          `Agent: ${agName}`
                        );
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis type="number" unit="%" stroke="#94a3b8" domain={[0, 100]} />
                    <YAxis
                      dataKey="agent_name"
                      type="category"
                      stroke="#94a3b8"
                      tick={{ fontSize: 11 }}
                      width={90}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const row = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl text-xs space-y-1 shadow-2xl">
                            <div className="font-bold text-white text-sm">{row.agent_name}</div>
                            <div className="text-rose-400 font-semibold">
                              Fall-Through: {row.fall_through_rate}%
                            </div>
                            <div className="text-slate-300 font-mono">
                              {row.cancelled_count} Cancelled / {row.total_deals} Total Deals
                            </div>
                            {row.is_low_sample && (
                              <div className="text-amber-400 pt-1 text-[10px]">
                                ⚠️ Low sample size (&lt; 5 deals)
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="fall_through_rate"
                      fill="#f43f5e"
                      radius={[0, 8, 8, 0]}
                      cursor="pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Rates by Normalized Lender */}
            <div className="p-6 bg-[#1e293b] border border-[#334155] rounded-3xl shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold font-editorial text-white">
                    Fall-Through Rate by Lender
                  </h3>
                  <p className="text-xs text-slate-400">
                    Normalized via alias rules • Click to inspect transactions
                  </p>
                </div>
                <button
                  onClick={() => {
                    setTriageInitialTab('lenders');
                    setTriageOpen(true);
                  }}
                  className="text-xs text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Edit Aliases
                </button>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(data?.by_lender || []).slice(0, 10)}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 80, bottom: 5 }}
                    onClick={(entry: any) => {
                      if (entry && entry.activePayload && entry.activePayload[0]) {
                        const lName = entry.activePayload[0].payload.lender_name;
                        handleDrilldown(
                          `Deals with Lender: ${lName}`,
                          (d) => d.lender_name === lName,
                          `Normalized Lender: ${lName}`
                        );
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis type="number" unit="%" stroke="#94a3b8" domain={[0, 100]} />
                    <YAxis
                      dataKey="lender_name"
                      type="category"
                      stroke="#94a3b8"
                      tick={{ fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const row = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl text-xs space-y-1 shadow-2xl">
                            <div className="font-bold text-white text-sm">{row.lender_name}</div>
                            <div className="text-rose-400 font-semibold">
                              Fall-Through: {row.fall_through_rate}%
                            </div>
                            <div className="text-slate-300 font-mono">
                              {row.cancelled_count} Cancelled / {row.total_deals} Total Deals
                            </div>
                            {row.is_low_sample && (
                              <div className="text-amber-400 pt-1 text-[10px]">
                                ⚠️ Low sample size (&lt; 5 deals)
                              </div>
                            )}
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="fall_through_rate"
                      fill="#e11d48"
                      radius={[0, 8, 8, 0]}
                      cursor="pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Charts Row 2: By Price Band & Reasons */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* By Configurable Price Band */}
            <div className="p-6 bg-[#1e293b] border border-[#334155] rounded-3xl shadow-xl space-y-4 lg:col-span-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold font-editorial text-white">By Price Band</h3>
                  <p className="text-xs text-slate-400">Configurable volume tiers</p>
                </div>
                <button
                  onClick={() => {
                    setTriageInitialTab('bands');
                    setTriageOpen(true);
                  }}
                  className="text-xs text-amber-400 hover:underline cursor-pointer"
                >
                  Configure
                </button>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data?.by_price_band || []}
                    margin={{ top: 10, right: 10, left: -10, bottom: 15 }}
                    onClick={(entry: any) => {
                      if (entry && entry.activePayload && entry.activePayload[0]) {
                        const band = entry.activePayload[0].payload.band_label;
                        handleDrilldown(`Deals in ${band}`, () => true, `Price Band: ${band}`);
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis
                      dataKey="band_label"
                      stroke="#94a3b8"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                    />
                    <YAxis unit="%" stroke="#94a3b8" />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        const row = payload[0].payload;
                        return (
                          <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-xs space-y-1 shadow-2xl">
                            <div className="font-bold text-white">{row.band_label}</div>
                            <div className="text-rose-400">Fall-Through: {row.fall_through_rate}%</div>
                            <div className="text-slate-300 font-mono">
                              {row.cancelled_count} Cancelled / {row.total_deals} Total Deals
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey="fall_through_rate" fill="#f59e0b" radius={[6, 6, 0, 0]} cursor="pointer" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Why They Cancelled (Reasons Donut) */}
            <div className="p-6 bg-[#1e293b] border border-[#334155] rounded-3xl shadow-xl space-y-4 lg:col-span-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold font-editorial text-white">Cancellation Reasons</h3>
                  <p className="text-xs text-slate-400">Distribution of stated causes</p>
                </div>
              </div>

              <div className="h-64 w-full flex items-center justify-center">
                {(!data?.by_reason || data.by_reason.length === 0) ? (
                  <div className="text-xs text-slate-500 italic text-center">
                    No cancellation reasons recorded yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.by_reason}
                        dataKey="deal_count"
                        nameKey="reason"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        cursor="pointer"
                        onClick={(entry: any) => {
                          const reasonName = entry?.reason || entry?.name || 'Unspecified';
                          handleDrilldown(
                            `Cancelled: ${reasonName}`,
                            (d) => d.cancellation_reason === reasonName,
                            `Reason: ${reasonName}`
                          );
                        }}
                      >
                        {data.by_reason.map((_: any, idx: number) => (
                          <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const r = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-xs space-y-1 shadow-2xl">
                              <div className="font-bold text-white">{r.reason}</div>
                              <div className="text-amber-400 font-mono font-bold">
                                {r.deal_count} Deals ({r.percentage}%)
                              </div>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Stage Before Cancelled */}
            <div className="p-6 bg-[#1e293b] border border-[#334155] rounded-3xl shadow-xl space-y-4 lg:col-span-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold font-editorial text-white">Stage Before Cancel</h3>
                  <p className="text-xs text-slate-400">Point of contract fallout</p>
                </div>
              </div>

              <div className="h-64 w-full">
                {(!data?.by_stage || data.by_stage.length === 0) ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-500 italic text-center">
                    Logging status change history forward.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.by_stage}
                      layout="vertical"
                      margin={{ top: 10, right: 20, left: 60, bottom: 5 }}
                      onClick={(entry: any) => {
                        if (entry && entry.activePayload && entry.activePayload[0]) {
                          const stage = entry.activePayload[0].payload.stage;
                          handleDrilldown(
                            `Cancelled at Stage: ${stage}`,
                            (d) => d.stage_before_cancelled === stage,
                            `Stage: ${stage}`
                          );
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                      <XAxis type="number" stroke="#94a3b8" />
                      <YAxis dataKey="stage" type="category" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null;
                          const r = payload[0].payload;
                          return (
                            <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-xs space-y-1 shadow-2xl">
                              <div className="font-bold text-white">{r.stage}</div>
                              <div className="text-sky-400 font-mono font-bold">
                                {r.deal_count} Deals ({r.percentage}%)
                              </div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="deal_count" fill="#38bdf8" radius={[0, 6, 6, 0]} cursor="pointer" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Admin Triage Drawer */}
      <AdminTriageDrawer
        isOpen={triageOpen}
        onClose={() => setTriageOpen(false)}
        initialTab={triageInitialTab}
        onDataUpdated={fetchAnalytics}
      />

      {/* Deal Drill Down Modal */}
      <DealDrillDownModal
        isOpen={drillDownOpen}
        onClose={() => setDrillDownOpen(false)}
        title={drillDownTitle}
        subtitle={drillDownSubtitle}
        deals={drillDownDeals}
      />
    </div>
  );
};
