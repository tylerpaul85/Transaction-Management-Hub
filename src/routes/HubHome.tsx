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
  const activeCount = transactions.filter((t) => t.stage !== 'closed').length;
  const closedCount = transactions.filter((t) => t.stage === 'closed').length;

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Hero Welcome */}
      <div className="bg-[#111726] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {getGreeting()}, {currentUser.fullName.split(' ')[0]}
            </h1>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getRoleBadgeStyle(currentUser.role)}`}
            >
              {getRoleLabel(currentUser.role)}
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl">
            Here's an overview of your transaction pipeline. Navigate to your workspace below to manage deals, deadlines, and compliance tasks.
          </p>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 sm:p-5 bg-[#111726] border border-white/10 rounded-xl space-y-1.5 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-400">
            <TrendingUp className="h-4 w-4" />
            <span className="text-[10px] uppercase tracking-wider font-bold">Active Deals</span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">{activeCount}</p>
          <p className="text-xs text-slate-400">In pipeline</p>
        </div>

        <div className="p-4 sm:p-5 bg-[#111726] border border-white/10 rounded-xl space-y-1.5 shadow-sm">
          <div className="flex items-center gap-2 text-amber-400">
            <BarChart3 className="h-4 w-4" />
            <span className="text-[10px] uppercase tracking-wider font-bold">Active Volume</span>
          </div>
          <p className="text-2xl font-bold text-amber-400 tabular-nums">{formatCurrency(metrics.activeVolume)}</p>
          <p className="text-xs text-slate-400">Total escrow volume</p>
        </div>

        <div className="p-4 sm:p-5 bg-[#111726] border border-white/10 rounded-xl space-y-1.5 shadow-sm">
          <div className="flex items-center gap-2 text-sky-400">
            <CalendarClock className="h-4 w-4" />
            <span className="text-[10px] uppercase tracking-wider font-bold">Closing Soon</span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">{metrics.closingThisMonthCount}</p>
          <p className="text-xs text-slate-400">This month</p>
        </div>

        <div className="p-4 sm:p-5 bg-[#111726] border border-white/10 rounded-xl space-y-1.5 shadow-sm">
          <div className={`flex items-center gap-2 ${metrics.urgentAlertsCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
            <AlertTriangle className="h-4 w-4" />
            <span className="text-[10px] uppercase tracking-wider font-bold">Alerts</span>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${metrics.urgentAlertsCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
            {metrics.urgentAlertsCount}
          </p>
          <p className="text-xs text-slate-400">Contingencies due</p>
        </div>
      </div>

      {/* Workspace Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {/* My Deals — visible to agents */}
        {(isAgent || isAdmin) && (
          <button
            onClick={() => onNavigate('/my-deals')}
            className="group text-left p-5 bg-[#111726] border border-white/10 rounded-xl hover:border-amber-500/40 transition-all space-y-2.5 shadow-sm cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Briefcase className="h-4 w-4" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">My Deals</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                View and manage your active transactions, milestones, and compliance deadlines.
              </p>
            </div>
          </button>
        )}

        {/* Operations — visible to TC, LC, Admin */}
        {isOps && (
          <button
            onClick={() => onNavigate('/ops')}
            className="group text-left p-5 bg-[#111726] border border-white/10 rounded-xl hover:border-amber-500/40 transition-all space-y-2.5 shadow-sm cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="h-9 w-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Settings className="h-4 w-4" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">Operations Dashboard</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                TC Escrow queue, LC Listings pipeline, intake management, and task assignments.
              </p>
            </div>
          </button>
        )}

        {/* Admin / User Management — admin only */}
        {isAdmin && (
          <button
            onClick={() => onNavigate('/admin/sync-debug')}
            className="group text-left p-5 bg-[#111726] border border-white/10 rounded-xl hover:border-amber-500/40 transition-all space-y-2.5 shadow-sm cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="h-9 w-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <Users className="h-4 w-4" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">Admin & Sync</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Sisu sync debug tools, reconciliation logs, webhook monitoring, and user management.
              </p>
            </div>
          </button>
        )}
      </div>

      {/* Recent Deals Summary */}
      {transactions.length > 0 && (
        <div className="space-y-3 pt-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Recent Transactions</h2>
          <div className="bg-[#111726] border border-white/10 rounded-xl overflow-hidden shadow-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#162035]/80 text-slate-400 uppercase text-[10px] font-mono tracking-wider border-b border-white/10">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Property</th>
                  <th className="py-2.5 px-4 font-semibold">Client</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  <th className="py-2.5 px-4 font-semibold">Side</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.slice(0, 5).map((txn) => (
                  <tr key={txn.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="py-2.5 px-4 text-white font-medium">{txn.address}</td>
                    <td className="py-2.5 px-4 text-slate-300">{txn.clientNames ? txn.clientNames.join(', ') : 'N/A'}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase">
                        {txn.stage ? txn.stage.replace(/_/g, ' ') : 'N/A'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-400 capitalize">{txn.representation}</td>
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
