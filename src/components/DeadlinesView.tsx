import React, { useState } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { Contingency, Transaction } from '../types/transaction';
import {
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Building,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';

interface FlatContingency {
  contingency: Contingency;
  transaction: Transaction;
  diffDays: number;
}

export const DeadlinesView: React.FC = () => {
  const { transactions, setSelectedTransactionId, updateContingencyStatus } = useTransactions();
  const [filterCategory, setFilterCategory] = useState<'all' | 'pending' | 'satisfied'>('pending');

  const today = new Date();

  // Flatten contingencies
  const allFlat: FlatContingency[] = [];
  transactions.forEach((trx) => {
    trx.contingencies.forEach((c) => {
      let diff = 0;
      try {
        diff = differenceInDays(parseISO(c.dueDate), today);
      } catch {
        diff = 0;
      }
      allFlat.push({
        contingency: c,
        transaction: trx,
        diffDays: diff,
      });
    });
  });

  // Filter based on user selection
  const filtered = allFlat.filter((item) => {
    if (filterCategory === 'pending') {
      return item.contingency.status === 'pending';
    }
    if (filterCategory === 'satisfied') {
      return item.contingency.status === 'satisfied' || item.contingency.status === 'complete' || item.contingency.status === 'waived';
    }
    return true;
  });

  // Sort by due date ascending
  const sorted = [...filtered].sort((a, b) => {
    return a.diffDays - b.diffDays;
  });

  // Buckets
  const overdue = sorted.filter((i) => i.contingency.status === 'pending' && i.diffDays < 0);
  const urgent = sorted.filter(
    (i) => i.contingency.status === 'pending' && i.diffDays >= 0 && i.diffDays <= 2
  );
  const thisWeek = sorted.filter(
    (i) => i.contingency.status === 'pending' && i.diffDays > 2 && i.diffDays <= 7
  );
  const upcoming = sorted.filter((i) => i.contingency.status === 'pending' && i.diffDays > 7);
  const satisfied = sorted.filter(
    (i) => i.contingency.status === 'satisfied' || i.contingency.status === 'complete' || i.contingency.status === 'waived'
  );

  const renderSection = (
    title: string,
    items: FlatContingency[],
    badgeColor: string,
    icon: React.ReactNode
  ) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h3 className="font-editorial text-lg font-bold text-[#f8fafc]">{title}</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${badgeColor}`}>
            {items.length}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {items.map(({ contingency, transaction, diffDays }) => (
            <div
              key={`${transaction.id}-${contingency.id}`}
              className="bg-[#1e293b]/90 border border-[#334155] hover:border-[#d97706]/60 rounded-xl p-4 transition-all shadow-md flex flex-col justify-between gap-3 group"
            >
              <div>
                {/* Header: Property & File */}
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-mono-code text-xs text-[#94a3b8] font-bold">
                    {transaction.fileNumber}
                  </span>
                  <span
                    className={`font-mono-code text-xs px-2 py-0.5 rounded-md border font-semibold ${
                      contingency.status === 'satisfied' || contingency.status === 'complete'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : diffDays < 0
                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 font-bold animate-pulse'
                        : diffDays <= 2
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 font-bold'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {contingency.status === 'satisfied' || contingency.status === 'complete'
                      ? 'Satisfied'
                      : diffDays < 0
                      ? `${Math.abs(diffDays)}d Overdue`
                      : diffDays === 0
                      ? 'Due Today'
                      : `Due in ${diffDays}d (${contingency.dueDate})`}
                  </span>
                </div>

                {/* Contingency Title */}
                <h4 className="text-base font-semibold text-[#f8fafc] group-hover:text-[#d97706] transition-colors">
                  {contingency.name}
                </h4>

                {/* Property Address */}
                <div className="flex items-center gap-1.5 text-xs text-[#94a3b8] mt-1">
                  <Building className="h-3.5 w-3.5 text-[#d97706]" />
                  <span>
                    {transaction.address} {transaction.unit ? `• ${transaction.unit}` : ''}
                  </span>
                </div>

                {/* Notes */}
                {contingency.notes && (
                  <p className="mt-2 text-xs text-[#94a3b8] bg-[#131826]/70 p-2 rounded-lg border border-[#334155]/60">
                    {contingency.notes}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-[#334155]/60">
                <div className="text-xs text-[#94a3b8]">
                  Agent: <span className="text-[#f8fafc]">{transaction.agentName}</span>
                </div>

                <div className="flex items-center gap-2">
                  {contingency.status === 'pending' && (
                    <button
                      onClick={() =>
                        updateContingencyStatus(
                          transaction.id,
                          contingency.id,
                          'satisfied',
                          'Marked satisfied from Deadlines Hub'
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-[#0f172a] border border-emerald-500/30 text-xs font-semibold transition-all flex items-center gap-1 min-h-[36px]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Satisfy</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedTransactionId(transaction.id)}
                    className="p-1.5 rounded-lg bg-[#131826] hover:bg-[#334155] text-[#94a3b8] hover:text-[#f8fafc] border border-[#334155] transition-all min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title="View Full File"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* View Header & Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-editorial text-2xl font-bold text-[#f8fafc]">
            Contingency & Deadline Stream
          </h2>
          <p className="text-sm text-[#94a3b8]">
            Real-time contractual obligation timeline across all active MSREG transactions.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[#1e293b] p-1 rounded-xl border border-[#334155]">
          <button
            onClick={() => setFilterCategory('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterCategory === 'pending'
                ? 'bg-[#0f172a] text-[#f8fafc] border border-[#334155] font-semibold'
                : 'text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            Pending Only ({allFlat.filter((i) => i.contingency.status === 'pending').length})
          </button>
          <button
            onClick={() => setFilterCategory('satisfied')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterCategory === 'satisfied'
                ? 'bg-[#0f172a] text-[#f8fafc] border border-[#334155] font-semibold'
                : 'text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            Satisfied / Waived ({satisfied.length})
          </button>
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterCategory === 'all'
                ? 'bg-[#0f172a] text-[#f8fafc] border border-[#334155] font-semibold'
                : 'text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            All ({allFlat.length})
          </button>
        </div>
      </div>

      {/* Overdue Section */}
      {filterCategory !== 'satisfied' &&
        renderSection(
          'Overdue Contingencies',
          overdue,
          'bg-rose-500/15 text-rose-400 border-rose-500/30',
          <AlertTriangle className="h-5 w-5 text-rose-400" />
        )}

      {/* Due in 48 Hours */}
      {filterCategory !== 'satisfied' &&
        renderSection(
          'Critical: Due Within 48 Hours',
          urgent,
          'bg-amber-500/15 text-amber-400 border-amber-500/30',
          <Clock className="h-5 w-5 text-amber-400" />
        )}

      {/* This Week */}
      {filterCategory !== 'satisfied' &&
        renderSection(
          'Due This Week',
          thisWeek,
          'bg-sky-500/15 text-sky-400 border-sky-500/30',
          <CalendarClock className="h-5 w-5 text-sky-400" />
        )}

      {/* Upcoming */}
      {filterCategory !== 'satisfied' &&
        renderSection(
          'Upcoming Deadlines',
          upcoming,
          'bg-slate-500/15 text-slate-400 border-slate-500/30',
          <ShieldCheck className="h-5 w-5 text-slate-400" />
        )}

      {/* Satisfied Section */}
      {(filterCategory === 'satisfied' || filterCategory === 'all') &&
        renderSection(
          'Satisfied & Cleared Contingencies',
          satisfied,
          'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        )}
    </div>
  );
};
