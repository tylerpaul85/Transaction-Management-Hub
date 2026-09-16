import React from 'react';
import { useAuth, SAMPLE_ACCOUNTS } from '../context/AuthContext';
import { Shield, UserCheck, ArrowRight, KeyRound, Bug } from 'lucide-react';

interface RoleSwitcherBarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const RoleSwitcherBar: React.FC<RoleSwitcherBarProps> = ({ currentPath, onNavigate }) => {
  const { currentUser, switchAccount } = useAuth();

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'agent':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'tc':
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      case 'listing_coordinator':
        return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
      case 'admin':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
    }
  };

  return (
    <div className="bg-[#131826] border-b border-[#334155] px-4 py-2.5 text-xs">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Active Identity Indicator */}
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-[#1e293b] border border-[#334155] text-[#d97706]">
            <KeyRound className="h-3.5 w-3.5" />
          </div>
          <span className="text-[#94a3b8]">Simulated Auth Session:</span>
          <span className="font-semibold text-[#f8fafc]">{currentUser.fullName}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getRoleBadgeClass(
              currentUser.role
            )}`}
          >
            {currentUser.role}
          </span>
        </div>

        {/* Account Switcher Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-[#94a3b8] hidden sm:inline">Switch Role:</span>
          <select
            value={currentUser.email}
            onChange={(e) => switchAccount(e.target.value)}
            className="bg-[#1e293b] border border-[#334155] rounded-lg px-2.5 py-1 text-xs text-[#f8fafc] font-medium focus:outline-none focus:border-[#d97706] cursor-pointer"
          >
            {SAMPLE_ACCOUNTS.map((acc) => (
              <option key={acc.email} value={acc.email}>
                {acc.fullName} ({acc.role.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {/* Route Navigation Chips */}
        <div className="flex items-center gap-1.5 bg-[#1e293b] p-1 rounded-lg border border-[#334155]">
          <button
            onClick={() => onNavigate('/')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              currentPath === '/'
                ? 'bg-[#0f172a] text-[#f8fafc] border border-[#334155]'
                : 'text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => onNavigate('/my-deals')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              currentPath === '/my-deals'
                ? 'bg-[#0f172a] text-[#f8fafc] border border-[#334155]'
                : 'text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            /my-deals
          </button>
          <button
            onClick={() => onNavigate('/ops')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              currentPath === '/ops'
                ? 'bg-[#0f172a] text-[#f8fafc] border border-[#334155]'
                : 'text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            /ops
          </button>
          <button
            onClick={() => onNavigate('/admin/sync-debug')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              currentPath === '/admin/sync-debug'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-rose-400 hover:text-rose-300'
            }`}
          >
            <Bug className="h-3 w-3" />
            <span>Sisu Sync Debug</span>
          </button>
          <button
            onClick={() => onNavigate('/login')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition-all ${
              currentPath === '/login'
                ? 'bg-[#d97706]/20 text-[#d97706] border border-[#d97706]/40'
                : 'text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            <Shield className="h-3 w-3" />
            <span>Google SSO Gate</span>
          </button>
        </div>
      </div>
    </div>
  );
};
