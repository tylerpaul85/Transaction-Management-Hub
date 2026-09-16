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
              className="w-80 sm:w-88 flex-shrink-0 flex flex-col bg-[#131826]/70 border border-[#334155]/70 rounded-2xl p-3.5 backdrop-blur-md shadow-lg"
            >
              {/* Stage Header */}
              <div className="flex items-start justify-between pb-3 mb-3 border-b border-[#334155]/60">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center h-5 w-5 rounded-full bg-[#1e293b] text-[#d97706] text-xs font-bold border border-[#334155]">
                      {stageConfig.step}
                    </span>
                    <h3 className="font-editorial text-base font-semibold text-[#f8fafc]">
                      {stageConfig.label}
                    </h3>
                  </div>
                  <p className="text-[11px] text-[#94a3b8] mt-0.5 truncate max-w-[200px]">
                    {stageConfig.description}
                  </p>
                </div>

                <div className="text-right">
                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#1e293b] text-[#f8fafc] border border-[#334155]">
                    {stageTransactions.length}
                  </span>
                  <p className="font-mono-code text-[11px] font-semibold text-[#d97706] mt-0.5">
                    {formatCurrency(stageVolume)}
                  </p>
                </div>
              </div>

              {/* Stage Cards Container */}
              <div className="flex flex-col gap-3.5 min-h-[420px] max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {stageTransactions.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[#334155]/60 rounded-xl bg-[#0f172a]/40">
                    <Layers className="h-6 w-6 text-[#94a3b8]/40 mb-2" />
                    <p className="text-xs text-[#94a3b8] font-medium">No active files in this stage</p>
                    {stage === 'intake' && (
                      <button
                        onClick={() => setIsNewModalOpen(true)}
                        className="mt-2 text-xs text-[#d97706] hover:underline flex items-center gap-1 font-semibold"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add File</span>
                      </button>
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
