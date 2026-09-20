import React, { useState } from 'react';
import { OpsMilestone, MILESTONE_ORDER } from '../types/ops';
import { Check, Clock, AlertCircle, Sparkles, Minus } from 'lucide-react';

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
        return 'bg-emerald-500 text-[#0f172a] border-emerald-400';
      case 'notice_sent':
      case 'ordered':
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
        let m = milestoneMap.get(item.type);
        if (item.type === 'inspection_10day' && (!m || m.status === 'pending')) {
          const alt = milestoneMap.get('inspection_ordered') || milestoneMap.get('inspection_notice_sent');
          if (alt && (alt.status === 'complete' || alt.status === 'satisfied')) {
            m = alt;
          }
        }
        if (item.type === 'appraisal_satisfied' && (!m || m.status === 'pending')) {
          const alt = milestoneMap.get('appraisal_received') || milestoneMap.get('appraisal_ordered');
          if (alt && (alt.status === 'complete' || alt.status === 'satisfied')) {
            m = alt;
          }
        }
        const status = m?.status || 'pending';
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
                if (m && onMilestoneClick) {
                  e.stopPropagation();
                  onMilestoneClick(m);
                }
              }}
              className={`h-5 px-1.5 rounded-full border text-[9px] font-mono-code font-bold flex items-center justify-center cursor-pointer transition-all hover:scale-110 ${getStatusColor(
                status
              )}`}
              title={`${item.label}: ${status.toUpperCase()}`}
            >
              <span>{item.shortLabel}</span>
            </div>

            {/* Connecting line between dots (except last) */}
            {idx < MILESTONE_ORDER.length - 1 && (
              <div className="w-1.5 h-0.5 bg-[#334155] flex-shrink-0" />
            )}

            {/* Hover Tooltip */}
            {isHovered && m && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 w-48 p-2.5 bg-[#131826] border border-[#334155] rounded-xl shadow-2xl text-[11px] pointer-events-none space-y-1.5 backdrop-blur-md">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-[#f8fafc] truncate">{item.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border ${
                      m.source === 'sisu'
                        ? 'bg-slate-700/60 text-slate-300 border-slate-600'
                        : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                    }`}
                  >
                    {m.source === 'sisu' ? 'Sisu' : 'Manual'}
                  </span>
                </div>

                <div className="text-[#94a3b8] space-y-0.5">
                  <div>
                    Status: <strong className="text-[#f8fafc] uppercase">{m.status}</strong>
                  </div>
                  {m.target_date && <div>Target: {m.target_date}</div>}
                  {m.actual_date && <div className="text-emerald-400">Actual: {m.actual_date}</div>}
                  {m.notes && <p className="italic text-[10px] text-slate-400 pt-0.5">{m.notes}</p>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
