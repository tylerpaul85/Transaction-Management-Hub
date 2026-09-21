import React, { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { OpsTransaction, OpsMilestone, ALL_MILESTONES_CONFIG } from '../types/ops';
import { MilestoneStatus, MilestoneSource } from '../types/database.types';
import {
  X,
  Building,
  CheckCircle2,
  Calendar,
  User,
  Users,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Flag,
  Save,
  Layers,
  Sparkles,
  Phone,
  Mail,
  RefreshCw,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';

interface OpsTransactionDetailModalProps {
  transaction: OpsTransaction;
  onClose: () => void;
  onSave: (updatedTx: OpsTransaction) => void;
}

export const OpsTransactionDetailModal: React.FC<OpsTransactionDetailModalProps> = ({
  transaction,
  onClose,
  onSave,
}) => {
  // Local edit states
  const [address, setAddress] = useState(transaction.property_address);
  const [city, setCity] = useState(transaction.city);
  const [status, setStatus] = useState(transaction.status);
  const [side, setSide] = useState(transaction.side);
  const [contractDate, setContractDate] = useState(transaction.contract_date || '');
  const [clientName, setClientName] = useState(transaction.client_name);
  const [clientPhone, setClientPhone] = useState(transaction.client_phone || '');
  const [clientEmail, setClientEmail] = useState(transaction.client_email || '');

  // Agent & TC Selection state
  const initialAgentId =
    transaction.side === 'seller'
      ? transaction.listing_agent_id || transaction.selling_agent_id
      : transaction.selling_agent_id || transaction.listing_agent_id;
  const [agentId, setAgentId] = useState<string | null>(initialAgentId || null);
  const [agentName, setAgentName] = useState<string>(transaction.agent_name || 'Lead Agent');
  const [agentEmail, setAgentEmail] = useState<string>(transaction.agent_email || '');

  const [tcId, setTcId] = useState<string | null>(transaction.assigned_tc_id || null);
  const [tcName, setTcName] = useState<string>(transaction.tc_name || 'Unassigned TC');
  const [tcEmail, setTcEmail] = useState<string>(transaction.tc_email || '');

  // Account Rosters from Supabase
  const [agentRoster, setAgentRoster] = useState<{ id: string; name: string; email: string }[]>([]);
  const [tcRoster, setTcRoster] = useState<{ id: string; name: string; email: string; role?: string }[]>([]);

  useEffect(() => {
    async function fetchRosters() {
      try {
        const { data: agentsData } = await (supabase
          .from('agents') as any)
          .select('id, name, email')
          .order('name', { ascending: true });
        if (agentsData && agentsData.length > 0) {
          setAgentRoster(agentsData as { id: string; name: string; email: string }[]);
          // If agentId is missing but agentName matches an agent in roster, resolve ID
          if (!agentId && transaction.agent_name) {
            const matched = (agentsData as any[]).find(
              (a) => a.name.toLowerCase() === transaction.agent_name.toLowerCase()
            );
            if (matched) {
              setAgentId(matched.id);
              setAgentEmail(matched.email);
            }
          }
        }

        const { data: tcData } = await (supabase
          .from('ops_users') as any)
          .select('id, name, email, role')
          .order('name', { ascending: true });
        if (tcData && tcData.length > 0) {
          setTcRoster(tcData as { id: string; name: string; email: string; role?: string }[]);
          if (!tcId && transaction.tc_name) {
            const matchedTc = (tcData as any[]).find(
              (t) => t.name.toLowerCase() === transaction.tc_name.toLowerCase()
            );
            if (matchedTc) {
              setTcId(matchedTc.id);
              setTcEmail(matchedTc.email);
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch agent/TC rosters:', err);
      }
    }
    fetchRosters();
  }, []);

  // Other Agent Info (always manual)
  const [otherPartyName, setOtherPartyName] = useState(transaction.other_party_name || '');
  const [otherPartyAgent, setOtherPartyAgent] = useState(transaction.other_party_agent || '');
  const [otherPartyPhone, setOtherPartyPhone] = useState(transaction.other_party_phone || '');
  const [otherPartyBrokerage, setOtherPartyBrokerage] = useState(
    transaction.other_party_brokerage || ''
  );

  // Friday Review Toggle
  const [flaggedForReview, setFlaggedForReview] = useState(transaction.flagged_for_review);

  // Milestones local state
  const [milestones, setMilestones] = useState<OpsMilestone[]>(() => {
    // Ensure all 13 standard milestones exist
    const map = new Map<string, OpsMilestone>();
    transaction.milestones.forEach((m) => map.set(m.milestone_type, m));

    return ALL_MILESTONES_CONFIG.map((cfg) => {
      const existing = map.get(cfg.type);
      if (existing) return existing;
      return {
        id: `m-new-${cfg.type}-${Date.now()}`,
        transaction_id: transaction.id,
        milestone_type: cfg.type,
        target_date: null,
        actual_date: null,
        status: 'pending' as MilestoneStatus,
        source: 'manual' as MilestoneSource,
        notes: null,
        updated_at: new Date().toISOString(),
      };
    });
  });

  // Re-sync milestones when parent transaction updates in real-time
  useEffect(() => {
    if (!transaction.milestones) return;
    const map = new Map<string, OpsMilestone>();
    transaction.milestones.forEach((m) => map.set(m.milestone_type, m));

    setMilestones((prev) =>
      ALL_MILESTONES_CONFIG.map((cfg) => {
        const remote = map.get(cfg.type);
        if (remote) return remote;
        const existingLocal = prev.find((p) => p.milestone_type === cfg.type);
        if (existingLocal) return existingLocal;
        return {
          id: `m-new-${cfg.type}-${Date.now()}`,
          transaction_id: transaction.id,
          milestone_type: cfg.type,
          target_date: null,
          actual_date: null,
          status: 'pending' as MilestoneStatus,
          source: 'manual' as MilestoneSource,
          notes: null,
          updated_at: new Date().toISOString(),
        };
      })
    );
  }, [transaction.milestones]);

  const [activeTab, setActiveTab] = useState<'sheet' | 'other_agent' | 'audit'>('sheet');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleMilestoneChange = (
    type: string,
    updates: Partial<Omit<OpsMilestone, 'id' | 'transaction_id' | 'milestone_type'>>
  ) => {
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.milestone_type !== type) return m;
        return {
          ...m,
          ...updates,
          source: updates.source ? updates.source : 'manual', // Any manual edit marks source='manual'
          updated_at: new Date().toISOString(),
        };
      })
    );
  };

  const handleToggleSource = (type: string) => {
    setMilestones((prev) =>
      prev.map((m) => {
        if (m.milestone_type !== type) return m;
        const nextSource: MilestoneSource = m.source === 'sisu' ? 'manual' : 'sisu';
        return {
          ...m,
          source: nextSource,
          updated_at: new Date().toISOString(),
        };
      })
    );
  };

  const isValidUuid = (str: string | null) =>
    Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

  const handleSaveAll = async () => {
    const validAgentId = isValidUuid(agentId) ? agentId : null;
    const validTcId = isValidUuid(tcId) ? tcId : null;

    const updatedTx: OpsTransaction = {
      ...transaction,
      property_address: address,
      city,
      status,
      side,
      contract_date: contractDate || null,
      client_name: clientName,
      client_phone: clientPhone || null,
      client_email: clientEmail || null,
      other_party_name: otherPartyName || null,
      other_party_agent: otherPartyAgent || null,
      other_party_phone: otherPartyPhone || null,
      other_party_brokerage: otherPartyBrokerage || null,
      flagged_for_review: flaggedForReview,
      reviewed_at: flaggedForReview ? new Date().toISOString() : null,
      reviewed_by: flaggedForReview ? 'Sarah Jenkins (TC)' : null,
      listing_agent_id: side === 'seller' || side === 'dual' ? validAgentId : transaction.listing_agent_id,
      selling_agent_id: side === 'buyer' || side === 'dual' ? validAgentId : transaction.selling_agent_id,
      assigned_tc_id: validTcId,
      agent_name: agentName,
      agent_email: agentEmail,
      tc_name: tcName,
      tc_email: tcEmail,
      updated_at: new Date().toISOString(),
      milestones,
    };

    try {
      await onSave(updatedTx);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: any) {
      console.error('Failed to save transaction:', err);
      alert(`Save failed: ${err.message || String(err)}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#1a2235] border border-[#334155] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Modal Header */}
        <div className="bg-[#131826] border-b border-[#334155] p-5 sm:p-6 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                {transaction.sisu_transaction_id ? (
                  <span className="font-mono-code text-xs font-bold text-slate-300 bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span>Sisu ID: {transaction.sisu_transaction_id}</span>
                  </span>
                ) : (
                  <span className="font-mono-code text-xs font-bold text-[#d97706] bg-[#d97706]/15 border border-[#d97706]/30 px-2.5 py-0.5 rounded-full">
                    Local Only
                  </span>
                )}
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                    side === 'buyer'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-[#d97706]/15 text-[#d97706] border-[#d97706]/30'
                  }`}
                >
                  {side} Side
                </span>
              </div>

              <h2 className="font-editorial text-xl sm:text-2xl font-bold text-[#f8fafc]">
                {address || 'Standardized Transaction Sheet'}
              </h2>
              <p className="text-xs text-[#94a3b8]">
                Assigned Agent: <strong className="text-[#f8fafc]">{agentName}</strong>{' '}
                • Coordinator: <strong className="text-sky-400">{tcName}</strong>
              </p>
            </div>

            {/* Friday Review & Save Actions */}
            <div className="flex items-center gap-3">
              {/* Friday Review Flag Toggle */}
              <button
                type="button"
                onClick={() => setFlaggedForReview(!flaggedForReview)}
                className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all min-h-[44px] ${
                  flaggedForReview
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-md'
                    : 'bg-[#1e293b] text-[#94a3b8] border-[#334155] hover:text-[#f8fafc]'
                }`}
              >
                <Flag
                  className={`h-4 w-4 ${
                    flaggedForReview ? 'fill-amber-400 text-amber-400' : 'text-[#94a3b8]'
                  }`}
                />
                <span>{flaggedForReview ? 'Flagged for Friday Review' : 'Mark Friday Verified'}</span>
              </button>

              <button
                onClick={handleSaveAll}
                className="px-5 py-2 rounded-xl bg-[#d97706] text-[#0f172a] hover:bg-[#d97706]/90 font-bold text-sm flex items-center gap-2 active:scale-[0.98] transition-all shadow-lg min-h-[44px]"
              >
                <Save className="h-4 w-4" />
                <span>{savedSuccess ? 'Saved!' : 'Save Sheet'}</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-[#94a3b8] hover:text-[#f8fafc] border border-[#334155] transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[#334155]/60 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('sheet')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
                activeTab === 'sheet'
                  ? 'bg-[#1e293b] text-[#d97706] border border-[#d97706]/40 shadow-sm'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              1. Core Sheet & Standardized Milestones ({milestones.length})
            </button>
            <button
              onClick={() => setActiveTab('other_agent')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] flex items-center gap-1.5 ${
                activeTab === 'other_agent'
                  ? 'bg-[#1e293b] text-[#d97706] border border-[#d97706]/40 shadow-sm'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              <span>2. Other Agent & Brokerage Info</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30">
                Manual Only
              </span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: STANDARDIZED SHEET & MILESTONES */}
          {activeTab === 'sheet' && (
            <div className="space-y-6">
              {/* Section 1: Core Transaction Fields */}
              <div className="bg-[#1e293b] p-5 rounded-2xl border border-[#334155] space-y-4">
                <div className="flex items-center justify-between border-b border-[#334155] pb-2">
                  <h3 className="font-editorial text-base font-bold text-[#f8fafc] flex items-center gap-2">
                    <Building className="h-4 w-4 text-[#d97706]" />
                    <span>Core Transaction Fields</span>
                  </h3>
                  <span className="text-[11px] text-[#94a3b8]">
                    Live editable by TC & Operations
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs text-[#94a3b8] mb-1">Property Address</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#94a3b8] mb-1">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-[#94a3b8] mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="under_contract">Under Contract</option>
                      <option value="pre_listing">Pre-Listing</option>
                      <option value="coming_soon">Coming Soon</option>
                      <option value="closed">Closed</option>
                      <option value="terminated">Terminated</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-[#94a3b8] mb-1">Side</label>
                    <select
                      value={side}
                      onChange={(e) => setSide(e.target.value as any)}
                      className="w-full px-3 py-2 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                    >
                      <option value="buyer">Buyer</option>
                      <option value="seller">Seller</option>
                      <option value="dual">Dual</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-[#94a3b8] mb-1">Contract Date</label>
                    <input
                      type="date"
                      value={contractDate}
                      onChange={(e) => setContractDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-[#94a3b8] mb-1">Client Name(s)</label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full px-3 py-2 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                    />
                  </div>
                </div>

                {/* Agent & TC Selection Dropdowns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#334155]/60">
                  <div>
                    <label className="block text-xs font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-amber-400" />
                      <span>Lead Team Agent (Account)</span>
                    </label>
                    <select
                      value={agentId || (agentRoster.find((a) => a.name.toLowerCase() === agentName.toLowerCase())?.id || 'custom')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'unassigned' || !val) {
                          setAgentId(null);
                          setAgentName('Unassigned Agent');
                          setAgentEmail('');
                        } else if (val !== 'custom') {
                          const matched = agentRoster.find((a) => a.id === val);
                          if (matched) {
                            setAgentId(matched.id);
                            setAgentName(matched.name);
                            setAgentEmail(matched.email);
                          }
                        }
                      }}
                      className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-sm font-semibold text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                    >
                      <option value="unassigned">-- Unassigned Agent --</option>
                      {agentRoster.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.email})
                        </option>
                      ))}
                      {!agentRoster.some((a) => a.id === agentId || a.name.toLowerCase() === agentName.toLowerCase()) && agentName && (
                        <option value="custom">
                          {agentName} (Current)
                        </option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-sky-400 mb-1 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-sky-400" />
                      <span>Assigned Coordinator / TC (Account)</span>
                    </label>
                    <select
                      value={tcId || (tcRoster.find((t) => t.name.toLowerCase() === tcName.toLowerCase())?.id || 'unassigned')}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'unassigned' || !val) {
                          setTcId(null);
                          setTcName('Unassigned TC');
                          setTcEmail('');
                        } else if (val !== 'custom') {
                          const matched = tcRoster.find((t) => t.id === val);
                          if (matched) {
                            setTcId(matched.id);
                            setTcName(matched.name);
                            setTcEmail(matched.email);
                          }
                        }
                      }}
                      className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-sm font-semibold text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                    >
                      <option value="unassigned">-- Unassigned TC --</option>
                      {tcRoster.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.email})
                        </option>
                      ))}
                      {!tcRoster.some((t) => t.id === tcId || t.name.toLowerCase() === tcName.toLowerCase()) && tcName && tcName !== 'Unassigned TC' && (
                        <option value="custom">
                          {tcName} (Current)
                        </option>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Standardized Milestones Table */}
              <div className="bg-[#1e293b] rounded-2xl border border-[#334155] overflow-hidden shadow-xl">
                <div className="p-4 bg-[#131826] border-b border-[#334155] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-editorial text-base font-bold text-[#f8fafc] flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#d97706]" />
                      <span>Standardized Milestones & Contingencies</span>
                    </h3>
                    <p className="text-xs text-[#94a3b8]">
                      Inline editable target/actual dates, status, notes, and source provenance
                      badges.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-700/60 text-slate-300 border border-slate-600">
                      Synced from Sisu
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-500/15 text-sky-400 border border-sky-500/30">
                      Manually entered
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-[#131826]/70 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider border-b border-[#334155]">
                      <tr>
                        <th className="py-3 px-4">Milestone</th>
                        <th className="py-3 px-3">Target Date</th>
                        <th className="py-3 px-3">Actual Date</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Notes / Repair Memo</th>
                        <th className="py-3 px-3 text-right">Source Provenance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334155]/60">
                      {milestones.map((m) => {
                        const config =
                          ALL_MILESTONES_CONFIG.find((c) => c.type === m.milestone_type) || {
                            label: m.milestone_type,
                            description: '',
                            parentGroup: undefined as 'inspection' | 'appraisal' | undefined,
                          };

                        return (
                          <tr key={m.milestone_type} className="hover:bg-[#131826]/40 transition-colors">
                            {/* Milestone Name */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-[#f8fafc] block">
                                  {config.label}
                                </span>
                                {config.parentGroup && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    Dual Condition
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-[#94a3b8]">
                                {config.description}
                              </span>
                            </td>

                            {/* Target Date */}
                            <td className="py-3 px-3">
                              <input
                                type="date"
                                value={m.target_date || ''}
                                onChange={(e) =>
                                  handleMilestoneChange(m.milestone_type, {
                                    target_date: e.target.value || null,
                                  })
                                }
                                className="w-36 px-2.5 py-1.5 bg-[#131826] border border-[#334155] rounded-lg text-xs font-mono-code text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                              />
                            </td>

                            {/* Actual Date */}
                            <td className="py-3 px-3">
                              <input
                                type="date"
                                value={m.actual_date || ''}
                                onChange={(e) =>
                                  handleMilestoneChange(m.milestone_type, {
                                    actual_date: e.target.value || null,
                                  })
                                }
                                className="w-36 px-2.5 py-1.5 bg-[#131826] border border-[#334155] rounded-lg text-xs font-mono-code text-emerald-400 focus:outline-none focus:border-emerald-400"
                              />
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3">
                              <select
                                value={m.status}
                                onChange={(e) =>
                                  handleMilestoneChange(m.milestone_type, {
                                    status: e.target.value as MilestoneStatus,
                                  })
                                }
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                                  m.status === 'satisfied' || m.status === 'complete'
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : m.status === 'notice_sent' || m.status === 'ordered'
                                    ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                                    : m.status === 'waived'
                                    ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                                    : m.status === 'na'
                                    ? 'bg-slate-800 text-slate-400 border-slate-700'
                                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                }`}
                              >
                                <option value="pending">pending</option>
                                <option value="ordered">ordered</option>
                                <option value="notice_sent">notice_sent</option>
                                <option value="satisfied">satisfied</option>
                                <option value="complete">complete</option>
                                <option value="waived">waived</option>
                                <option value="na">na</option>
                              </select>
                            </td>

                            {/* Notes */}
                            <td className="py-3 px-3">
                              <input
                                type="text"
                                placeholder="Add TC memo..."
                                value={m.notes || ''}
                                onChange={(e) =>
                                  handleMilestoneChange(m.milestone_type, {
                                    notes: e.target.value || null,
                                  })
                                }
                                className="w-48 px-2.5 py-1.5 bg-[#131826] border border-[#334155] rounded-lg text-xs text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                              />
                            </td>

                            {/* Source Provenance Badge */}
                            <td className="py-3 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleToggleSource(m.milestone_type)}
                                title="Click to toggle between Sisu and Manual source"
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border transition-all ${
                                  m.source === 'sisu'
                                    ? 'bg-slate-700/60 text-slate-300 border-slate-600 hover:border-sky-500 hover:text-sky-300'
                                    : 'bg-sky-500/15 text-sky-400 border-sky-500/30 hover:border-slate-500'
                                }`}
                              >
                                {m.source === 'sisu' ? 'Synced from Sisu' : 'Manually entered'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sisu Custom Form Responses Card */}
              {transaction.custom_fields && Object.keys(transaction.custom_fields).length > 0 && (
                <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] space-y-4">
                  <div className="flex items-center justify-between border-b border-[#334155] pb-3">
                    <div>
                      <h3 className="font-editorial text-base font-bold text-[#f8fafc] flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-[#d97706]" />
                        <span>Sisu Custom Form Responses</span>
                      </h3>
                      <p className="text-xs text-[#94a3b8] mt-0.5">
                        Live snapshot of custom fields and questions answered on Sisu forms
                      </p>
                    </div>
                    <span className="text-[11px] font-mono-code text-[#94a3b8] px-2.5 py-1 rounded-lg bg-[#131826] border border-[#334155]">
                      {Object.keys(transaction.custom_fields).length} Fields
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(transaction.custom_fields).map(([key, val]) => {
                      const CUSTOM_LABEL_OVERRIDES: Record<string, string> = {
                        inspection_completeds_63: 'Inspection Ordered',
                        inspection_completed: 'Inspection Ordered',
                        inspection_satisfieds_63: 'Inspection Satisfied',
                        insurance_obtaineds_63: 'Insurance Obtained',
                        earnest_money_depositeds_63: 'Earnest Money Deposited',
                        title_commitment_s_38_clearance: 'Title Commitment & Clearance',
                        'financing_/_loan_commitment_-_internal_use': 'Financing / Loan Commitment',
                        'clear-to-close_(ctc)': 'Clear to Close',
                        final_walkthrough: 'Final Walkthrough',
                        appraisal_received: 'Appraisal Received',
                        appraisal_satisfied: 'Appraisal Satisfied',
                      };

                      const label = CUSTOM_LABEL_OVERRIDES[key] || key
                        .replace(/s_\d+$|_\d+$/g, '')
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (c) => c.toUpperCase());

                      const isYes =
                        val === '0' ||
                        val === true ||
                        String(val).toLowerCase() === 'yes' ||
                        String(val).toLowerCase() === 'true';

                      const isNo =
                        val === '1' ||
                        val === false ||
                        String(val).toLowerCase() === 'no' ||
                        String(val).toLowerCase() === 'false';

                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between p-3 rounded-xl bg-[#131826] border border-[#334155]/80"
                        >
                          <span className="text-xs text-[#f8fafc] font-medium pr-2 truncate">
                            {label}
                          </span>
                          {isYes ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                              Yes
                            </span>
                          ) : isNo ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-[#94a3b8] border border-[#334155] whitespace-nowrap">
                              No
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#1e293b] text-[#94a3b8] border border-[#334155] whitespace-nowrap">
                              {String(val ?? '—')}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: OTHER AGENT & BROKERAGE INFO */}
          {activeTab === 'other_agent' && (
            <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] space-y-5">
              <div className="border-b border-[#334155] pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-editorial text-lg font-bold text-[#f8fafc]">
                    Add Other Party & Co-Op Agent Information
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                    Always source = 'manual'
                  </span>
                </div>
                <p className="text-xs text-[#94a3b8] mt-1 leading-relaxed">
                  These fields hold co-op agent contact numbers and brokerage details that Sisu
                  doesn't carry. They are strictly preserved as manual data and will never be
                  overwritten by Sisu synchronization jobs.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#94a3b8] mb-1.5">
                    Other Party's Agent Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Victoria Sterling"
                    value={otherPartyAgent}
                    onChange={(e) => setOtherPartyAgent(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94a3b8] mb-1.5">
                    Other Party's Agent Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. (312) 555-4478"
                    value={otherPartyPhone}
                    onChange={(e) => setOtherPartyPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] font-mono-code focus:outline-none focus:border-[#d97706]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94a3b8] mb-1.5">
                    Co-Op Brokerage Company
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Jameson Sotheby's International Realty"
                    value={otherPartyBrokerage}
                    onChange={(e) => setOtherPartyBrokerage(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94a3b8] mb-1.5">
                    Other Party / Principal Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Vanderbilt Trust"
                    value={otherPartyName}
                    onChange={(e) => setOtherPartyName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                  />
                </div>
              </div>

              <div className="p-4 bg-[#131826] rounded-xl border border-sky-500/20 text-xs text-[#94a3b8] flex items-start gap-2.5">
                <Info className="h-4 w-4 text-sky-400 flex-shrink-0 mt-0.5" />
                <span>
                  All changes saved in this section are protected by MSREG Hub's Row-Level Security
                  and will be available across the transaction coordinator workflow.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
