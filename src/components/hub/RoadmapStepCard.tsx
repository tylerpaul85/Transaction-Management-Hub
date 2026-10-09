import React, { useState } from 'react';
import { HubRoadmapStep } from '../../types/hub';
import { Check, Clock, Lock, ChevronDown, Calendar, Undo2, ShieldCheck } from 'lucide-react';

interface RoadmapStepCardProps {
  step: HubRoadmapStep;
  isFirst: boolean;
  isLast: boolean;
  isActive?: boolean;
  isOpsOrTc?: boolean;
  onToggleStatus?: (stepId: string) => void;
  onRequestApproval?: (step: HubRoadmapStep) => void;
  onApproveByTc?: (stepId: string) => void;
  onDateChange?: (stepId: string, newDate: string) => void;
}

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const RoadmapStepCard: React.FC<RoadmapStepCardProps> = ({
  step,
  isFirst,
  isLast,
  isActive = false,
  isOpsOrTc = false,
  onToggleStatus,
  onRequestApproval,
  onApproveByTc,
  onDateChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [dateInput, setDateInput] = useState(step.date || '');

  const isCompleted = step.status === 'completed';
  const isInProgress = step.status === 'in_progress';
  const isLocked = step.status === 'locked';
  const isPendingApproval = step.approvalData?.approvalStatus === 'pending_tc_approval';
  const isCurrent = !isCompleted && !isPendingApproval && (isActive || isInProgress);

  const handleActionClick = () => {
    if (isPendingApproval) {
      onRequestApproval?.(step);
      return;
    }
    if (!isCompleted && onRequestApproval) {
      onRequestApproval(step);
    } else {
      onToggleStatus?.(step.id);
    }
  };

  const handleDateSave = (e: React.FormEvent) => {
    e.preventDefault();
    onDateChange?.(step.id, dateInput);
    setIsEditingDate(false);
  };

  // Single source of truth for state-driven styling
  const state = isCompleted
    ? {
        label: 'Done',
        chip: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
        node: 'bg-emerald-500 text-slate-950 border-emerald-500',
        card: 'bg-[#111726]/60 border-white/[0.06] hover:border-white/15',
        title: 'text-slate-300',
      }
    : isPendingApproval
    ? {
        label: 'Waiting on TC',
        chip: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
        node: 'bg-[#1d1a10] text-amber-400 border-amber-400',
        card: 'bg-[#111726] border-amber-400/40',
        title: 'text-white',
      }
    : isCurrent
    ? {
        label: 'Up next',
        chip: 'bg-amber-400 text-slate-950 border-amber-400',
        node: 'bg-amber-400 text-slate-950 border-amber-400',
        card: 'bg-[#131b2d] border-amber-400/50 shadow-[0_0_0_4px_rgba(245,158,11,0.06)]',
        title: 'text-white',
      }
    : isLocked
    ? {
        label: 'Locked',
        chip: 'bg-white/[0.03] text-slate-500 border-white/10',
        node: 'bg-[#0d121f] text-slate-600 border-white/10',
        card: 'bg-[#111726]/40 border-white/[0.05]',
        title: 'text-slate-500',
      }
    : {
        label: 'Not started',
        chip: 'bg-white/[0.03] text-slate-400 border-white/10',
        node: 'bg-[#0d121f] text-slate-400 border-white/15 group-hover:border-amber-400/60',
        card: 'bg-[#111726] border-white/[0.08] hover:border-white/20',
        title: 'text-slate-200',
      };

  const showDescription = !!step.description && (!isCompleted || isExpanded);
  const stepNumber = step.order ?? '';

  return (
    <div id={`step-${step.id}`} className="relative flex gap-4 sm:gap-5 group scroll-mt-24">
      {/* Timeline rail */}
      <div className="relative flex flex-col items-center flex-shrink-0 w-8">
        <div
          className={`w-px h-5 ${isFirst ? 'opacity-0' : isCompleted ? 'bg-emerald-500/50' : 'bg-white/10'}`}
        />
        <button
          type="button"
          onClick={handleActionClick}
          aria-label={`${step.title}: ${state.label}`}
          className={`relative z-10 h-8 w-8 rounded-full border-2 flex items-center justify-center text-xs font-bold tabular-nums transition-colors duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${state.node}`}
        >
          {isCompleted ? (
            <Check className="h-4 w-4 stroke-[3]" />
          ) : isPendingApproval ? (
            <Clock className="h-4 w-4" />
          ) : isLocked ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            stepNumber
          )}
        </button>
        <div
          className={`w-px flex-1 ${isLast ? 'opacity-0' : isCompleted ? 'bg-emerald-500/50' : 'bg-white/10'}`}
        />
      </div>

      {/* Card */}
      <div
        className={`flex-1 min-w-0 mb-3 rounded-xl border transition-[border-color,background-color] duration-200 ${state.card}`}
      >
        {/* Header: whole row toggles details */}
        <button
          type="button"
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          className="w-full text-left px-4 sm:px-5 pt-3.5 pb-3 flex items-start justify-between gap-3 cursor-pointer"
        >
          <div className="min-w-0">
            {isCurrent && (
              <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-amber-400 mb-1">
                Current step
              </span>
            )}
            <h3 className={`text-sm sm:text-[15px] font-semibold leading-snug ${state.title}`}>
              {step.title}
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {step.date && !isEditingDate && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 font-mono tabular-nums">
                <Calendar className="h-3 w-3" />
                {formatDate(step.date)}
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${state.chip}`}
            >
              {state.label}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            />
          </div>
        </button>

        <div className="px-4 sm:px-5 pb-4">
          {showDescription && (
            <p className="text-xs sm:text-[13px] text-slate-400 leading-relaxed max-w-[68ch]">
              {step.description}
            </p>
          )}

          {/* Pending TC approval */}
          {isPendingApproval && step.approvalData && (
            <div className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-amber-300">
                  Submitted by {step.approvalData.submittedByName || 'agent'}
                </span>
                <span className="text-slate-400 tabular-nums">
                  {step.approvalData.submittedAt
                    ? new Date(step.approvalData.submittedAt).toLocaleDateString('en-US')
                    : 'Recently'}
                  {' · '}TC: {step.approvalData.assignedTcName || 'Assigned TC'}
                </span>
              </div>
              {step.approvalData.details && (
                <div className="rounded-md bg-[#090d16] border border-white/[0.06] p-2.5 text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {step.approvalData.details}
                </div>
              )}
            </div>
          )}

          {/* Expanded detail */}
          {isExpanded && (
            <div className="mt-3 flex items-start gap-2.5 rounded-lg bg-[#0d121f] border border-white/[0.06] p-3">
              <ShieldCheck className="h-4 w-4 text-sky-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Monitored by MSREG Operations. Paperwork, signatures and title updates for this step
                are verified by your assigned TC.
                {step.updatedAt && (
                  <span className="block mt-1 text-slate-500 tabular-nums">Last updated {step.updatedAt}</span>
                )}
              </p>
            </div>
          )}

          {/* Action row */}
          <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
            {isEditingDate ? (
              <form onSubmit={handleDateSave} className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  autoFocus
                  className="bg-[#090d16] border border-white/15 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-400 [color-scheme:dark]"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-lg transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingDate(false)}
                  className="px-2 py-1.5 text-slate-400 hover:text-white text-xs transition-colors"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingDate(true)}
                className="inline-flex items-center gap-1.5 px-2 py-1 -ml-2 rounded-md text-[11px] text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Calendar className="h-3.5 w-3.5" />
                {step.date ? (
                  <span className="font-mono tabular-nums">{formatDate(step.date)}</span>
                ) : (
                  <span>Set date</span>
                )}
              </button>
            )}

            <div className="flex items-center gap-2">
              {isPendingApproval ? (
                isOpsOrTc ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onRequestApproval?.(step)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
                    >
                      Review
                    </button>
                    <button
                      type="button"
                      onClick={() => (onApproveByTc ? onApproveByTc(step.id) : onRequestApproval?.(step))}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors"
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                      Approve
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRequestApproval?.(step)}
                    className="px-3 py-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 rounded-lg transition-colors"
                  >
                    View submission
                  </button>
                )
              ) : isCompleted ? (
                <button
                  type="button"
                  onClick={handleActionClick}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-200 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Reopen
                </button>
              ) : !isLocked ? (
                <button
                  type="button"
                  onClick={handleActionClick}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors active:scale-[0.98] ${
                    isCurrent
                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                      : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10'
                  }`}
                >
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                  Mark done
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
