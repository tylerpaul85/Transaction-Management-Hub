import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTransactions } from '../context/TransactionContext';
import {
  ShieldAlert,
  Users,
  Building,
  Plus,
  ArrowRight,
  Edit,
  CheckCircle2,
  Clock,
  Settings,
  Layers,
} from 'lucide-react';

export const OpsPlaceholder: React.FC = () => {
  const { currentUser } = useAuth();
  const {
    transactions,
    setSelectedTransactionId,
    setIsNewModalOpen,
    openCdaModal,
  } = useTransactions();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Route & Access Banner */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-6 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-editorial text-xl sm:text-2xl font-bold text-[#f8fafc]">
                  Operations Command Center (/ops)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30 uppercase">
                  Role: {currentUser.role} Verified
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] font-mono-code mt-0.5">
                Authenticated as {currentUser.fullName} ({currentUser.email})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-4 py-2 bg-[#d97706] text-[#0f172a] hover:bg-[#d97706]/90 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md min-h-[40px]"
            >
              <Plus className="h-4 w-4" />
              <span>New Transaction Intake</span>
            </button>
          </div>
        </div>

        {/* Access Control & Data Layer Info Box */}
        <div className="p-4 bg-[#131826]/80 rounded-xl border border-[#334155] text-xs text-[#94a3b8] space-y-1.5 leading-relaxed">
          <p className="text-[#f8fafc] font-semibold flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-sky-400" />
            <span>Ops & TC Full CRUD Permissions:</span>
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>
              <strong>SELECT, INSERT, UPDATE:</strong> Ops users (<code>tc</code>,{' '}
              <code>listing_coordinator</code>, <code>admin</code>) can manage ALL brokerage
              transactions and milestone checklists.
            </li>
            <li>
              <strong>TC Assignment:</strong> Assigned coordinator (e.g. Sarah Jenkins) can verify
              earnest money, approve compliance documents, and update milestone dates.
            </li>
            <li>
              <strong>Admin Only:</strong> Managing rows in <code>agents</code> and{' '}
              <code>ops_users</code> tables is restricted to <code>role = 'admin'</code>.
            </li>
          </ul>
        </div>
      </div>

      {/* Brokerage-Wide Transaction Management Table */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#334155] flex items-center justify-between">
          <h2 className="font-editorial text-lg font-bold text-[#f8fafc]">
            All Brokerage Transactions ({transactions.length})
          </h2>
          <span className="text-xs text-[#94a3b8]">
            Full visibility across all agents & coordinators
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#131826] text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider border-b border-[#334155]">
              <tr>
                <th className="py-3 px-4">File #</th>
                <th className="py-3 px-4">Property Address</th>
                <th className="py-3 px-4">Agent (Lead)</th>
                <th className="py-3 px-4">Assigned TC</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4">Target Close</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]/60">
              {transactions.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setSelectedTransactionId(t.id)}
                  className="hover:bg-[#131826]/60 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-mono-code font-bold text-xs text-[#d97706]">
                    {t.fileNumber}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-[#f8fafc] block">{t.address}</span>
                    <span className="text-xs text-[#94a3b8]">{t.clientNames.join(', ')}</span>
                  </td>
                  <td className="py-3 px-4 text-xs font-medium text-[#f8fafc]">{t.agentName}</td>
                  <td className="py-3 px-4 text-xs text-sky-400 font-semibold">{t.tcName}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#131826] text-[#f8fafc] border border-[#334155]">
                      {t.stage.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono-code text-xs text-[#f8fafc]">
                    {t.targetClosingDate}
                  </td>
                  <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openCdaModal(t)}
                        className="px-2.5 py-1 rounded bg-[#131826] hover:bg-[#d97706] text-[#94a3b8] hover:text-[#0f172a] text-xs font-medium border border-[#334155] transition-all"
                      >
                        CDA
                      </button>
                      <button
                        onClick={() => setSelectedTransactionId(t.id)}
                        className="px-2.5 py-1 rounded bg-[#d97706]/15 hover:bg-[#d97706] text-[#d97706] hover:text-[#0f172a] text-xs font-bold border border-[#d97706]/30 transition-all"
                      >
                        Manage
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
