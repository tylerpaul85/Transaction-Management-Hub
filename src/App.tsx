import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TransactionProvider } from './context/TransactionContext';
import { RoleGuard } from './components/RoleGuard';
import { Navbar } from './components/Navbar';
import { MyDealsView } from './routes/MyDealsView';
import { OpsDashboard } from './routes/OpsDashboard';
import { AdminSyncDebug } from './routes/AdminSyncDebug';
import { TransactionHubView } from './routes/TransactionHubView';
import { FallThroughDashboard } from './routes/FallThroughDashboard';
import { MarketComparisonDashboard } from './routes/MarketComparisonDashboard';
import { AdminTaskMappings } from './components/AdminTaskMappings';
import { GoogleAuthGate } from './components/GoogleAuthGate';
import { TransactionDetailModal } from './components/TransactionDetailModal';
import { NewTransactionModal } from './components/NewTransactionModal';
import { CDAPrintModal } from './components/CDAPrintModal';
import { Loader2 } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────
   Loading Splash — shown while the Supabase session is being checked
   ───────────────────────────────────────────────────────────────────── */
const LoadingSplash: React.FC = () => (
  <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center gap-4">
    <div className="h-16 w-16 rounded-2xl bg-[#1e293b] border border-[#334155] p-2 flex items-center justify-center shadow-inner">
      <img
        src="/msreg-logo.png"
        alt="MSREG"
        className="h-full w-auto object-contain"
        onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
      />
    </div>
    <Loader2 className="h-6 w-6 animate-spin text-[#d97706]" />
    <p className="text-xs text-[#94a3b8] font-medium tracking-wide">Verifying session…</p>
  </div>
);

/* ─────────────────────────────────────────────────────────────────────
   Authenticated Layout — only rendered after successful sign-in
   ───────────────────────────────────────────────────────────────────── */
const AuthenticatedLayout: React.FC = () => {
  const { currentUser } = useAuth();

  // Determine default landing route based on role
  const getDefaultRoute = (): string => {
    if (currentUser?.role === 'agent') {
      return '/my-deals';
    }
    if (currentUser?.role === 'tc' || currentUser?.role === 'listing_coordinator') {
      return '/ops';
    }
    return '/hub';
  };

  const [currentPath, setCurrentPath] = useState<string>(() => {
    const path = window.location.pathname;
    // If landing on root or login, redirect to appropriate role home
    if (path === '/' || path === '/login') {
      const defaultRoute = getDefaultRoute();
      window.history.replaceState({}, '', defaultRoute);
      return defaultRoute;
    }
    return path;
  });

  const [visitedRoutes, setVisitedRoutes] = useState<Set<string>>(() => new Set([currentPath]));

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    window.history.pushState({}, '', path);
    setVisitedRoutes((prev) => {
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  };

  // Sync route on role load if currently on root
  useEffect(() => {
    if (currentUser && (currentPath === '/' || currentPath === '/login')) {
      const target = getDefaultRoute();
      setCurrentPath(target);
      window.history.replaceState({}, '', target);
      setVisitedRoutes((prev) => {
        const next = new Set(prev);
        next.add(target);
        return next;
      });
    }
  }, [currentUser]);

  useEffect(() => {
    const handlePopState = () => {
      const target = window.location.pathname || getDefaultRoute();
      setCurrentPath(target);
      setVisitedRoutes((prev) => {
        const next = new Set(prev);
        next.add(target);
        return next;
      });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-[#f8fafc] flex flex-col selection:bg-[#d97706]/30 selection:text-[#f8fafc]">
      {/* Main Navbar */}
      <Navbar onNavigate={handleNavigate} currentPath={currentPath} />

      {/* Main Routed Content with Keep-Alive View State Preservation */}
      <main className="flex-1 w-full pb-12">
        {/* Transaction Hub View */}
        {(visitedRoutes.has('/hub') || visitedRoutes.has('/') || currentPath === '/' || currentPath.startsWith('/hub')) && (
          <div style={{ display: (currentPath === '/' || currentPath === '/hub' || currentPath.startsWith('/hub')) ? 'block' : 'none' }}>
            <RoleGuard allowedRoles={['tc', 'listing_coordinator', 'admin']} routeName="/hub" onNavigate={handleNavigate}>
              <TransactionHubView onNavigate={handleNavigate} />
            </RoleGuard>
          </div>
        )}

        {/* Operations Escrows Dashboard */}
        {(visitedRoutes.has('/ops') || currentPath === '/ops') && (
          <div style={{ display: currentPath === '/ops' ? 'block' : 'none' }}>
            <RoleGuard allowedRoles={['tc', 'listing_coordinator', 'admin']} routeName="/ops" onNavigate={handleNavigate}>
              <OpsDashboard />
            </RoleGuard>
          </div>
        )}

        {/* Agent / Team My Deals View */}
        {(visitedRoutes.has('/my-deals') || currentPath === '/my-deals') && (
          <div style={{ display: currentPath === '/my-deals' ? 'block' : 'none' }}>
            <RoleGuard allowedRoles={['agent', 'admin', 'tc', 'listing_coordinator']} routeName="/my-deals" onNavigate={handleNavigate}>
              <MyDealsView />
            </RoleGuard>
          </div>
        )}

        {/* Admin Task Mappings */}
        {currentPath === '/ops/task-mappings' && (
          <RoleGuard allowedRoles={['admin']} routeName="/ops/task-mappings" onNavigate={handleNavigate}>
            <div className="pt-4">
              <AdminTaskMappings />
            </div>
          </RoleGuard>
        )}

        {/* Admin Sync Debug */}
        {currentPath === '/admin/sync-debug' && (
          <RoleGuard allowedRoles={['admin']} routeName="/admin/sync-debug" onNavigate={handleNavigate}>
            <AdminSyncDebug />
          </RoleGuard>
        )}

        {/* Admin Fall-Through Analysis */}
        {(visitedRoutes.has('/admin/fall-through') || currentPath === '/admin/fall-through') && (
          <div style={{ display: currentPath === '/admin/fall-through' ? 'block' : 'none' }}>
            <RoleGuard allowedRoles={['admin']} routeName="/admin/fall-through" onNavigate={handleNavigate}>
              <FallThroughDashboard />
            </RoleGuard>
          </div>
        )}

        {/* Admin Market Comparison */}
        {(visitedRoutes.has('/admin/market-comparison') || currentPath === '/admin/market-comparison') && (
          <div style={{ display: currentPath === '/admin/market-comparison' ? 'block' : 'none' }}>
            <RoleGuard allowedRoles={['admin']} routeName="/admin/market-comparison" onNavigate={handleNavigate}>
              <MarketComparisonDashboard />
            </RoleGuard>
          </div>
        )}
      </main>

      {/* Modals */}
      <TransactionDetailModal />
      <NewTransactionModal />
      <CDAPrintModal />
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────
   App Root — session gating layer
   ───────────────────────────────────────────────────────────────────── */
const AppGate: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  // Still checking session → splash
  if (isLoading) {
    return <LoadingSplash />;
  }

  // Not authenticated → Google SSO login
  if (!isAuthenticated) {
    return <GoogleAuthGate />;
  }

  // Authenticated → full workspace
  return (
    <TransactionProvider>
      <AuthenticatedLayout />
    </TransactionProvider>
  );
};

export function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}

export default App;
