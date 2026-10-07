import React, { useState, useMemo } from 'react';
import { OpsTransaction } from '../../types/ops';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Eye,
  EyeOff,
  Building,
  Clock,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Wallet,
  Award,
  ChevronRight,
  Percent,
  Receipt,
  Download,
  AlertCircle,
} from 'lucide-react';

interface AgentFinancialRadarProps {
  transactions: OpsTransaction[];
  agentName: string;
  agentEmail?: string;
  agentAvatarUrl?: string | null;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const AgentFinancialRadar: React.FC<AgentFinancialRadarProps> = ({
  transactions,
  agentName,
  agentEmail,
  agentAvatarUrl,
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => {
    return localStorage.getItem('hub_financial_privacy_mode') === 'true';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'closed' | 'pending'>('all');
  const [sideFilter, setSideFilter] = useState<'all' | 'buyer' | 'seller'>('all');
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);

  // Active chart series toggles
  const [visibleSeries, setVisibleSeries] = useState<{ [key: string]: boolean }>({
    '2026': true,
    '2025': true,
    '2024': true,
    'pending': true,
  });

  const togglePrivacy = () => {
    setIsPrivacyMode((prev) => {
      const next = !prev;
      localStorage.setItem('hub_financial_privacy_mode', String(next));
      return next;
    });
  };

  // Helper to format currency respecting privacy mode
  const fmtMoney = (val: number | null | undefined, hideIfPrivate = true): string => {
    if (val === null || val === undefined || isNaN(val)) return '$0';
    if (hideIfPrivate && isPrivacyMode) return '$••••••';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Extract closing or target date
  const getDealDate = (tx: OpsTransaction): { date: Date | null; year: number | null; month: number | null } => {
    const rawDateStr = tx.closed_date || (tx.status?.toLowerCase() === 'closed' ? tx.target_closing_date : null) || tx.target_closing_date || tx.contract_date;
    if (!rawDateStr) return { date: null, year: null, month: null };
    try {
      const d = new Date(rawDateStr);
      if (isNaN(d.getTime())) return { date: null, year: null, month: null };
      return { date: d, year: d.getFullYear(), month: d.getMonth() };
    } catch {
      return { date: null, year: null, month: null };
    }
  };

  // Get true gross agent paid income with fallback calculations
  const getGrossIncome = (tx: OpsTransaction): number => {
    if (tx.gross_agent_paid_income !== null && tx.gross_agent_paid_income !== undefined && !isNaN(tx.gross_agent_paid_income)) {
      return Number(tx.gross_agent_paid_income);
    }
    // Fallback: GCI * commission split (default 70% as standard in Sisu)
    if (tx.gci !== null && tx.gci !== undefined && !isNaN(tx.gci)) {
      const split = (tx.commission_rate && tx.commission_rate >= 10) ? tx.commission_rate / 100 : 0.70;
      return Number(tx.gci) * split;
    }
    // Fallback 2: Price * 3% commission * 70% split
    const price = tx.price || tx.list_price || 0;
    if (price > 0) {
      return price * 0.03 * 0.70;
    }
    return 0;
  };

  // Compute multi-year (2026, 2025, 2024) financial metrics and monthly distribution
  const financialData = useMemo(() => {
    const monthlyData: {
      [year: number]: {
        closed: number[];
        pending: number[];
        closedDealCount: number[];
        pendingDealCount: number[];
      };
    } = {
      2026: { closed: Array(12).fill(0), pending: Array(12).fill(0), closedDealCount: Array(12).fill(0), pendingDealCount: Array(12).fill(0) },
      2025: { closed: Array(12).fill(0), pending: Array(12).fill(0), closedDealCount: Array(12).fill(0), pendingDealCount: Array(12).fill(0) },
      2024: { closed: Array(12).fill(0), pending: Array(12).fill(0), closedDealCount: Array(12).fill(0), pendingDealCount: Array(12).fill(0) },
    };

    let totalClosedSelectedYear = 0;
    let totalPendingSelectedYear = 0;
    let totalGciSelectedYear = 0;
    let totalVolumeSelectedYear = 0;
    let closedCountSelectedYear = 0;
    let pendingCountSelectedYear = 0;

    let totalClosedPrevYear = 0;
    let closedCountPrevYear = 0;

    const pendingHorizonList: {
      tx: OpsTransaction;
      income: number;
      targetDate: string;
      daysRemaining: number;
    }[] = [];

    const now = new Date();

    transactions.forEach((tx) => {
      const income = getGrossIncome(tx);
      const isClosed = String(tx.status).toLowerCase().trim() === 'closed' || Boolean(tx.closed_date);
      const { year, month } = getDealDate(tx);

      if (year && monthlyData[year] && month !== null && month >= 0 && month <= 11) {
        if (isClosed) {
          monthlyData[year].closed[month] += income;
          monthlyData[year].closedDealCount[month] += 1;
        } else {
          monthlyData[year].pending[month] += income;
          monthlyData[year].pendingDealCount[month] += 1;
        }
      }

      // Selected Year Totals
      if (year === selectedYear) {
        if (isClosed) {
          totalClosedSelectedYear += income;
          closedCountSelectedYear += 1;
          totalGciSelectedYear += (tx.gci || (income / 0.45));
          totalVolumeSelectedYear += (tx.price || 0);
        } else {
          totalPendingSelectedYear += income;
          pendingCountSelectedYear += 1;
        }
      }

      // Previous Year Totals (for YoY Growth comparison)
      if (year === selectedYear - 1 && isClosed) {
        totalClosedPrevYear += income;
        closedCountPrevYear += 1;
      }

      // Build upcoming pending horizon for current active deals
      if (!isClosed && (tx.target_closing_date || tx.contract_date)) {
        const targetStr = tx.target_closing_date || tx.contract_date || '';
        const targetD = new Date(targetStr);
        if (!isNaN(targetD.getTime())) {
          const diffDays = Math.ceil((targetD.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          pendingHorizonList.push({
            tx,
            income,
            targetDate: targetStr,
            daysRemaining: diffDays,
          });
        }
      }
    });

    // Sort pending horizon by closing date
    pendingHorizonList.sort((a, b) => a.daysRemaining - b.daysRemaining);

    // Compute YoY Pace
    const yoyGrowthPercent =
      totalClosedPrevYear > 0
        ? ((totalClosedSelectedYear - totalClosedPrevYear) / totalClosedPrevYear) * 100
        : null;

    const avgCommissionPerDeal =
      closedCountSelectedYear > 0 ? totalClosedSelectedYear / closedCountSelectedYear : 0;

    return {
      monthlyData,
      totalClosedSelectedYear,
      totalPendingSelectedYear,
      totalProjectedSelectedYear: totalClosedSelectedYear + totalPendingSelectedYear,
      totalGciSelectedYear,
      totalVolumeSelectedYear,
      closedCountSelectedYear,
      pendingCountSelectedYear,
      totalClosedPrevYear,
      closedCountPrevYear,
      yoyGrowthPercent,
      avgCommissionPerDeal,
      pendingHorizonList,
    };
  }, [transactions, selectedYear]);

  // Max value calculation for SVG chart scaling across all years
  const maxMonthlyVal = useMemo(() => {
    let max = 5000;
    [2026, 2025, 2024].forEach((yr) => {
      const data = financialData.monthlyData[yr];
      if (data) {
        data.closed.forEach((v) => {
          if (v > max) max = v;
        });
        data.pending.forEach((v) => {
          if (v > max) max = v;
        });
      }
    });
    // Add 15% headroom
    return Math.ceil((max * 1.15) / 5000) * 5000;
  }, [financialData]);

  // Filtered Deal Ledger Table
  const filteredDeals = useMemo(() => {
    return transactions.filter((tx) => {
      const isClosed = String(tx.status).toLowerCase().trim() === 'closed' || Boolean(tx.closed_date);
      if (statusFilter === 'closed' && !isClosed) return false;
      if (statusFilter === 'pending' && isClosed) return false;

      if (sideFilter !== 'all') {
        const side = (tx.side || '').toLowerCase();
        if (sideFilter === 'buyer' && !side.includes('buy')) return false;
        if (sideFilter === 'seller' && !side.includes('sell') && !side.includes('list')) return false;
      }

      const { year } = getDealDate(tx);
      if (selectedYear !== 0 && year !== selectedYear) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const addr = (tx.property_address || '').toLowerCase();
        const client = (tx.client_name || '').toLowerCase();
        const sisuId = (tx.sisu_transaction_id || '').toLowerCase();
        if (!addr.includes(q) && !client.includes(q) && !sisuId.includes(q)) return false;
      }

      return true;
    });
  }, [transactions, statusFilter, sideFilter, selectedYear, searchQuery]);

  // Chart SVG Dimensions
  const chartWidth = 900;
  const chartHeight = 280;
  const paddingX = 40;
  const paddingY = 30;
  const innerW = chartWidth - paddingX * 2;
  const innerH = chartHeight - paddingY * 2;

  // Build SVG path points
  const getCoordinates = (monthIdx: number, val: number) => {
    const x = paddingX + (monthIdx / 11) * innerW;
    const y = chartHeight - paddingY - (Math.min(val, maxMonthlyVal) / maxMonthlyVal) * innerH;
    return { x, y };
  };

  const buildPathD = (values: number[]) => {
    return values
      .map((val, idx) => {
        const { x, y } = getCoordinates(idx, val);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const buildAreaD = (values: number[]) => {
    const lineD = buildPathD(values);
    const lastX = paddingX + innerW;
    const baseY = chartHeight - paddingY;
    return `${lineD} L ${lastX} ${baseY} L ${paddingX} ${baseY} Z`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Deck */}
      <div className="bg-[#1e293b]/90 backdrop-blur-xl border border-[#334155]/80 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* Subtle accent background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none -mb-20" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          {/* Agent Header Identity */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {agentAvatarUrl ? (
                <img
                  src={agentAvatarUrl}
                  alt={agentName}
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-emerald-500/40 shadow-lg"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white font-bold text-2xl shadow-lg ring-2 ring-emerald-500/40">
                  {agentName ? agentName.charAt(0).toUpperCase() : 'A'}
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 p-1 bg-[#0f172a] rounded-lg border border-[#334155] text-emerald-400">
                <Award className="h-3.5 w-3.5" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[#f8fafc] tracking-tight">
                  {agentName}’s Income & Financial Radar
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Live Sisu Sync
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] mt-0.5 flex items-center gap-2">
                <span>Calculated from verified Gross Agent(s) Paid Income</span>
                <span className="w-1 h-1 rounded-full bg-[#475569]" />
                <span className="text-emerald-400 font-semibold">{financialData.closedCountSelectedYear} Closed ({selectedYear})</span>
                <span className="w-1 h-1 rounded-full bg-[#475569]" />
                <span className="text-amber-400 font-semibold">{financialData.pendingCountSelectedYear} Pending</span>
              </p>
            </div>
          </div>

          {/* Controls: Privacy Mode + Year Selector Pills */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Privacy Mode Toggle */}
            <button
              onClick={togglePrivacy}
              title={isPrivacyMode ? 'Disable Privacy Mode (Show Dollar Amounts)' : 'Enable Privacy Mode (Mask Numbers)'}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all shadow-md ${
                isPrivacyMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-[#0f172a]/80 text-[#cbd5e1] border-[#334155] hover:bg-[#1e293b]'
              }`}
            >
              {isPrivacyMode ? (
                <>
                  <EyeOff className="h-4 w-4 text-amber-400" />
                  <span>Privacy On</span>
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 text-[#94a3b8]" />
                  <span>Privacy Off</span>
                </>
              )}
            </button>

            {/* Year Selector Pills */}
            <div className="flex items-center bg-[#0f172a] p-1 rounded-xl border border-[#334155]">
              {[2026, 2025, 2024].map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedYear === year
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'text-[#94a3b8] hover:text-[#f8fafc]'
                  }`}
                >
                  {year} {year === 2026 && '(YTD)'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Hero Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Closed Agent Paid Income */}
        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-emerald-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
              {selectedYear} Closed Income
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Wallet className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-[#f8fafc] tracking-tight">
              {fmtMoney(financialData.totalClosedSelectedYear)}
            </div>
            <div className="text-xs text-[#94a3b8] mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-emerald-400">
                {financialData.closedCountSelectedYear} Deals Closed
              </span>
              <span>• Gross Agent Paid</span>
            </div>
          </div>

          {/* YoY Growth Badge */}
          {financialData.yoyGrowthPercent !== null && (
            <div className="mt-3 pt-3 border-t border-[#334155]/60 flex items-center justify-between text-xs">
              <span className="text-[#94a3b8]">vs {selectedYear - 1}:</span>
              <span
                className={`font-bold flex items-center gap-0.5 ${
                  financialData.yoyGrowthPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {financialData.yoyGrowthPercent >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {Math.abs(financialData.yoyGrowthPercent).toFixed(1)}%
              </span>
            </div>
          )}
          {financialData.yoyGrowthPercent === null && (
            <div className="mt-3 pt-3 border-t border-[#334155]/60 flex items-center justify-between text-xs text-[#94a3b8]">
              <span>Income Status:</span>
              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Verified & Paid
              </span>
            </div>
          )}
        </div>

        {/* Card 2: Pending Escrow Income */}
        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-amber-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
              Pending Escrow Income
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">
              {fmtMoney(financialData.totalPendingSelectedYear)}
            </div>
            <div className="text-xs text-[#94a3b8] mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-amber-300">
                {financialData.pendingCountSelectedYear} Under Contract
              </span>
              <span>• In pipeline</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#334155]/60 flex items-center justify-between text-xs text-[#94a3b8]">
            <span>Average Closing in:</span>
            <span className="font-semibold text-[#f8fafc]">Next 30–60 Days</span>
          </div>
        </div>

        {/* Card 3: Total Projected Income */}
        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-sky-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
              Total Projected {selectedYear}
            </span>
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-[#f8fafc] tracking-tight">
              {fmtMoney(financialData.totalProjectedSelectedYear)}
            </div>
            <div className="text-xs text-[#94a3b8] mt-1">
              Closed ({fmtMoney(financialData.totalClosedSelectedYear)}) + Pending ({fmtMoney(financialData.totalPendingSelectedYear)})
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#334155]/60 flex items-center justify-between text-xs text-[#94a3b8]">
            <span>Total Deals:</span>
            <span className="font-bold text-sky-400">
              {financialData.closedCountSelectedYear + financialData.pendingCountSelectedYear} Transactions
            </span>
          </div>
        </div>

        {/* Card 4: Average Commission / Deal */}
        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-purple-500/50 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
              Avg. Payout / Deal
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Percent className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-[#f8fafc] tracking-tight">
              {fmtMoney(financialData.avgCommissionPerDeal)}
            </div>
            <div className="text-xs text-[#94a3b8] mt-1">
              Per closed transaction
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[#334155]/60 flex items-center justify-between text-xs text-[#94a3b8]">
            <span>Closed Sales Volume:</span>
            <span className="font-semibold text-[#f8fafc]">
              {fmtMoney(financialData.totalVolumeSelectedYear)}
            </span>
          </div>
        </div>
      </div>

      {/* Month-by-Month Multi-Year YoY Historical Chart */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#f8fafc] tracking-tight">
                Monthly Income Velocity & Year-over-Year Trajectory
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#334155] text-[#94a3b8] uppercase">
                Gross Agent Paid
              </span>
            </div>
            <p className="text-xs text-[#94a3b8] mt-0.5">
              Month-by-month trajectory comparing 2026 closed velocity with 2025 and 2024 verified earnings
            </p>
          </div>

          {/* Interactive Legend / Series Toggles */}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <button
              onClick={() => setVisibleSeries((prev) => ({ ...prev, '2026': !prev['2026'] }))}
              className={`flex items-center gap-1.5 transition-opacity ${
                visibleSeries['2026'] ? 'opacity-100 font-bold' : 'opacity-40 line-through'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
              <span className="text-[#f8fafc]">2026 (Current)</span>
            </button>

            <button
              onClick={() => setVisibleSeries((prev) => ({ ...prev, '2025': !prev['2025'] }))}
              className={`flex items-center gap-1.5 transition-opacity ${
                visibleSeries['2025'] ? 'opacity-100 font-bold' : 'opacity-40 line-through'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="text-[#cbd5e1]">2025</span>
            </button>

            <button
              onClick={() => setVisibleSeries((prev) => ({ ...prev, '2024': !prev['2024'] }))}
              className={`flex items-center gap-1.5 transition-opacity ${
                visibleSeries['2024'] ? 'opacity-100 font-bold' : 'opacity-40 line-through'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-sky-400" />
              <span className="text-[#cbd5e1]">2024</span>
            </button>

            <button
              onClick={() => setVisibleSeries((prev) => ({ ...prev, 'pending': !prev['pending'] }))}
              className={`flex items-center gap-1.5 transition-opacity ${
                visibleSeries['pending'] ? 'opacity-100 font-bold' : 'opacity-40 line-through'
              }`}
            >
              <span className="w-3 h-3 rounded-full bg-amber-300 border border-dashed border-amber-500" />
              <span className="text-[#cbd5e1]">Pending Pipeline</span>
            </button>
          </div>
        </div>

        {/* SVG Canvas Container */}
        <div className="relative w-full overflow-x-auto pt-2">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto min-w-[650px] overflow-visible select-none"
          >
            <defs>
              <linearGradient id="emeraldGradientArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
              const yVal = chartHeight - paddingY - pct * innerH;
              const dollarLabel = Math.round(pct * maxMonthlyVal);
              return (
                <g key={idx}>
                  <line
                    x1={paddingX}
                    y1={yVal}
                    x2={chartWidth - paddingX}
                    y2={yVal}
                    stroke="#334155"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                    opacity="0.6"
                  />
                  <text
                    x={paddingX - 8}
                    y={yVal + 3}
                    fill="#64748b"
                    fontSize="10"
                    textAnchor="end"
                    fontFamily="monospace"
                  >
                    {isPrivacyMode ? '•••' : `$${(dollarLabel / 1000).toFixed(0)}k`}
                  </text>
                </g>
              );
            })}

            {/* Month Vertical Guide Columns & X-Axis Labels */}
            {MONTH_NAMES.map((monthName, idx) => {
              const { x } = getCoordinates(idx, 0);
              const isHovered = hoveredMonthIndex === idx;
              return (
                <g key={monthName}>
                  {/* Subtle hover column highlight */}
                  {isHovered && (
                    <rect
                      x={x - innerW / 24}
                      y={paddingY}
                      width={innerW / 12}
                      height={innerH}
                      fill="#38bdf8"
                      fillOpacity="0.06"
                      rx="4"
                    />
                  )}
                  <line
                    x1={x}
                    y1={chartHeight - paddingY}
                    x2={x}
                    y2={chartHeight - paddingY + 5}
                    stroke="#64748b"
                    strokeWidth="1.5"
                  />
                  <text
                    x={x}
                    y={chartHeight - paddingY + 18}
                    fill={isHovered ? '#10b981' : '#94a3b8'}
                    fontSize="11"
                    fontWeight={isHovered ? 'bold' : 'normal'}
                    textAnchor="middle"
                  >
                    {monthName}
                  </text>

                  {/* Broad hitbox for mouse hover */}
                  <rect
                    x={x - innerW / 24}
                    y={paddingY}
                    width={innerW / 12}
                    height={innerH}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredMonthIndex(idx)}
                    onMouseLeave={() => setHoveredMonthIndex(null)}
                  />
                </g>
              );
            })}

            {/* 2024 Series (Sky Blue Line) */}
            {visibleSeries['2024'] && (
              <path
                d={buildPathD(financialData.monthlyData[2024].closed)}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeOpacity="0.75"
              />
            )}

            {/* 2025 Series (Amber Line) */}
            {visibleSeries['2025'] && (
              <path
                d={buildPathD(financialData.monthlyData[2025].closed)}
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2.5"
                strokeOpacity="0.85"
              />
            )}

            {/* 2026 Closed Area Fill */}
            {visibleSeries['2026'] && (
              <path
                d={buildAreaD(financialData.monthlyData[2026].closed)}
                fill="url(#emeraldGradientArea)"
              />
            )}

            {/* 2026 Pending Projected Line (Amber Dashed) */}
            {visibleSeries['pending'] && (
              <path
                d={buildPathD(financialData.monthlyData[2026].pending)}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="0.8"
              />
            )}

            {/* 2026 Closed Line (Vibrant Emerald Solid) */}
            {visibleSeries['2026'] && (
              <path
                d={buildPathD(financialData.monthlyData[2026].closed)}
                fill="none"
                stroke="#10b981"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Interactive Data Dots for 2026 */}
            {visibleSeries['2026'] &&
              financialData.monthlyData[2026].closed.map((val, idx) => {
                const { x, y } = getCoordinates(idx, val);
                const isHovered = hoveredMonthIndex === idx;
                return (
                  <g key={`closed-dot-${idx}`}>
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 6 : val > 0 ? 4 : 2}
                      fill={isHovered ? '#34d399' : '#10b981'}
                      stroke="#0f172a"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}

            {/* Interactive Data Dots for 2025 */}
            {visibleSeries['2025'] &&
              financialData.monthlyData[2025].closed.map((val, idx) => {
                if (val <= 0) return null;
                const { x, y } = getCoordinates(idx, val);
                const isHovered = hoveredMonthIndex === idx;
                return (
                  <g key={`dot-2025-${idx}`}>
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 5 : 3}
                      fill="#fbbf24"
                      stroke="#0f172a"
                      strokeWidth="1.5"
                    />
                  </g>
                );
              })}

            {/* Interactive Data Dots for 2024 */}
            {visibleSeries['2024'] &&
              financialData.monthlyData[2024].closed.map((val, idx) => {
                if (val <= 0) return null;
                const { x, y } = getCoordinates(idx, val);
                const isHovered = hoveredMonthIndex === idx;
                return (
                  <g key={`dot-2024-${idx}`}>
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? 5 : 2.5}
                      fill="#38bdf8"
                      stroke="#0f172a"
                      strokeWidth="1.5"
                    />
                  </g>
                );
              })}
          </svg>
        </div>

        {/* Hovered Month Inspection Box */}
        {hoveredMonthIndex !== null && (
          <div className="bg-[#0f172a]/95 border border-emerald-500/40 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-bold text-[#f8fafc]">
                {FULL_MONTH_NAMES[hoveredMonthIndex]} Performance Breakdown:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="text-[#94a3b8]">2026:</span>
                <span className="font-bold text-[#f8fafc]">
                  {fmtMoney(financialData.monthlyData[2026]?.closed[hoveredMonthIndex])}
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold">
                  ({financialData.monthlyData[2026]?.closedDealCount[hoveredMonthIndex]} deals)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-[#94a3b8]">2025:</span>
                <span className="font-bold text-[#f8fafc]">
                  {fmtMoney(financialData.monthlyData[2025]?.closed[hoveredMonthIndex])}
                </span>
                <span className="text-[10px] text-amber-400 font-semibold">
                  ({financialData.monthlyData[2025]?.closedDealCount[hoveredMonthIndex]} deals)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span className="text-[#94a3b8]">2024:</span>
                <span className="font-bold text-[#f8fafc]">
                  {fmtMoney(financialData.monthlyData[2024]?.closed[hoveredMonthIndex])}
                </span>
                <span className="text-[10px] text-sky-400 font-semibold">
                  ({financialData.monthlyData[2024]?.closedDealCount[hoveredMonthIndex]} deals)
                </span>
              </div>

              {financialData.monthlyData[2026]?.pending[hoveredMonthIndex] > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
                  <span className="text-[#94a3b8]">Pending 2026:</span>
                  <span className="font-bold text-amber-300">
                    {fmtMoney(financialData.monthlyData[2026]?.pending[hoveredMonthIndex])}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pending Cash Flow Horizon (Next Closings Timeline) */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#f8fafc]">
                Upcoming Cash Flow Horizon
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {financialData.pendingHorizonList.length} Projected Closings
              </span>
            </div>
            <p className="text-xs text-[#94a3b8] mt-0.5">
              Scheduled settlement dates and estimated gross agent earnings
            </p>
          </div>
        </div>

        {financialData.pendingHorizonList.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-[#334155] rounded-xl text-xs text-[#94a3b8]">
            No pending escrows currently scheduled with target closing dates.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {financialData.pendingHorizonList.slice(0, 6).map(({ tx, income, targetDate, daysRemaining }) => (
              <div
                key={tx.id}
                className="bg-[#0f172a] border border-[#334155] hover:border-amber-500/40 rounded-xl p-4 transition-all space-y-2 relative"
              >
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      daysRemaining <= 7
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : daysRemaining <= 21
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    }`}
                  >
                    {daysRemaining <= 0
                      ? 'Closing Today'
                      : daysRemaining === 1
                      ? 'In 1 Day'
                      : `In ${daysRemaining} Days`}
                  </span>

                  <span className="text-[#94a3b8] font-mono text-[11px] flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {targetDate}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-[#f8fafc] truncate">
                    {tx.property_address}
                  </h4>
                  <p className="text-xs text-[#94a3b8] truncate">
                    {tx.client_name} • {tx.side === 'seller' ? 'Listing Side' : 'Buyer Side'}
                  </p>
                </div>

                <div className="pt-2 border-t border-[#334155]/60 flex items-center justify-between text-xs">
                  <span className="text-[#94a3b8]">Estimated Payout:</span>
                  <span className="text-sm font-black text-amber-400">
                    {fmtMoney(income)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deal-by-Deal Commission Ledger Table */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#f8fafc]">
              Deal-by-Deal Commission Ledger
            </h2>
            <p className="text-xs text-[#94a3b8] mt-0.5">
              Verified breakdown of sales volume, GCI, split percentage, and Gross Agent Paid Income
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]" />
              <input
                type="text"
                placeholder="Search deal or client..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-[#0f172a] border border-[#334155] rounded-xl text-xs text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-emerald-500 w-44"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center bg-[#0f172a] p-1 rounded-xl border border-[#334155] text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  statusFilter === 'all' ? 'bg-[#334155] text-white' : 'text-[#94a3b8]'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('closed')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  statusFilter === 'closed' ? 'bg-emerald-600 text-white' : 'text-[#94a3b8]'
                }`}
              >
                Closed
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                  statusFilter === 'pending' ? 'bg-amber-600 text-white' : 'text-[#94a3b8]'
                }`}
              >
                Pending
              </button>
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto rounded-xl border border-[#334155]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f172a] text-[#94a3b8] uppercase font-mono text-[10px] tracking-wider border-b border-[#334155]">
              <tr>
                <th className="py-3 px-4">Property Address</th>
                <th className="py-3 px-4">Client</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Sale Price</th>
                <th className="py-3 px-4 text-right">GCI</th>
                <th className="py-3 px-4 text-right">Agent Split</th>
                <th className="py-3 px-4 text-right text-emerald-400">Gross Agent Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]/60 bg-[#1e293b]/70">
              {filteredDeals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#94a3b8]">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredDeals.map((tx) => {
                  const isClosed = String(tx.status).toLowerCase().trim() === 'closed' || Boolean(tx.closed_date);
                  const income = getGrossIncome(tx);
                  const splitPercent = (tx.commission_rate && tx.commission_rate >= 10) ? tx.commission_rate : 70;
                  const gciVal = tx.gci || (income / (splitPercent / 100));
                  const dateStr = tx.closed_date || tx.target_closing_date || tx.contract_date || '—';

                  return (
                    <tr key={tx.id} className="hover:bg-[#0f172a]/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-[#f8fafc]">
                        <div className="flex items-center gap-1.5">
                          <Building className="h-3.5 w-3.5 text-[#64748b] shrink-0" />
                          <span className="truncate max-w-[200px]">{tx.property_address}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#cbd5e1]">
                        <span className="truncate max-w-[140px] block">{tx.client_name}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isClosed
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {isClosed ? 'Closed' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#94a3b8] font-mono text-[11px]">
                        {dateStr}
                      </td>
                      <td className="py-3 px-4 text-right text-[#cbd5e1] font-mono">
                        {fmtMoney(tx.price || tx.list_price)}
                      </td>
                      <td className="py-3 px-4 text-right text-[#cbd5e1] font-mono">
                        {fmtMoney(gciVal)}
                      </td>
                      <td className="py-3 px-4 text-right text-[#94a3b8] font-mono">
                        {splitPercent}%
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-400 font-mono text-sm">
                        {fmtMoney(income)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
