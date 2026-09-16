import React from 'react';
import { Transaction, STAGE_CONFIG, TransactionStage } from '../types/transaction';
import { useTransactions } from '../context/TransactionContext';
import {
  Calendar,
  AlertCircle,
  CheckCircle2,
  FileText,
  User,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';

interface TransactionCardProps {
  transaction: Transaction;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({ transaction }) => {
  const {
    setSelectedTransactionId,
    setActiveDetailTab,
    updateTransactionStage,
    openCdaModal,
  } = useTransactions();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Compute days to closing
  const getClosingCountdown = () => {
    if (transaction.stage === 'closed') {
      return {
        text: 'Closed & Funded',
        color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      };
    }

    try {
      const today = new Date();
      const closeDate = parseISO(transaction.targetClosingDate);
      const diff = differenceInDays(closeDate, today);

      if (diff < 0) {
        return {
          text: `Closing Overdue by ${Math.abs(diff)}d`,
          color: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        };
      }
      if (diff === 0) {
        return {
          text: 'Closing Today!',
          color: 'bg-amber-500/10 text-amber-400 border-amber-500/30 font-bold',
        };
      }
      if (diff <= 7) {
        return {
          text: `Closing in ${diff} days`,
          color: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        };
      }
      return {
        text: `Closing in ${diff} days`,
        color: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
      };
    } catch {
      return {
        text: transaction.targetClosingDate,
        color: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
      };
    }
  };

  // Contingency health & urgency check
  const getUrgentContingency = () => {
    const pendingContingencies = transaction.contingencies.filter((c) => c.status === 'pending');
    if (pendingContingencies.length === 0) return null;

    const today = new Date();
    for (const c of pendingContingencies) {
      try {
        const due = parseISO(c.dueDate);
        const diff = differenceInDays(due, today);
        if (diff <= 2) {
          return {
            name: c.name,
            diff,
            isOverdue: diff < 0,
          };
        }
      } catch {
        // ignore
      }
    }
    return null;
  };

  // Stage sequence for progression
  const STAGES: TransactionStage[] = [
    'intake',
    'escrow_opened',
    'inspection',
    'appraisal_loan',
    'clear_to_close',
    'closed',
  ];

  const currentStageIndex = STAGES.indexOf(transaction.stage);
  const prevStage = currentStageIndex > 0 ? STAGES[currentStageIndex - 1] : null;
  const nextStage = currentStageIndex < STAGES.length - 1 ? STAGES[currentStageIndex + 1] : null;

  const urgentContingency = getUrgentContingency();
  const closingCountdown = getClosingCountdown();

  // Document compliance ratio
  const compliantDocsCount = transaction.documents.filter(
    (d) => d.status === 'approved' || d.status === 'signed'
  ).length;
  const totalDocsCount = transaction.documents.length;

  return (
    <div
      onClick={() => setSelectedTransactionId(transaction.id)}
      className="group relative bg-[#1e293b]/90 hover:bg-[#1e293b] border border-[#334155] hover:border-[#d97706]/60 rounded-xl p-4 cursor-pointer transition-all duration-200 shadow-md hover:shadow-xl hover:shadow-black/40 active:scale-[0.99] flex flex-col gap-3"
    >
      {/* Top Header: Image & Badges */}
      <div className="flex items-start gap-3">
        <div className="relative h-16 w-20 sm:h-20 sm:w-24 rounded-lg overflow-hidden flex-shrink-0 bg-[#0f172a] border border-[#334155]">
          <img
            src={transaction.photoUrl}
            alt={transaction.address}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/80 via-transparent to-transparent" />
          <span className="absolute bottom-1 left-1.5 text-[10px] font-mono-code font-bold text-[#f8fafc] bg-black/60 px-1 py-0.2 rounded">
            {transaction.propertyType.split(' ')[0]}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="font-mono-code text-xs text-[#94a3b8] font-semibold">
              {transaction.fileNumber}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                transaction.representation === 'Buyer'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : transaction.representation === 'Seller'
                  ? 'bg-[#d97706]/15 text-[#d97706] border-[#d97706]/30'
                  : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
              }`}
            >
              {transaction.representation} Rep
            </span>
          </div>

          <h4 className="font-editorial text-sm sm:text-base font-semibold text-[#f8fafc] truncate leading-tight group-hover:text-[#d97706] transition-colors">
            {transaction.address}
          </h4>
          {transaction.unit && (
            <p className="text-xs text-[#94a3b8] truncate font-medium">{transaction.unit}</p>
          )}
          <p className="text-xs text-[#94a3b8] truncate">
            {transaction.city}, {transaction.state} {transaction.zip}
          </p>
        </div>
      </div>

      {/* Contract Price & Commission Payout */}
      <div className="flex items-baseline justify-between pt-1 border-t border-[#334155]/50">
        <div>
          <span className="text-[11px] text-[#94a3b8] block">Contract Price</span>
          <span className="font-mono-code text-base sm:text-lg font-bold text-[#f8fafc]">
            {formatCurrency(transaction.contractPrice)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-[#94a3b8] block">Agent Net Est.</span>
          <span className="font-mono-code text-xs sm:text-sm font-semibold text-[#d97706]">
            {formatCurrency(transaction.commission?.netAgentPayout || 0)}
          </span>
        </div>
      </div>

      {/* Urgent Contingency Alert (if any) */}
      {urgentContingency && (
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
            urgentContingency.isOverdue
              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 animate-pulse'
              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">
            {urgentContingency.isOverdue ? 'OVERDUE: ' : 'ALERT: '}
            {urgentContingency.name}
          </span>
        </div>
      )}

      {/* Closing Countdown Badge & Doc Progress */}
      <div className="flex items-center justify-between text-xs pt-1">
        <div className={`px-2 py-0.5 rounded-full border text-[11px] font-medium flex items-center gap-1.5 ${closingCountdown.color}`}>
          <Clock className="h-3 w-3" />
          <span>{closingCountdown.text}</span>
        </div>

        <div className="flex items-center gap-1 text-[#94a3b8] text-[11px]">
          <FileText className="h-3 w-3" />
          <span>
            {compliantDocsCount}/{totalDocsCount} Docs
          </span>
        </div>
      </div>

      {/* Card Footer: Agent Avatar & Quick Stage Mover */}
      <div className="flex items-center justify-between pt-2 border-t border-[#334155]/60 mt-auto">
        <div className="flex items-center gap-1.5">
          <div className="h-6 w-6 rounded-full bg-[#334155] border border-[#2a354c] flex items-center justify-center text-[10px] font-bold text-[#f8fafc]">
            {transaction.agentAvatar}
          </div>
          <span className="text-xs text-[#94a3b8] truncate max-w-[100px]">
            {transaction.agentName.split(' ')[0]}
          </span>
        </div>

        {/* Quick Stage Progression Buttons */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {prevStage && (
            <button
              title={`Move back to ${STAGE_CONFIG[prevStage].label}`}
              onClick={() => updateTransactionStage(transaction.id, prevStage)}
              className="p-1 rounded-md bg-[#131826] hover:bg-[#334155] text-[#94a3b8] hover:text-[#f8fafc] border border-[#334155] transition-all"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          )}
          {nextStage && (
            <button
              title={`Advance to ${STAGE_CONFIG[nextStage].label}`}
              onClick={() => updateTransactionStage(transaction.id, nextStage)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#131826] hover:bg-[#d97706] text-[#94a3b8] hover:text-[#0f172a] border border-[#334155] hover:border-[#d97706] text-[11px] font-medium transition-all"
            >
              <span>Next</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
