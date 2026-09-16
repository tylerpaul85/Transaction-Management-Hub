import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTransactions } from '../context/TransactionContext';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Building,
  ArrowRight,
  Eye,
  Lock,
  FileSpreadsheet,
} from 'lucide-react';

export const MyDealsPlaceholder: React.FC = () => {
  const { currentUser } = useAuth();
  const { transactions, setSelectedTransactionId } = useTransactions();

  // In real Supabase with RLS, the query `SELECT * FROM transactions` returns only deals where listing_agent_id = me or selling_agent_id = me.
  // We simulate this exact filtering:
  const agentName = currentUser.fullName;
  const myDeals = transactions.filter(
    (t) => t.agentName.toLowerCase() === agentName.toLowerCase()
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Route & Access Banner */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-6 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-editorial text-xl sm:text-2xl font-bold text-[#f8fafc]">
                  Agent Deal Portal (/my-deals)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Role: AGENT Verified
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] font-mono-code mt-0.5">
                Authenticated as {currentUser.fullName} ({currentUser.email})
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-[#94a3b8] block">RLS Policy Active:</span>
            <span className="text-xs font-mono-code font-bold text-[#d97706]">
              SELECT Only (Own Transactions & Milestones)
            </span>
          </div>
        </div>

        {/* Access Control & Data Layer Info Box */}
        <div className="p-4 bg-[#131826]/80 rounded-xl border border-[#334155] text-xs text-[#94a3b8] space-y-1.5 leading-relaxed">
          <p className="text-[#f8fafc] font-semibold flex items-center gap-1.5">
            <Eye className="h-4 w-4 text-emerald-400" />
            <span>Data Layer & RLS Enforcement:</span>
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li>
              Agents can <strong>SELECT only transactions</strong> where they are{' '}
              <code className="text-[#d97706]">listing_agent_id</code> or{' '}
              <code className="text-[#d97706]">selling_agent_id</code>.
            </li>
            <li>
              Agents can <strong>SELECT (read-only)</strong> related milestone checklists and
              target dates.
            </li>
            <li>
              Direct edits to milestones/transactions are locked for Agents (managed by assigned TC
              in <code className="text-[#d97706]">/ops</code>).
            </li>
          </ul>
        </div>
      </div>

      {/* Agent's Filtered Transactions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-editorial text-lg font-bold text-[#f8fafc]">
            My Active Deals ({myDeals.length})
          </h2>
          <span className="text-xs text-[#94a3b8]">
            Simulated query from <code className="font-mono-code text-[#d97706]">public.transactions</code>
          </span>
        </div>

        {myDeals.length === 0 ? (
          <div className="p-12 text-center bg-[#1e293b] rounded-2xl border border-[#334155] text-[#94a3b8]">
            <p>No active deals assigned to {currentUser.fullName}.</p>
            <p className="text-xs mt-1">Switch to Tyler Miller to see his assigned deals.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myDeals.map((deal) => (
              <div
                key={deal.id}
                onClick={() => setSelectedTransactionId(deal.id)}
                className="p-5 bg-[#1e293b] border border-[#334155] hover:border-[#d97706]/60 rounded-2xl shadow-lg transition-all cursor-pointer group space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono-code text-xs text-[#d97706] font-bold block mb-1">
                      {deal.fileNumber} • {deal.representation} Rep
                    </span>
                    <h3 className="font-editorial text-lg font-bold text-[#f8fafc] group-hover:text-[#d97706] transition-colors">
                      {deal.address} {deal.unit ? `(${deal.unit})` : ''}
                    </h3>
                    <p className="text-xs text-[#94a3b8]">{deal.clientNames.join(', ')}</p>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#131826] text-[#f8fafc] border border-[#334155]">
                    {deal.stage.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#334155]/60">
                  <div>
                    <span className="text-[#94a3b8] block">Price:</span>
                    <span className="font-mono-code font-bold text-[#f8fafc]">
                      ${deal.contractPrice.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#94a3b8] block">Target Closing:</span>
                    <span className="font-mono-code font-semibold text-[#d97706]">
                      {deal.targetClosingDate}
                    </span>
                  </div>
                </div>

                {/* Milestone Summary */}
                <div className="space-y-1.5 pt-2 border-t border-[#334155]/60">
                  <span className="text-[11px] text-[#94a3b8] uppercase tracking-wider font-bold block">
                    Upcoming Milestones (Read Only):
                  </span>
                  <div className="space-y-1">
                    {deal.contingencies.slice(0, 3).map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between text-xs p-1.5 bg-[#131826] rounded-lg border border-[#334155]/40"
                      >
                        <span className="truncate max-w-[200px] text-[#f8fafc]">{c.name}</span>
                        <span
                          className={`font-mono-code text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                            c.status === 'satisfied'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-amber-500/15 text-amber-400'
                          }`}
                        >
                          {c.status.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 text-xs text-[#d97706] font-semibold">
                  <span>Assigned TC: {deal.tcName}</span>
                  <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <span>View Full File</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
