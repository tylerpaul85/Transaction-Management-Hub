export interface AgentLevelTier {
  level: number;
  name: string;
  closingsPerMonth: string;
  commissionBuyer: string;
  commissionSeller: string;
  legacyBonus: string;
  perks: string[];
  swagCode?: string;
  cashBonus?: string;
  badgeStyle: {
    bg: string;
    text: string;
    border: string;
    glow: string;
    pillBg: string;
    iconColor: string;
  };
}

export const AGENT_LEVELS: Record<number, AgentLevelTier> = {
  1: {
    level: 1,
    name: 'Level 1 Specialist',
    closingsPerMonth: '0 - 1 closings/month',
    commissionBuyer: '45%',
    commissionSeller: '30%',
    legacyBonus: '+10% for Legacy Agent',
    perks: [
      'MSREG team training & continuous coaching',
      'MSREG open house participation & host priority',
      'MSREG role play & sales objection workshops',
      'Access to CRM and core company tech stack',
      'ISA appointments possible',
      'Access to Zillow, Opcity, Realtor.com, Homelight leads, Realty.com & ezHome Search',
      'Access to duty day floor opportunities',
    ],
    badgeStyle: {
      bg: 'bg-slate-800/80',
      text: 'text-slate-200',
      border: 'border-slate-700/80',
      glow: 'shadow-[0_0_12px_rgba(148,163,184,0.15)]',
      pillBg: 'bg-slate-700/60',
      iconColor: 'text-slate-400',
    },
  },
  2: {
    level: 2,
    name: 'Level 2 Specialist',
    closingsPerMonth: '1.1 - 2 closings/month',
    commissionBuyer: '45%',
    commissionSeller: '30%',
    legacyBonus: '+10% for Legacy Agent',
    swagCode: 'agentlevel2',
    perks: [
      '$100 swag store credit (Promo code: agentlevel2)',
      'Enhanced inbound lead flow opportunities',
      'Direct access to Stocked Pond pipeline',
      'All Level 1 team systems, training & duty day benefits',
    ],
    badgeStyle: {
      bg: 'bg-sky-950/70',
      text: 'text-sky-300',
      border: 'border-sky-500/40',
      glow: 'shadow-[0_0_15px_rgba(56,189,248,0.25)]',
      pillBg: 'bg-sky-500/20',
      iconColor: 'text-sky-400',
    },
  },
  3: {
    level: 3,
    name: 'Level 3 Specialist',
    closingsPerMonth: '2.1 - 3 closings/month',
    commissionBuyer: '45%',
    commissionSeller: '30%',
    legacyBonus: '+10% for Legacy Agent',
    cashBonus: '$250 fashion investment',
    perks: [
      '$250 executive fashion investment stipend',
      'Stocked Pond & enhanced lead opportunities',
      '$100 swag store credit unlocked',
      'All Level 1 & Level 2 team systems & training',
    ],
    badgeStyle: {
      bg: 'bg-emerald-950/70',
      text: 'text-emerald-300',
      border: 'border-emerald-500/40',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.25)]',
      pillBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
    },
  },
  4: {
    level: 4,
    name: 'Level 4 Senior Specialist',
    closingsPerMonth: '3.1 - 4.5 closings/month',
    commissionBuyer: '50%',
    commissionSeller: '35%',
    legacyBonus: '+10% for Legacy Agent',
    perks: [
      'Commission tier increase: 50% buyer side / 35% seller side (+10% Legacy)',
      'Priority ISA appointment distribution',
      'Advanced production coaching & leadership council eligibility',
    ],
    badgeStyle: {
      bg: 'bg-amber-950/70',
      text: 'text-amber-300',
      border: 'border-amber-500/50',
      glow: 'shadow-[0_0_18px_rgba(245,158,11,0.3)]',
      pillBg: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
    },
  },
  5: {
    level: 5,
    name: 'Level 5 Elite Specialist',
    closingsPerMonth: '4.6 - 5.5 closings/month',
    commissionBuyer: '55%',
    commissionSeller: '40%',
    legacyBonus: '+10% for Legacy Agent',
    perks: [
      'Commission tier increase: 55% buyer side / 40% seller side (+10% Legacy)',
      'Elite territory marketing & priority lead dispatch',
      'VIP mastermind access & leadership mentorship',
      'All Level 1-4 benefits, swag credits & fashion investments',
    ],
    badgeStyle: {
      bg: 'bg-purple-950/70',
      text: 'text-purple-300',
      border: 'border-purple-500/50',
      glow: 'shadow-[0_0_18px_rgba(168,85,247,0.35)]',
      pillBg: 'bg-purple-500/25',
      iconColor: 'text-purple-400',
    },
  },
  6: {
    level: 6,
    name: 'Level 6 Master Specialist',
    closingsPerMonth: '5.6 - 6.5 closings/month',
    commissionBuyer: '60%',
    commissionSeller: '45%',
    legacyBonus: '+10% for Legacy Agent',
    perks: [
      'Commission tier increase: 60% buyer side / 45% seller side (+10% Legacy)',
      'Premier executive branding & direct team referral routing',
      'Dedicated transaction coordination prioritization',
      'All Level 1-5 rewards, benefits & production incentives',
    ],
    badgeStyle: {
      bg: 'bg-rose-950/70',
      text: 'text-rose-300',
      border: 'border-rose-500/50',
      glow: 'shadow-[0_0_20px_rgba(244,63,94,0.35)]',
      pillBg: 'bg-rose-500/25',
      iconColor: 'text-rose-400',
    },
  },
  7: {
    level: 7,
    name: 'Level 7 Pinnacle Specialist',
    closingsPerMonth: '6.6+ closings/month',
    commissionBuyer: '65%',
    commissionSeller: '50%',
    legacyBonus: '+10% for Legacy Agent',
    perks: [
      'Top-tier commission: 65% buyer side / 50% seller side (+10% Legacy)',
      'Pinnacle team recognition & bespoke executive package',
      'First-call lead allocation & specialized production concierge',
      'All team incentives, store credits & fashion stipends',
    ],
    badgeStyle: {
      bg: 'bg-gradient-to-r from-amber-950/90 via-yellow-950/80 to-amber-950/90',
      text: 'text-amber-200',
      border: 'border-yellow-400/60',
      glow: 'shadow-[0_0_22px_rgba(250,204,21,0.4)]',
      pillBg: 'bg-yellow-500/25',
      iconColor: 'text-yellow-400',
    },
  },
};

export function getAgentLevelConfig(level?: number | null): AgentLevelTier {
  const lvl = Math.max(1, Math.min(7, Math.round(Number(level) || 1)));
  return AGENT_LEVELS[lvl] || AGENT_LEVELS[1];
}
