import React, { useState } from 'react';
import { HubRoadmapStep, StepStatus } from '../../types/hub';
import { Check, Clock, Lock, Sparkles, ChevronDown, ChevronUp, Calendar, AlertCircle } from 'lucide-react';

interface RoadmapStepCardProps {
  step: HubRoadmapStep;
  isFirst: boolean;
  isLast: boolean;
  isActive?: boolean;
  onToggleStatus?: (stepId: string) => void;
  onDateChange?: (stepId: string, newDate: string) => void;
}

export const RoadmapStepCard: React.FC<RoadmapStepCardProps> = ({
  step,
  isFirst,
  isLast,
  isActive = false,
  onToggleStatus,
  onDateChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [dateInput, setDateInput] = useState(step.date || '');

  const isCompleted = step.status === 'completed';
  const isInProgress = step.status === 'in_progress';
  const isLocked = step.status === 'locked';

  const handleDateSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (onDateChange) {
      onDateChange(step.id, dateInput);
    }
    setIsEditingDate(false);
  };

  return (
    <div className="relative flex items-start gap-4 sm:gap-6 group">
      {/* Vertical Connecting Timeline Track */}
      <div className="relative flex flex-col items-center flex-shrink-0 self-stretch">
        {/* Upper connecting line */}
        <div
          className={`w-[2px] flex-grow transition-colors duration-300 ${
            isFirst
              ? 'opacity-0'
              : isCompleted
              ? 'bg-gradient-to-b from-emerald-500 to-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
              : 'bg-slate-700/50'
          }`}
          style={{ height: '24px' }}
        />

        {/* Node Circle */}
        <button
          type="button"
          onClick={() => onToggleStatus && onToggleStatus(step.id)}
          title={isCompleted ? 'Completed (Click to change)' : 'Click to mark complete'}
          className={`relative z-10 flex items-center justify-center rounded-full transition-all duration-300 cursor-pointer shadow-md ${
            isCompleted
              ? 'h-7 w-7 bg-emerald-500 text-slate-950 ring-4 ring-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
              : isInProgress
              ? 'h-7 w-7 bg-amber-500 text-slate-950 ring-4 ring-amber-500/20 animate-pulse'
              : isLocked
              ? 'h-6 w-6 bg-slate-800 text-slate-500 border border-slate-700'
              : 'h-6 w-6 bg-slate-800 border-2 border-slate-600 text-slate-400 hover:border-emerald-400 hover:bg-slate-700'
          }`}
        >
          {isCompleted ? (
            <Check className="h-4 w-4 stroke-[3]" />
          ) : isInProgress ? (
            <Clock className="h-3.5 w-3.5 stroke-[2.5]" />
          ) : isLocked ? (
            <Lock className="h-3 w-3" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-slate-500 group-hover:bg-emerald-400 transition-colors" />
          )}
        </button>

        {/* Lower connecting line */}
        <div
          className={`w-[2px] flex-grow transition-colors duration-300 ${
            isLast
              ? 'opacity-0'
              : isCompleted
              ? 'bg-emerald-500/80'
              : 'bg-slate-700/50'
          }`}
        />
      </div>

      {/* Main Step Card Container */}
      <div
        className={`flex-1 mb-4 rounded-2xl transition-all duration-200 border ${
          isActive
            ? 'bg-[#0f2136] border-[#0284c7]/60 shadow-[0_0_24px_rgba(2,132,199,0.15)] ring-1 ring-[#0284c7]/40'
            : isCompleted
            ? 'bg-[#0e1726]/90 border-slate-800/90 hover:border-slate-700 hover:bg-[#111c2e]'
            : 'bg-[#0c1421]/70 border-slate-800/60 hover:border-slate-700/80 hover:bg-[#0e1726]'
        }`}
      >
        <div className="p-4 sm:p-5">
          {/* Header Row: Title & Status Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                onClick={() => setIsExpanded(!isExpanded)}
                className={`font-semibold text-sm sm:text-base leading-snug cursor-pointer transition-colors ${
                  isCompleted
                    ? 'text-slate-100 hover:text-emerald-300'
                    : isActive
                    ? 'text-sky-200 font-bold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {step.title}
              </h3>
            </div>

            {/* Status Pill Badge */}
            <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
              <span
                onClick={() => onToggleStatus && onToggleStatus(step.id)}
                className={`cursor-pointer px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wide transition-all uppercase ${
                  isCompleted
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                    : isInProgress
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25'
                    : isLocked
                    ? 'bg-slate-800 text-slate-500 border border-slate-700'
                    : 'bg-slate-800/90 text-slate-400 border border-slate-700 hover:border-emerald-500/40 hover:text-emerald-400'
                }`}
              >
                {step.status}
              </span>
            </div>
          </div>

          {/* Description Content */}
          {step.description && (
            <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed font-normal">
              {step.description}
            </p>
          )}

          {/* Bottom Timestamp & Action Controls Row */}
          <div className="mt-3.5 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 text-slate-400">
              {step.updatedAt && (
                <span className="text-[11px] text-slate-400 font-mono-code flex items-center gap-1.5">
                  <span className="text-slate-400">Updated •</span>
                  <span className="text-slate-300 font-medium">{step.updatedAt}</span>
                </span>
              )}

              {/* Date display or editor */}
              {isEditingDate ? (
                <form onSubmit={handleDateSave} className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={dateInput}
                    onChange={(e) => setDateInput(e.target.value)}
                    className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingDate(false)}
                    className="px-2 py-1 text-slate-400 hover:text-white text-xs"
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingDate(true)}
                  className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-sky-300 transition-colors cursor-pointer group/date"
                  title="Click to edit date"
                >
                  <Calendar className="h-3.5 w-3.5 text-slate-400 group-hover/date:text-sky-400" />
                  <span>
                    {step.date ? (
                      <span className="font-mono-code text-slate-300 font-medium">{step.date}</span>
                    ) : (
                      <span className="text-slate-400 italic">No date set</span>
                    )}
                  </span>
                </button>
              )}
            </div>

            {/* Quick expand details / actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onToggleStatus && onToggleStatus(step.id)}
                className={`text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors ${
                  isCompleted
                    ? 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
                    : 'text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                {isCompleted ? 'Mark Pending' : 'Mark Done'}
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title={isExpanded ? 'Collapse notes' : 'Expand notes'}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Expanded Notes & TC Activity Section */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 bg-slate-900/60 rounded-xl p-3 text-xs text-slate-300 space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                  Transaction Coordinator Checkpoint
                </span>
                <span className="text-[10px] text-slate-400">Step #{step.order}</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                This milestone is monitored by the MSREG Operations team. Completed paperwork, client signatures, and title updates are synced real-time with Sisu and broker compliance logs.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
