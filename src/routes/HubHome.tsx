import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTransactions } from '../context/TransactionContext';
import {
  ArrowRight,
  Briefcase,
  Settings,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  BarChart3,
} from 'lucide-react';

interface HubHomeProps {
  onNavigate: (path: string) => void;
}

export const HubHome: React.FC<HubHomeProps> = ({ onNavigate }) => {
  const { currentUser, isAgent, isOps, isAdmin } = useAuth();
  const { transactions, metrics } = useTransactions();

  if (!currentUser) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Quick stats from transactions
  const activeCount = transactions.filter(
    (t) => t.status !== 'Closed' && t.status !== 'Cancelled' && t.status !== 'Withdrawn'
  ).length;
  const pendingCount = transactions.filter((t) => t.status === 'Pre-Listing' || t.status === 'Coming Soon').length;
  const closedCount = transactions.filter((t) => t.status === 'Closed').length;

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'tc': return 'Transaction Coordinator';
      case 'listing_coordinator': return 'Listing Coordinator';
      case 'admin': return 'Administrator';
      case 'agent': return 'Agent';
      default: return role;
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'agent': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'tc': return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      case 'listing_coordinator': return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
      case 'admin': return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      default: return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero Welcome */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle gradient accent */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-[#d97706]/8 to-transparent rounded-bl-full pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-[#f8fafc]">
              {getGreeting()}, {currentUser.fullName.split(' ')[0]}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getRoleBadgeStyle(currentUser.role)}`}
            >
              {getRoleLabel(currentUser.role)}
            </span>
          </div>
          <p className="text-sm text-[#94a3b8] max-w-2xl">
            Here's an overview of your transaction pipeline. Navigate to your workspace below to manage deals, deadlines, and compliance tasks.
          </p>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-[#1e293b] border border-[#334155] rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <TrendingUp className="h-4 w-4" />
            <span className="text-[11px] uppercase tracking-wider font-bold">Active Deals</span>
          </div>
          <p className="font-mono-code text-2xl font-bold text-[#f8fafc]">{activeCount}</p>
          <p className="text-xs text-[#94a3b8]">In pipeline</p>
        </div>

        <div className="p-5 bg-[#1e293b] border border-[#334155] rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-[#d97706]">
            <BarChart3 className="h-4 w-4" />
            <span className="text-[11px] uppercase tracking-wider font-bold">Active Volume</span>
          </div>
          <p className="font-mono-code text-2xl font-bold text-[#d97706]">{formatCurrency(metrics.activeVolume)}</p>
          <p className="text-xs text-[#94a3b8]">Total escrow volume</p>
        </div>

        <div className="p-5 bg-[#1e293b] border border-[#334155] rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-sky-400">
            <CalendarClock className="h-4 w-4" />
            <span className="text-[11px] uppercase tracking-wider font-bold">Closing Soon</span>
          </div>
          <p className="font-mono-code text-2xl font-bold text-[#f8fafc]">{metrics.closingThisMonthCount}</p>
          <p className="text-xs text-[#94a3b8]">This month</p>
        </div>

        <div className="p-5 bg-[#1e293b] border border-[#334155] rounded-2xl space-y-2">
          <div className={`flex items-center gap-2 ${metrics.urgentAlertsCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
            <AlertTriangle className="h-4 w-4" />
            <span className="text-[11px] uppercase tracking-wider font-bold">Alerts</span>
          </div>
          <p className={`font-mono-code text-2xl font-bold ${metrics.urgentAlertsCount > 0 ? 'text-amber-400' : 'text-[#94a3b8]'}`}>
            {metrics.urgentAlertsCount}
          </p>
          <p className="text-xs text-[#94a3b8]">Contingencies due</p>
        </div>
      </div>

      {/* Workspace Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* My Deals — visible to agents */}
        {(isAgent || isAdmin) && (
          <button
            onClick={() => onNavigate('/my-deals')}
            className="group text-left p-6 bg-[#1e293b] border border-[#334155] rounded-2xl hover:border-emerald-500/40 transition-all space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Briefcase className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-[#94a3b8] group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <h3 className="font-editorial text-lg font-bold text-[#f8fafc]">My Deals</h3>
              <p className="text-xs text-[#94a3b8] mt-1">
                View and manage your active transactions, milestones, and compliance deadlines.
              </p>
            </div>
          </button>
        )}

        {/* Operations — visible to TC, LC, Admin */}
        {isOps && (
          <button
            onClick={() => onNavigate('/ops')}
            className="group text-left p-6 bg-[#1e293b] border border-[#334155] rounded-2xl hover:border-sky-500/40 transition-all space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Settings className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-[#94a3b8] group-hover:text-sky-400 group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <h3 className="font-editorial text-lg font-bold text-[#f8fafc]">Operations Dashboard</h3>
              <p className="text-xs text-[#94a3b8] mt-1">
                TC Escrow queue, LC Listings pipeline, intake management, and task assignments.
              </p>
            </div>
          </button>
        )}

        {/* Admin / User Management — admin only */}
        {isAdmin && (
          <button
            onClick={() => onNavigate('/admin/sync-debug')}
            className="group text-left p-6 bg-[#1e293b] border border-[#334155] rounded-2xl hover:border-rose-500/40 transition-all space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <Users className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-[#94a3b8] group-hover:text-rose-400 group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <h3 className="font-editorial text-lg font-bold text-[#f8fafc]">Admin & Sync</h3>
              <p className="text-xs text-[#94a3b8] mt-1">
                Sisu sync debug tools, reconciliation logs, webhook monitoring, and user management.
              </p>
            </div>
          </button>
        )}
      </div>

      {/* Recent Deals Summary */}
      {transactions.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-editorial text-lg font-bold text-[#f8fafc]">Recent Transactions</h2>
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#131826] text-[#94a3b8] uppercase text-[10px] font-bold tracking-wider border-b border-[#334155]">
                <tr>
                  <th className="py-3 px-4">Property</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Side</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/40">
                {transactions.slice(0, 5).map((txn) => (
                  <tr key={txn.id} className="hover:bg-[#131826]/50 transition-colors">
                    <td className="py-3 px-4 text-[#f8fafc] font-medium">{txn.property_address}</td>
                    <td className="py-3 px-4 text-[#94a3b8]">{txn.client_name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#d97706]/15 text-[#d97706] border border-[#d97706]/30">
                        {txn.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#94a3b8] capitalize">{txn.side}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
