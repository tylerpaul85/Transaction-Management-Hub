import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface LowSampleBadgeProps {
  dealCount?: number;
  className?: string;
}

export const LowSampleBadge: React.FC<LowSampleBadgeProps> = ({ dealCount, className = '' }) => {
  return (
    <span
      title={
        dealCount !== undefined
          ? `Sample size is only ${dealCount} deal${dealCount === 1 ? '' : 's'}. Metrics based on fewer than 5 deals should be interpreted cautiously.`
          : 'Low sample size (< 5 deals). Interpreted with caution.'
      }
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 whitespace-nowrap ${className}`}
    >
      <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" />
      <span>Low Sample {dealCount !== undefined ? `(${dealCount})` : '(<5)'}</span>
    </span>
  );
};
