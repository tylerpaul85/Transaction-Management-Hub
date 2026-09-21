import React, { useState } from 'react';
import { OpsMilestone, MILESTONE_ORDER, ALL_MILESTONES_CONFIG } from '../types/ops';

interface MilestoneDotSequenceProps {
  milestones: OpsMilestone[];
  onMilestoneClick?: (milestone: OpsMilestone) => void;
}

export const MilestoneDotSequence: React.FC<MilestoneDotSequenceProps> = ({
  milestones,
  onMilestoneClick,
}) => {
  const [hoveredType, setHoveredType] = useState<string | null>(null);

  const milestoneMap = new Map<string, OpsMilestone>();
  milestones.forEach((m) => milestoneMap.set(m.milestone_type, m));

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'satisfied':
      case 'complete':
        return 'bg-emerald-500 text-[#0f172a] border-emerald-400 shadow-sm shadow-emerald-500/20';
      case 'in_progress':
      case 'ordered':
      case 'notice_sent':
        return 'bg-sky-500 text-[#0f172a] border-sky-400';
      case 'pending':
        return 'bg-amber-500/80 text-[#0f172a] border-amber-400';
      case 'waived':
        return 'bg-indigo-500 text-white border-indigo-400';
      case 'na':
        return 'bg-[#1e293b] text-[#94a3b8] border-[#334155] opacity-50';
      default:
        return 'bg-[#334155] text-[#94a3b8] border-[#2a354c]';
    }
  };

  return (
    <div className="flex items-center gap-1.5 py-1">
      {MILESTONE_ORDER.map((item, idx) => {
        let displayStatus = 'pending';
        let subItemsStatus: { label: string; done: boolean; milestone?: OpsMilestone }[] = [];
        let primaryMilestone = milestoneMap.get(item.type);

        if (item.subTypes && item.subTypes.length > 0) {
          const subMilestones = item.subTypes.map((st) => ({
            type: st,
            milestone: milestoneMap.get(st),
            isDone: Boolean(
              milestoneMap.get(st)?.status === 'complete' ||
              milestoneMap.get(st)?.status === 'satisfied'
            ),
          }));

          const allDone = subMilestones.every((sm) => sm.isDone);
          const anyDone = subMilestones.some((sm) => sm.isDone);

          // Turns green ONLY when ALL required sub-conditions are satisfied
          if (allDone) {
            displayStatus = 'complete';
          } else if (anyDone) {
            displayStatus = 'in_progress';
          } else {
            displayStatus = 'pending';
          }

          subItemsStatus = subMilestones.map((sm) => {
            const conf = ALL_MILESTONES_CONFIG.find((c) => c.type === sm.type);
            return {
              label: conf?.label || sm.type,
              done: sm.isDone,
              milestone: sm.milestone,
            };
          });

          // Primary milestone to open when clicked is the first pending sub-item, or the first sub-item
          const pendingSub = subMilestones.find((sm) => !sm.isDone);
          primaryMilestone = pendingSub?.milestone || subMilestones[0]?.milestone || primaryMilestone;
        } else {
          displayStatus = primaryMilestone?.status || 'pending';
        }

        const isHovered = hoveredType === item.type;

        return (
          <div
            key={item.type}
            className="relative flex items-center"
            onMouseEnter={() => setHoveredType(item.type)}
            onMouseLeave={() => setHoveredType(null)}
          >
            {/* Step Dot Badge */}
            <div
              onClick={(e) => {
                if (primaryMilestone && onMilestoneClick) {
                  e.stopPropagation();
                  onMilestoneClick(primaryMilestone);
                }
              }}
              className={`h-5 px-1.5 rounded-full border text-[9px] font-mono-code font-bold flex items-center justify-center cursor-pointer transition-all hover:scale-110 ${getStatusColor(
                displayStatus
              )}`}
              title={`${item.label}: ${displayStatus.toUpperCase()}`}
            >
              <span>{item.shortLabel}</span>
              {displayStatus === 'in_progress' && (
                <span className="ml-0.5 text-[8px] opacity-85">½</span>
              )}
            </div>

            {/* Connecting line between dots (except last) */}
            {idx < MILESTONE_ORDER.length - 1 && (
              <div className="w-1.5 h-0.5 bg-[#334155] flex-shrink-0" />
            )}

            {/* Hover Tooltip */}
            {isHovered && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 w-52 p-2.5 bg-[#131826] border border-[#334155] rounded-xl shadow-2xl text-[11px] pointer-events-none space-y-1.5 backdrop-blur-md">
                <div className="flex items-center justify-between gap-1 border-b border-[#334155]/60 pb-1.5">
                  <span className="font-bold text-[#f8fafc] truncate">{item.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${
                      displayStatus === 'complete'
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        : displayStatus === 'in_progress'
                        ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {displayStatus === 'complete'
                      ? 'Satisfied'
                      : displayStatus === 'in_progress'
                      ? 'In Progress'
                      : 'Pending'}
                  </span>
                </div>

                {subItemsStatus.length > 0 ? (
                  <div className="space-y-1.5 pt-0.5">
                    {subItemsStatus.map((sub, sIdx) => (
                      <div key={sIdx} className="flex items-center justify-between text-[10px]">
                        <span className="text-[#cbd5e1] truncate pr-1">{sub.label}</span>
                        {sub.done ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-0.5 flex-shrink-0">
                            ✓ Done
                          </span>
                        ) : (
                          <span className="text-amber-400/90 font-medium flex-shrink-0">
                            Pending
                          </span>
                        )}
                      </div>
                    ))}
                    <div className="text-[9px] text-[#fbbf24] pt-0.5 italic border-t border-[#334155]/40">
                      *Both conditions required to turn green
                    </div>
                  </div>
                ) : (
                  <div className="text-[#94a3b8] space-y-0.5">
                    <div>
                      Status: <strong className="text-[#f8fafc] uppercase">{displayStatus}</strong>
                    </div>
                    {primaryMilestone?.target_date && <div>Target: {primaryMilestone.target_date}</div>}
                    {primaryMilestone?.actual_date && (
                      <div className="text-emerald-400">Actual: {primaryMilestone.actual_date}</div>
                    )}
                    {primaryMilestone?.notes && (
                      <p className="italic text-[10px] text-slate-400 pt-0.5">
                        {primaryMilestone.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
