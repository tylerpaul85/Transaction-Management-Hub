import React, { useState } from 'react';
import {
  Shield,
  Award,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  TrendingUp,
  Percent,
  DollarSign,
  Gift,
  X,
  Loader2,
  Check,
  ChevronRight,
  AlertCircle,
  Edit3
} from 'lucide-react';
import { AGENT_LEVELS, AgentLevelTier, getAgentLevelConfig } from '../data/agentLevels';
import { supabase } from '../integrations/supabase/client';

interface AgentLevelModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  currentLevel: number;
  canEdit: boolean;
  onLevelUpdated?: (newLevel: number) => void;
}

export const AgentLevelModal: React.FC<AgentLevelModalProps> = ({
  isOpen,
  onClose,
  agentId,
  agentName,
  currentLevel,
  canEdit,
  onLevelUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'benefits' | 'ladder' | 'admin'>('benefits');
  const [selectedLadderLevel, setSelectedLadderLevel] = useState<number>(currentLevel || 1);
  const [adminSelectedLevel, setAdminSelectedLevel] = useState<number>(currentLevel || 1);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentConfig = getAgentLevelConfig(currentLevel);
  const viewedLadderConfig = getAgentLevelConfig(selectedLadderLevel);

  const handleSaveLevel = async () => {
    if (!agentId) {
      setErrorMsg('No agent ID found to update.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      // 1. Update agents table
      const { error: agErr } = await (supabase.from('agents') as any)
        .update({
          level: adminSelectedLevel,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agentId);

      if (agErr) throw agErr;

      // 2. Also update profiles table if linked
      await (supabase.from('profiles') as any)
        .update({
          level: adminSelectedLevel,
          updated_at: new Date().toISOString(),
        })
        .eq('agent_id', agentId);

      setSaveSuccess(true);
      if (onLevelUpdated) {
        onLevelUpdated(adminSelectedLevel);
      }
      setTimeout(() => {
        setSaveSuccess(false);
        setActiveTab('benefits');
      }, 1200);
    } catch (err: any) {
      console.error('Error updating agent level:', err);
      setErrorMsg(err.message || 'Failed to update agent level.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className={`p-6 border-b border-white/10 relative overflow-hidden ${currentConfig.badgeStyle.bg}`}>
          {/* Subtle glow background */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-start gap-4">
            <div
              className={`h-14 w-14 rounded-2xl flex items-center justify-center border shrink-0 ${currentConfig.badgeStyle.border} ${currentConfig.badgeStyle.pillBg} ${currentConfig.badgeStyle.glow}`}
            >
              <Award className={`h-7 w-7 ${currentConfig.badgeStyle.iconColor}`} />
            </div>

            <div className="space-y-1 min-w-0 pr-8">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  MSREG Agent Production Tier
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${currentConfig.badgeStyle.bg} ${currentConfig.badgeStyle.text} ${currentConfig.badgeStyle.border}`}
                >
                  Level {currentConfig.level}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white truncate">
                {agentName}
              </h2>
              <p className="text-xs text-slate-300 font-medium flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
                <span>Target: {currentConfig.closingsPerMonth}</span>
              </p>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-2 mt-5 pt-3 border-t border-white/10">
            <button
              onClick={() => setActiveTab('benefits')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'benefits'
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              My Tier Perks & Splits
            </button>
            <button
              onClick={() => setActiveTab('ladder')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ladder'
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              All Levels Progression (1–7)
            </button>
            {canEdit && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10'
                }`}
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Update Level (Admin)</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {/* TAB 1: Current Benefits */}
          {activeTab === 'benefits' && (
            <div className="space-y-6">
              {/* Commission Splits Matrix */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-[#162035]/70 border border-white/10 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Buyer Commission Split
                    </span>
                    <Percent className="h-4 w-4 text-sky-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-sky-400">
                      {currentConfig.commissionBuyer}
                    </span>
                    <span className="text-xs text-slate-400">Buyer Side Rep</span>
                  </div>
                  <p className="text-[11px] text-amber-400/90 font-medium mt-1">
                    {currentConfig.legacyBonus}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#162035]/70 border border-white/10 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Seller Commission Split
                    </span>
                    <Percent className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-amber-400">
                      {currentConfig.commissionSeller}
                    </span>
                    <span className="text-xs text-slate-400">Listing / Seller Rep</span>
                  </div>
                  <p className="text-[11px] text-amber-400/90 font-medium mt-1">
                    {currentConfig.legacyBonus}
                  </p>
                </div>
              </div>

              {/* Special Bonuses / Unlocked Rewards */}
              {(currentConfig.swagCode || currentConfig.cashBonus) && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-transparent border border-amber-500/30 flex items-start gap-3">
                  <Gift className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Unlocked Tier Rewards
                    </h4>
                    {currentConfig.swagCode && (
                      <p className="text-xs text-amber-300">
                        Swag Store Credit Code:{' '}
                        <code className="px-2 py-0.5 rounded bg-black/40 font-mono font-bold text-amber-400 border border-amber-500/30">
                          {currentConfig.swagCode}
                        </code>
                      </p>
                    )}
                    {currentConfig.cashBonus && (
                      <p className="text-xs text-emerald-300 font-semibold">
                        {currentConfig.cashBonus}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Perks List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <span>Level {currentConfig.level} Unlocked Privileges & Systems</span>
                </h4>
                <div className="grid grid-cols-1 gap-2.5">
                  {currentConfig.perks.map((perk, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-[#162035]/40 border border-white/5 flex items-start gap-2.5"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-slate-200 leading-relaxed font-medium">
                        {perk}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Tier Teaser if not at max */}
              {currentConfig.level < 7 && (
                <div className="p-4 rounded-xl bg-[#162035]/40 border border-white/10 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Next Tier
                    </span>
                    <span className="text-xs font-bold text-white">
                      Level {currentConfig.level + 1}: {AGENT_LEVELS[currentConfig.level + 1].closingsPerMonth}
                    </span>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      Split increases to {AGENT_LEVELS[currentConfig.level + 1].commissionBuyer} buyer / {AGENT_LEVELS[currentConfig.level + 1].commissionSeller} seller
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedLadderLevel(currentConfig.level + 1);
                      setActiveTab('ladder');
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <span>View Level {currentConfig.level + 1}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Full Progression Ladder (1–7) */}
          {activeTab === 'ladder' && (
            <div className="space-y-6">
              {/* Level Selector Pills */}
              <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#162035]/60 rounded-xl border border-white/10">
                {[1, 2, 3, 4, 5, 6, 7].map((lvl) => {
                  const isCurrent = currentLevel === lvl;
                  const isSelected = selectedLadderLevel === lvl;
                  return (
                    <button
                      key={lvl}
                      onClick={() => setSelectedLadderLevel(lvl)}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all flex flex-col items-center cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                          : isCurrent
                          ? 'bg-white/10 text-white border border-white/20'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span className="text-xs">Level {lvl}</span>
                      {isCurrent && (
                        <span className="text-[9px] uppercase tracking-wider font-extrabold opacity-80">
                          Current
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Viewed Level Details Card */}
              <div className={`p-5 rounded-2xl border ${viewedLadderConfig.badgeStyle.border} ${viewedLadderConfig.badgeStyle.bg} space-y-4`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                      Production Requirement
                    </span>
                    <h3 className="text-lg font-black text-white">
                      {viewedLadderConfig.name}
                    </h3>
                    <p className="text-xs text-amber-300 font-semibold mt-0.5">
                      {viewedLadderConfig.closingsPerMonth}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Commission Split
                    </span>
                    <span className="text-base font-black text-white">
                      {viewedLadderConfig.commissionBuyer} Buyer / {viewedLadderConfig.commissionSeller} Seller
                    </span>
                    <span className="text-[10px] text-amber-400 block">
                      {viewedLadderConfig.legacyBonus}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-white/10">
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Tier Privileges & Rewards
                  </h5>
                  <ul className="space-y-2">
                    {viewedLadderConfig.perks.map((perk, idx) => (
                      <li key={idx} className="text-xs text-slate-200 flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Admin Level Update */}
          {activeTab === 'admin' && canEdit && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-300 space-y-1">
                  <p className="font-bold text-amber-200">
                    Admin / Operations Level Adjustment
                  </p>
                  <p>
                    Updating the agent level here immediately updates their profile across all systems and adjusts the level badge shown in their workspace banner.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Select New Level for {agentName}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[1, 2, 3, 4, 5, 6, 7].map((lvl) => {
                    const cfg = AGENT_LEVELS[lvl];
                    const isSelected = adminSelectedLevel === lvl;
                    const isCurrent = currentLevel === lvl;

                    return (
                      <div
                        key={lvl}
                        onClick={() => setAdminSelectedLevel(lvl)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg shadow-amber-500/15'
                            : 'bg-[#162035]/60 border-white/10 text-slate-300 hover:bg-[#162035] hover:border-white/20'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black">Level {lvl}</span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-white/10 text-slate-400 border border-white/10">
                                Current
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 block">
                            {cfg.closingsPerMonth}
                          </span>
                          <span className="text-[10px] text-amber-400 font-medium block">
                            {cfg.commissionBuyer} Buyer • {cfg.commissionSeller} Seller
                          </span>
                        </div>

                        <div
                          className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? 'border-amber-400 bg-amber-400 text-slate-950'
                              : 'border-slate-600 bg-slate-800'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {saveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Successfully updated {agentName} to Level {adminSelectedLevel}!</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveLevel}
                  disabled={saving || adminSelectedLevel === currentLevel}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Save Level {adminSelectedLevel}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Official Footnotes from Page 4 */}
          <div className="pt-4 border-t border-white/10 space-y-1 text-[10px] text-slate-500">
            <p>*All terms above are subject to be changed by the company without advanced notice.</p>
            <p>*Must meet GCI based on avg sales price of the team in that market.</p>
            <p>*Qualifying closing amounts are calculated based on the agent's primary side (buyer or listing).</p>
          </div>
        </div>
      </div>
    </div>
  );
};
