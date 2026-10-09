import React, { useState } from 'react';
import { OpsMilestone, getMilestoneOrder, getAllMilestonesConfig } from '../types/ops';
import { Check, Clock, Minus, Circle } from 'lucide-react';

interface MilestoneDotSequenceProps {
  milestones: OpsMilestone[];
  side?: 'buyer' | 'seller' | 'dual' | string;
  onMilestoneClick?: (milestone: OpsMilestone) => void;
}

export const MilestoneDotSequence: React.FC<MilestoneDotSequenceProps> = ({
  milestones,
  side = 'buyer',
  onMilestoneClick,
}) => {
  const [hoveredType, setHoveredType] = useState<string | null>(null);

  const milestoneOrder = getMilestoneOrder(side);
  const allConfigs = getAllMilestonesConfig(side);

  const milestoneMap = new Map<string, OpsMilestone>();
  milestones.forEach((m) => milestoneMap.set(m.milestone_type, m));

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'complete':
      case 'satisfied':
        return {
          pill: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25 shadow-sm shadow-emerald-500/10',
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          label: 'Complete',
          icon: <Check className="w-2.5 h-2.5 flex-shrink-0 text-emerald-400 stroke-[3]" />,
        };
      case 'pending_tc_approval':
        return {
          pill: 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 shadow-sm shadow-amber-500/20 animate-pulse',
          badge: 'bg-amber-500/25 text-amber-300 border-amber-500/50',
          label: 'Pending TC',
          icon: <Clock className="w-2.5 h-2.5 flex-shrink-0 text-amber-400 animate-pulse" />,
        };
      case 'in_progress':
      case 'ordered':
      case 'notice_sent':
        return {
          pill: 'bg-sky-500/15 text-sky-400 border-sky-500/40 hover:bg-sky-500/25 shadow-sm shadow-sky-500/15',
          badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
          label: 'In Progress',
          icon: <Clock className="w-2.5 h-2.5 flex-shrink-0 text-sky-400 animate-pulse" />,
        };
      case 'na':
      case 'waived':
        return {
          pill: 'bg-[#111726] text-slate-500 border-slate-700/50 line-through opacity-55 hover:opacity-80',
          badge: 'bg-slate-800 text-slate-400 border-slate-700',
          label: 'N/A',
          icon: <Minus className="w-2.5 h-2.5 flex-shrink-0 text-slate-500" />,
        };
      case 'pending':
      default:
        return {
          pill: 'bg-[#0d121f]/90 text-slate-400 border-white/10 hover:border-amber-400/50 hover:text-slate-200',
          badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          label: 'Pending',
          icon: <Circle className="w-2 h-2 flex-shrink-0 text-slate-500" />,
        };
    }
  };

  const resolveEffectiveStatus = (m?: OpsMilestone) => {
    if (!m) return 'pending';
    if (m.notes && m.notes.includes('"pending_tc_approval"')) {
      return 'pending_tc_approval';
    }
    return m.status || 'pending';
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1">
      {milestoneOrder.map((item) => {
        let displayStatus = 'pending';
        let subItemsStatus: { label: string; status: string; milestone?: OpsMilestone }[] = [];
        let primaryMilestone = milestoneMap.get(item.type);

        if (item.subTypes && item.subTypes.length > 0) {
          const subMilestones = item.subTypes.map((st) => {
            const m = milestoneMap.get(st);
            const status = resolveEffectiveStatus(m);
            return {
              type: st,
              milestone: m,
              status,
              isDone: status === 'complete' || status === 'satisfied',
              isPendingApproval: status === 'pending_tc_approval',
              isInProgress: status === 'in_progress' || status === 'ordered' || status === 'notice_sent',
              isNa: status === 'na' || status === 'waived',
            };
          });

          const activeSub = subMilestones.filter((sm) => !sm.isNa);
          const allDone = activeSub.length > 0 && activeSub.every((sm) => sm.isDone);
          const anyPendingApproval = subMilestones.some((sm) => sm.isPendingApproval);
          const anyInProgress = subMilestones.some((sm) => sm.isInProgress || sm.isDone);
          const allNa = subMilestones.every((sm) => sm.isNa);

          if (allDone) {
            displayStatus = 'complete';
          } else if (anyPendingApproval) {
            displayStatus = 'pending_tc_approval';
          } else if (allNa) {
            displayStatus = 'na';
          } else if (anyInProgress) {
            displayStatus = 'in_progress';
          } else {
            displayStatus = 'pending';
          }

          subItemsStatus = subMilestones.map((sm) => {
            const conf = allConfigs.find((c) => c.type === sm.type);
            return {
              label: conf?.label || sm.type,
              status: sm.status,
              milestone: sm.milestone,
            };
          });

          // Primary milestone to open when clicked is the first active pending/in-progress sub-item
          const nextActionableSub = subMilestones.find((sm) => !sm.isDone && !sm.isNa);
          primaryMilestone = nextActionableSub?.milestone || subMilestones[0]?.milestone || primaryMilestone;
        } else {
          displayStatus = resolveEffectiveStatus(primaryMilestone);
        }

        const styles = getStatusStyles(displayStatus);
        const isHovered = hoveredType === item.type;

        return (
          <div
            key={item.type}
            className="relative"
            onMouseEnter={() => setHoveredType(item.type)}
            onMouseLeave={() => setHoveredType(null)}
          >
            {/* Full-word Milestone Pill Badge */}
            <button
              type="button"
              onClick={(e) => {
                if (primaryMilestone && onMilestoneClick) {
                  e.stopPropagation();
                  onMilestoneClick(primaryMilestone);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-all duration-150 cursor-pointer ${styles.pill}`}
              title={`${item.label}: ${styles.label}`}
            >
              {styles.icon}
              <span className="tracking-tight whitespace-nowrap">{item.shortLabel || item.label}</span>
            </button>

            {/* Hover Tooltip Popover */}
            {isHovered && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 w-60 p-3 bg-[#0d121f] border border-white/10 rounded-xl shadow-2xl text-xs pointer-events-none space-y-2 backdrop-blur-md">
                <div className="flex items-center justify-between gap-1 border-b border-white/10 pb-1.5">
                  <span className="font-bold text-slate-100 truncate">{item.label}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${styles.badge}`}>
                    {styles.label}
                  </span>
                </div>

                {subItemsStatus.length > 0 ? (
                  <div className="space-y-1.5 pt-0.5">
                    {subItemsStatus.map((sub, sIdx) => {
                      const subStyle = getStatusStyles(sub.status);
                      return (
                        <div key={sIdx} className="flex items-center justify-between text-[11px] gap-2">
                          <span className={`truncate ${sub.status === 'na' ? 'text-slate-500 line-through' : 'text-[#cbd5e1]'}`}>
                            {sub.label}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${subStyle.badge}`}>
                            {subStyle.icon}
                            {subStyle.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-slate-400 space-y-1 text-[11px]">
                    <div>
                      Status: <strong className="text-slate-100 uppercase">{styles.label}</strong>
                    </div>
                    {primaryMilestone?.target_date && <div>Target: {primaryMilestone.target_date}</div>}
                    {primaryMilestone?.actual_date && (
                      <div className="text-emerald-400">Actual: {primaryMilestone.actual_date}</div>
                    )}
                    {primaryMilestone?.notes && (
                      <p className="italic text-[10px] text-slate-400 pt-0.5 border-t border-white/10 mt-1">
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
