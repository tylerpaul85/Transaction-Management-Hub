import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TransactionProvider } from './context/TransactionContext';
import { RoleGuard } from './components/RoleGuard';
import { Navbar } from './components/Navbar';
import { PipelineBoard } from './components/PipelineBoard';
import { TableView } from './components/TableView';
import { DeadlinesView } from './components/DeadlinesView';
import { HubHome } from './routes/HubHome';
import { MyDealsView } from './routes/MyDealsView';
import { OpsDashboard } from './routes/OpsDashboard';
import { AdminSyncDebug } from './routes/AdminSyncDebug';
import { AdminTaskMappings } from './components/AdminTaskMappings';
import { GoogleAuthGate } from './components/GoogleAuthGate';
import { TransactionDetailModal } from './components/TransactionDetailModal';
import { NewTransactionModal } from './components/NewTransactionModal';
import { CDAPrintModal } from './components/CDAPrintModal';
import { useTransactions } from './context/TransactionContext';
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
    if (!currentUser) return '/';
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

  const [currentPath, setCurrentPath] = useState<string>(() => {
    const path = window.location.pathname;
    // If landing on root or login, redirect to role-appropriate route
    if (path === '/' || path === '/login') {
      const defaultRoute = getDefaultRoute();
      if (defaultRoute !== '/') {
        window.history.replaceState({}, '', defaultRoute);
        return defaultRoute;
      }
    }
    return path;
  });

  const { viewMode } = useTransactions();

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    window.history.pushState({}, '', path);
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a] text-[#f8fafc] flex flex-col selection:bg-[#d97706]/30 selection:text-[#f8fafc]">
      {/* Main Navbar */}
      <Navbar onNavigate={handleNavigate} currentPath={currentPath} />

      {/* Main Routed Content */}
      <main className="flex-1 w-full pb-12">
        {currentPath === '/' && (
          <div>
            <HubHome onNavigate={handleNavigate} />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
              <div className="border-t border-[#334155] pt-6">
                <h3 className="font-editorial text-lg font-bold text-[#f8fafc] mb-2">
                  Transaction Pipeline
                </h3>
                <p className="text-xs text-[#94a3b8] mb-4">
                  Visual Kanban, Table, and Deadlines views powered by live data.
                </p>
              </div>
            </div>
            {viewMode === 'kanban' && <PipelineBoard />}
            {viewMode === 'table' && <TableView />}
            {viewMode === 'deadlines' && <DeadlinesView />}
          </div>
        )}

        {currentPath === '/my-deals' && (
          <RoleGuard allowedRoles={['agent', 'admin', 'tc', 'listing_coordinator']} routeName="/my-deals" onNavigate={handleNavigate}>
            <MyDealsView />
          </RoleGuard>
        )}

        {currentPath === '/ops' && (
          <RoleGuard allowedRoles={['tc', 'listing_coordinator', 'admin']} routeName="/ops" onNavigate={handleNavigate}>
            <OpsDashboard />
          </RoleGuard>
        )}

        {currentPath === '/ops/task-mappings' && (
          <RoleGuard allowedRoles={['admin']} routeName="/ops/task-mappings" onNavigate={handleNavigate}>
            <div className="pt-4">
              <AdminTaskMappings />
            </div>
          </RoleGuard>
        )}

        {currentPath === '/admin/sync-debug' && (
          <RoleGuard allowedRoles={['admin']} routeName="/admin/sync-debug" onNavigate={handleNavigate}>
            <AdminSyncDebug />
          </RoleGuard>
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
