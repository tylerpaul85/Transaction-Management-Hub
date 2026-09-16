import React from 'react';
import { useAuth } from '../context/AuthContext';
import { AppRole } from '../types/database.types';
import { ShieldAlert, ArrowRight, Lock, KeyRound } from 'lucide-react';

interface RoleGuardProps {
  allowedRoles: AppRole[];
  routeName: string;
  children: React.ReactNode;
  onSwitchToRole?: (role: AppRole) => void;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  allowedRoles,
  routeName,
  children,
  onSwitchToRole,
}) => {
  const { currentUser, setRole } = useAuth();

  const isAllowed = allowedRoles.includes(currentUser.role);

  if (isAllowed) {
    return <>{children}</>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <div className="p-8 bg-[#1e293b] border border-rose-500/30 rounded-2xl shadow-2xl space-y-4">
        <div className="h-16 w-16 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
          <Lock className="h-8 w-8" />
        </div>

        <div>
          <span className="text-xs font-mono-code font-bold uppercase tracking-wider text-rose-400">
            403 • Access Restricted by Route Guard
          </span>
          <h2 className="font-editorial text-2xl font-bold text-[#f8fafc] mt-1">
            Unauthorized for Route: {routeName}
          </h2>
          <p className="text-sm text-[#94a3b8] max-w-lg mx-auto mt-2">
            This route is restricted to users with role{' '}
            <strong className="text-[#f8fafc]">
              [{allowedRoles.map((r) => r.toUpperCase()).join(', ')}]
            </strong>
            . Your current authenticated role is{' '}
            <strong className="text-rose-300">[{currentUser.role.toUpperCase()}]</strong> (
            {currentUser.email}).
          </p>
        </div>

        <div className="pt-4 border-t border-[#334155]/60 flex flex-wrap items-center justify-center gap-3">
          <span className="text-xs text-[#94a3b8]">Quick switch role to test access:</span>
          {allowedRoles.map((targetRole) => (
            <button
              key={targetRole}
              onClick={() => {
                setRole(targetRole);
                if (onSwitchToRole) onSwitchToRole(targetRole);
              }}
              className="px-3 py-1.5 bg-[#d97706] text-[#0f172a] hover:bg-[#d97706]/90 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-md"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>Switch to {targetRole.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
