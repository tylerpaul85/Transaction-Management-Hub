import React from 'react';
import { useTransactions, ViewMode } from '../context/TransactionContext';
import {
  LayoutGrid,
  ListFilter,
  CalendarClock,
  Plus,
  Search,
  TrendingUp,
  DollarSign,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { RepresentationType } from '../types/transaction';

export const Navbar: React.FC = () => {
  const {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    filterRepresentation,
    setFilterRepresentation,
    setIsNewModalOpen,
    metrics,
    transactions,
  } = useTransactions();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[#334155] bg-[#131826]/90 backdrop-blur-md">
      {/* Top Brand & Actions Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3.5 min-w-max">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-[#1e293b] border border-[#334155] p-1.5 flex items-center justify-center shadow-inner">
              <img
                src="/msreg-logo.png"
                alt="MSREG Logo"
                className="h-full w-auto object-contain"
                onError={(e) => {
                  // fallback icon if image isn't available
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-editorial text-lg sm:text-2xl font-bold tracking-tight text-[#f8fafc]">
                  MSREG Hub
                </span>
                <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#d97706]/15 text-[#d97706] border border-[#d97706]/30">
                  Transactions
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] font-mono-code hidden sm:block">
                Contract-to-Close Pipeline & Compliance
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md mx-2">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search address, file #, client, agent..."
                className="w-full pl-10 pr-4 py-2 bg-[#1e293b]/90 border border-[#334155] rounded-xl text-base text-[#f8fafc] placeholder-[#94a3b8] focus:outline-none focus:border-[#d97706] focus:ring-1 focus:ring-[#d97706] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#94a3b8] hover:text-[#f8fafc]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-max">
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#d97706] text-[#0f172a] hover:bg-[#d97706]/90 font-semibold rounded-xl text-base active:scale-[0.98] transition-all shadow-md hover:shadow-amber-500/10 min-h-[44px] min-w-[44px]"
            >
              <Plus className="h-5 w-5 stroke-[2.5]" />
              <span className="hidden sm:inline">New Transaction</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="border-t border-[#334155]/60 bg-[#0f172a]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {/* Metric 1: Active Volume */}
            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[#1e293b]/40 border border-[#334155]/40">
              <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-[#94a3b8] uppercase tracking-wider font-medium">
                  Active Escrow Vol
                </p>
                <p className="font-mono-code text-sm sm:text-base font-bold text-[#f8fafc]">
                  {formatCurrency(metrics.activeVolume)}
                </p>
              </div>
            </div>

            {/* Metric 2: Projected GCI */}
            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[#1e293b]/40 border border-[#334155]/40">
              <div className="p-2 rounded-md bg-[#d97706]/15 text-[#d97706] border border-[#d97706]/30">
                <DollarSign className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-[#94a3b8] uppercase tracking-wider font-medium">
                  Projected GCI
                </p>
                <p className="font-mono-code text-sm sm:text-base font-bold text-[#d97706]">
                  {formatCurrency(metrics.projectedGci)}
                </p>
              </div>
            </div>

            {/* Metric 3: Closing This Month */}
            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[#1e293b]/40 border border-[#334155]/40">
              <div className="p-2 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-[#94a3b8] uppercase tracking-wider font-medium">
                  Closing This Month
                </p>
                <p className="font-mono-code text-sm sm:text-base font-bold text-[#f8fafc]">
                  {metrics.closingThisMonthCount} Deals
                </p>
              </div>
            </div>

            {/* Metric 4: Contingencies Due */}
            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[#1e293b]/40 border border-[#334155]/40">
              <div
                className={`p-2 rounded-md border ${
                  metrics.urgentAlertsCount > 0
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse'
                    : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-[#94a3b8] uppercase tracking-wider font-medium">
                  Contingency Alerts
                </p>
                <p
                  className={`font-mono-code text-sm sm:text-base font-bold ${
                    metrics.urgentAlertsCount > 0 ? 'text-amber-400' : 'text-[#94a3b8]'
                  }`}
                >
                  {metrics.urgentAlertsCount} Due Soon
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subnav & View Switcher */}
      <div className="border-t border-[#334155]/50 bg-[#131826]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-wrap items-center justify-between gap-3">
          {/* Representation Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-xs text-[#94a3b8] font-medium mr-1.5 hidden md:inline">
              Filter:
            </span>
            {(['All', 'Buyer', 'Seller', 'Dual'] as const).map((rep) => (
              <button
                key={rep}
                onClick={() => setFilterRepresentation(rep)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all min-h-[36px] flex items-center ${
                  filterRepresentation === rep
                    ? 'bg-[#d97706]/20 text-[#d97706] border border-[#d97706]/40 font-semibold shadow-sm'
                    : 'bg-[#1e293b]/70 text-[#94a3b8] border border-[#334155] hover:text-[#f8fafc] hover:bg-[#1e293b]'
                }`}
              >
                {rep === 'All' ? 'All Roles' : `${rep} Rep`}
              </button>
            ))}
          </div>

          {/* View Mode Toggle Switcher */}
          <div className="flex items-center bg-[#1e293b] p-1 rounded-xl border border-[#334155]">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[36px] ${
                viewMode === 'kanban'
                  ? 'bg-[#0f172a] text-[#f8fafc] border border-[#334155] shadow-sm font-semibold'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Pipeline</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[36px] ${
                viewMode === 'table'
                  ? 'bg-[#0f172a] text-[#f8fafc] border border-[#334155] shadow-sm font-semibold'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              <ListFilter className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('deadlines')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[36px] ${
                viewMode === 'deadlines'
                  ? 'bg-[#0f172a] text-[#f8fafc] border border-[#334155] shadow-sm font-semibold'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              <span>Deadlines</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
