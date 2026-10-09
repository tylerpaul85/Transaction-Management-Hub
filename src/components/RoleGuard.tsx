import React from 'react';
import { useAuth } from '../context/AuthContext';
import { AppRole } from '../types/database.types';
import { Lock, ArrowLeft } from 'lucide-react';

interface RoleGuardProps {
  allowedRoles: AppRole[];
  routeName: string;
  children: React.ReactNode;
  onNavigate?: (path: string) => void;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  allowedRoles,
  routeName,
  children,
  onNavigate,
}) => {
  const { currentUser } = useAuth();

  if (!currentUser) return null;

  const isAllowed = allowedRoles.includes(currentUser.role);

  if (isAllowed) {
    return <>{children}</>;
  }

  // Determine where to send the user back based on their actual role
  const getHomeRoute = () => {
    switch (currentUser.role) {
      case 'agent':
        return '/my-deals';
      case 'tc':
      case 'listing_coordinator':
        return '/ops';
      default:
        return '/';
    }
  };

  const homeRoute = getHomeRoute();

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <div className="p-8 bg-[#111726] border border-white/10 rounded-2xl shadow-2xl space-y-5">
        <div className="h-14 w-14 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
          <Lock className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            Access Restricted
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            The <strong className="text-slate-200 font-mono text-xs bg-[#0d121f] px-2 py-0.5 rounded border border-white/10">{routeName}</strong> route
            requires{' '}
            <strong className="text-slate-200">
              {allowedRoles.map((r) => r.replace('_', ' ')).join(' or ')}
            </strong>{' '}
            access. Your account is configured as{' '}
            <strong className="text-amber-400">{currentUser.role.replace('_', ' ')}</strong>.
          </p>
        </div>

        {onNavigate && (
          <button
            onClick={() => onNavigate(homeRoute)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-400 text-slate-950 hover:bg-amber-300 font-bold rounded-xl text-sm transition-colors shadow-md min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Go to My Dashboard</span>
          </button>
        )}

        <p className="text-[11px] text-slate-500">
          If you need access, contact your system administrator.
        </p>
      </div>
    </div>
  );
};
