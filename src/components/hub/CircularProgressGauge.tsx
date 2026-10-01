import React from 'react';

interface CircularProgressGaugeProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}

export const CircularProgressGauge: React.FC<CircularProgressGaugeProps> = ({
  percentage,
  size = 110,
  strokeWidth = 9,
}) => {
  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedPercentage / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center select-none" style={{ width: size, height: size }}>
      {/* Ambient background glow */}
      <div
        className="absolute inset-2 rounded-full blur-xl pointer-events-none opacity-40 transition-all duration-700"
        style={{
          background: clampedPercentage === 100
            ? 'radial-gradient(circle, rgba(16,185,129,0.3) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(20,184,166,0.3) 0%, transparent 70%)',
        }}
      />

      <svg width={size} height={size} className="transform -rotate-90">
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
          <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1e293b"
          strokeWidth={strokeWidth}
          fill="#0b1320"
        />

        {/* Outer subtle ring border */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius + strokeWidth / 2 + 1}
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth="1"
          fill="none"
        />

        {/* Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#gaugeGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          filter="url(#gaugeGlow)"
          className="transition-all duration-1000 ease-out"
        />
      </svg>

      {/* Inner Label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono-code text-xl sm:text-2xl font-black text-white tracking-tight leading-none drop-shadow">
          {clampedPercentage}%
        </span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 mt-0.5">
          Complete
        </span>
      </div>
    </div>
  );
};
