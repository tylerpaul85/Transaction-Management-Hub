import React from 'react';
import { useTransactions } from '../context/TransactionContext';
import { TransactionStage, STAGE_CONFIG } from '../types/transaction';
import { TransactionCard } from './TransactionCard';
import { Layers, Plus, Sparkles } from 'lucide-react';

const STAGES: TransactionStage[] = [
  'intake',
  'escrow_opened',
  'inspection',
  'appraisal_loan',
  'clear_to_close',
  'closed',
];

export const PipelineBoard: React.FC = () => {
  const { filteredTransactions, setIsNewModalOpen } = useTransactions();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="w-full overflow-x-auto pb-6 pt-4 no-scrollbar">
      <div className="inline-flex gap-5 px-4 sm:px-6 lg:px-8 min-w-full items-start">
        {STAGES.map((stage) => {
          const stageConfig = STAGE_CONFIG[stage];
          const stageTransactions = filteredTransactions.filter((t) => t.stage === stage);
          const stageVolume = stageTransactions.reduce((acc, t) => acc + t.contractPrice, 0);

          return (
            <div
              key={stage}
              className="w-80 sm:w-88 flex-shrink-0 flex flex-col bg-[#111726] border border-white/10 rounded-2xl p-4 shadow-xl"
            >
              {/* Stage Header */}
              <div className="flex items-start justify-between pb-3.5 mb-3.5 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[#162035] text-amber-400 text-xs font-bold border border-white/10">
                      {stageConfig.step}
                    </span>
                    <h3 className="text-sm font-bold text-slate-100">
                      {stageConfig.label}
                    </h3>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 truncate max-w-[200px]">
                    {stageConfig.description}
                  </p>
                </div>

                <div className="text-right">
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#162035] text-slate-200 border border-white/10 tabular-nums">
                    {stageTransactions.length}
                  </span>
                  <p className="font-mono text-[11px] font-semibold text-amber-400 mt-1 tabular-nums">
                    {formatCurrency(stageVolume)}
                  </p>
                </div>
              </div>

              {/* Stage Cards Container */}
              <div className="flex flex-col gap-3 min-h-[420px] max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {stageTransactions.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center text-center p-4 border border-dashed border-white/10 rounded-xl bg-[#0d121f]/50">
                    <Layers className="h-6 w-6 text-slate-600 mb-2" />
                    <p className="text-xs text-slate-400 font-medium">No active files in this stage</p>
                    {stage === 'intake' && (
                      <p className="mt-1 text-[11px] text-slate-500">New deals sync in from Sisu</p>
                    )}
                  </div>
                ) : (
                  stageTransactions.map((trx) => (
                    <TransactionCard key={trx.id} transaction={trx} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
