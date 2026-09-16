import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TransactionProvider } from './context/TransactionContext';
import { RoleSwitcherBar } from './components/RoleSwitcherBar';
import { RoleGuard } from './components/RoleGuard';
import { Navbar } from './components/Navbar';
import { PipelineBoard } from './components/PipelineBoard';
import { TableView } from './components/TableView';
import { DeadlinesView } from './components/DeadlinesView';
import { HubHome } from './routes/HubHome';
import { MyDealsView } from './routes/MyDealsView';
import { OpsDashboard } from './routes/OpsDashboard';
import { AdminSyncDebug } from './routes/AdminSyncDebug';
import { GoogleAuthGate } from './components/GoogleAuthGate';
import { TransactionDetailModal } from './components/TransactionDetailModal';
import { NewTransactionModal } from './components/NewTransactionModal';
import { CDAPrintModal } from './components/CDAPrintModal';
import { useTransactions } from './context/TransactionContext';

const MainLayout: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname === '/my-deals' ||
      window.location.pathname === '/ops' ||
      window.location.pathname === '/admin/sync-debug' ||
      window.location.pathname === '/login'
      ? window.location.pathname
      : '/';
  });

  const { viewMode } = useTransactions();

  // Keep URL in sync
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
      {/* Dev & Testing Auth Role Switcher Bar */}
      <RoleSwitcherBar currentPath={currentPath} onNavigate={handleNavigate} />

      {/* Main Navbar */}
      <Navbar />

      {/* Main Routed Content */}
      <main className="flex-1 w-full pb-12">
        {currentPath === '/' && (
          <div>
            <HubHome onNavigate={handleNavigate} />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
              <div className="border-t border-[#334155] pt-6">
                <h3 className="font-editorial text-lg font-bold text-[#f8fafc] mb-2">
                  Interactive Transaction Workspace Preview
                </h3>
                <p className="text-xs text-[#94a3b8] mb-4">
                  Visual Kanban and Table populated with seed data matching real-world schema.
                </p>
              </div>
            </div>
            {viewMode === 'kanban' && <PipelineBoard />}
            {viewMode === 'table' && <TableView />}
            {viewMode === 'deadlines' && <DeadlinesView />}
          </div>
        )}

        {currentPath === '/my-deals' && (
          <RoleGuard allowedRoles={['agent']} routeName="/my-deals">
            <MyDealsView />
          </RoleGuard>
        )}

        {currentPath === '/ops' && (
          <RoleGuard allowedRoles={['tc', 'listing_coordinator', 'admin']} routeName="/ops">
            <OpsDashboard />
          </RoleGuard>
        )}

        {currentPath === '/admin/sync-debug' && (
          <RoleGuard allowedRoles={['admin']} routeName="/admin/sync-debug">
            <AdminSyncDebug />
          </RoleGuard>
        )}

        {currentPath === '/login' && <GoogleAuthGate />}
      </main>

      {/* Modals */}
      <TransactionDetailModal />
      <NewTransactionModal />
      <CDAPrintModal />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <TransactionProvider>
        <MainLayout />
      </TransactionProvider>
    </AuthProvider>
  );
}

export default App;
