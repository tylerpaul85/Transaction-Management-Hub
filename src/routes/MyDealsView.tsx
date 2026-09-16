import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../integrations/supabase/client';
import { OpsTransaction, OpsMilestone, ALL_MILESTONES_CONFIG } from '../types/ops';
import { MilestoneDotSequence } from '../components/MilestoneDotSequence';
import {
  Building,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Phone,
  Mail,
  ShieldCheck,
  Search,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';

export const MyDealsView: React.FC = () => {
  const { currentUser } = useAuth();
  const [dealsList, setDealsList] = useState<OpsTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // Load live agent transactions from Supabase
  useEffect(() => {
    async function loadLiveAgentDeals() {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select(`
            *,
            listing_agent:agents!transactions_listing_agent_id_fkey(name, email),
            selling_agent:agents!transactions_selling_agent_id_fkey(name, email),
            assigned_tc:ops_users!transactions_assigned_tc_id_fkey(name, email),
            milestones (*)
          `)
          .order('created_at', { ascending: false })
          .limit(5000);

        if (error) {
          console.warn('Could not fetch Supabase agent transactions:', error);
          return;
        }

        if (data) {
          const mapped: OpsTransaction[] = data.map((t: any) => {
            const leadAgent = t.side === 'seller' ? t.listing_agent : (t.selling_agent || t.listing_agent);
            const agentName = leadAgent?.name || t.agent_name || 'Lead Agent';
            const agentEmail = leadAgent?.email || t.agent_email || 'agent@mattsmithrealestategroup.com';
            const tcName = t.assigned_tc?.name || t.tc_name || 'Unassigned TC';
            const tcEmail = t.assigned_tc?.email || t.tc_email || '';

            return {
              id: t.id,
              sisu_transaction_id: t.sisu_transaction_id || undefined,
              status: t.status,
              property_address: t.property_address,
              city: t.city || 'Waynesville',
              state: t.state || 'MO',
              zip: t.zip || '65583',
              side: t.side,
              client_name: t.client_name,
              client_phone: t.client_phone || undefined,
              other_party_name: t.other_party_name || undefined,
              other_party_agent: t.other_party_agent || undefined,
              other_party_phone: undefined,
              other_party_brokerage: undefined,
              listing_agent_id: t.listing_agent_id,
              selling_agent_id: t.selling_agent_id,
              assigned_tc_id: t.assigned_tc_id,
              agent_name: agentName,
              agent_email: agentEmail,
              tc_name: tcName,
              tc_email: tcEmail,
              contract_date: t.contract_date || undefined,
              target_closing_date: t.target_closing_date || undefined,
              flagged_for_review: false,
              created_at: t.created_at,
              updated_at: t.updated_at,
              milestones: (t.milestones || []).map((m: any) => ({
                id: m.id,
                transaction_id: m.transaction_id,
                milestone_type: m.milestone_type,
                target_date: m.target_date,
                actual_date: m.actual_date,
                status: m.status,
                source: m.source,
                notes: m.notes,
                updated_at: m.updated_at,
              })),
            };
          });

          setDealsList(mapped);
        }
      } catch (err) {
        console.warn('Live agent transactions query error:', err);
      }
    }

    loadLiveAgentDeals();

    const channel = supabase
      .channel('realtime_agent_deals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        loadLiveAgentDeals();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestones' }, () => {
        loadLiveAgentDeals();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter deals to only this agent (enforced by RLS)
  const myDeals = useMemo(() => {
    if (!currentUser) return [];
    return dealsList.filter((t) => {
      const isMyDeal =
        t.agent_name.toLowerCase() === currentUser.fullName.toLowerCase() ||
        t.agent_email === currentUser.email;

      if (!isMyDeal) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchAddr = t.property_address.toLowerCase().includes(q);
        const matchClient = t.client_name.toLowerCase().includes(q);
        const matchSisu = t.sisu_transaction_id && t.sisu_transaction_id.toLowerCase().includes(q);
        if (!matchAddr && !matchClient && !matchSisu) return false;
      }

      return true;
    });
  }, [dealsList, currentUser, searchQuery]);

  const toggleExpand = (txId: string) => {
    setExpandedTxId((prev) => (prev === txId ? null : txId));
  };

  if (!currentUser) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      {/* Mobile-Friendly Header */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-5 sm:p-6 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-editorial text-xl sm:text-2xl font-bold text-[#f8fafc]">
                My Deals
              </h1>
              <p className="text-xs text-[#94a3b8]">
                {currentUser.fullName} • Read-Only Escrow Checklist
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            {myDeals.length} Active {myDeals.length === 1 ? 'Deal' : 'Deals'}
          </span>
        </div>

        {/* Read-Only Notice Box */}
        <div className="p-3 bg-[#131826]/70 rounded-xl border border-[#334155] text-xs text-[#94a3b8] flex items-start gap-2">
          <Info className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <span>
            This is your live, mobile-ready escrow tracker. Milestone updates and compliance checks
            are managed directly by your assigned Transaction Coordinator (TC).
          </span>
        </div>
      </div>

      {/* Quick Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Quick search property address or client..."
          className="w-full pl-10 pr-4 py-2.5 bg-[#1e293b] border border-[#334155] rounded-2xl text-base text-[#f8fafc] placeholder-[#94a3b8] focus:outline-none focus:border-[#d97706] shadow-sm"
        />
      </div>

      {/* Transaction Cards List */}
      <div className="space-y-4">
        {myDeals.length === 0 ? (
          <div className="p-12 text-center bg-[#1e293b] rounded-3xl border border-[#334155] text-[#94a3b8] space-y-2">
            <Building className="h-8 w-8 mx-auto text-[#94a3b8]/40" />
            <p className="font-semibold text-[#f8fafc]">No active deals found</p>
            <p className="text-xs max-w-sm mx-auto">
              There are currently no active transactions linked to{' '}
              <strong className="text-[#f8fafc]">{currentUser.fullName}</strong>. Switch to Tyler
              Miller or Sophia Montgomery in the top bar to inspect live deals.
            </p>
          </div>
        ) : (
          myDeals.map((tx) => {
            const isExpanded = expandedTxId === tx.id;

            return (
              <div
                key={tx.id}
                className="bg-[#1e293b] border border-[#334155] hover:border-[#d97706]/40 rounded-3xl shadow-lg transition-all overflow-hidden"
              >
                {/* Collapsed / Summary Header (Touch Target >= 44px) */}
                <div
                  onClick={() => toggleExpand(tx.id)}
                  className="p-5 sm:p-6 cursor-pointer select-none space-y-3.5 hover:bg-[#131826]/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border ${
                            tx.side === 'buyer'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-[#d97706]/15 text-[#d97706] border-[#d97706]/30'
                          }`}
                        >
                          {tx.side} Representation
                        </span>
                        <span className="text-xs font-mono-code text-[#94a3b8]">
                          {tx.sisu_transaction_id || 'MSREG File'}
                        </span>
                      </div>

                      <h2 className="font-editorial text-lg sm:text-xl font-bold text-[#f8fafc] leading-tight">
                        {tx.property_address}
                      </h2>
                      <p className="text-xs text-[#94a3b8]">
                        Client: <strong className="text-[#f8fafc]">{tx.client_name}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-[#131826] border border-[#334155] text-[#94a3b8]">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-[#d97706]" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Summary Dates & Milestone Dots */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#334155]/60">
                    <div className="flex items-center gap-4 text-xs font-mono-code">
                      <div>
                        <span className="text-[#94a3b8] block text-[10px] uppercase">Contract</span>
                        <span className="text-[#f8fafc] font-semibold">
                          {tx.contract_date || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[#94a3b8] block text-[10px] uppercase">
                          Target Close
                        </span>
                        <span className="text-[#d97706] font-bold">
                          {tx.target_closing_date || '—'}
                        </span>
                      </div>
                    </div>

                    {/* Milestone Progress Dots */}
                    <div className="self-start sm:self-center">
                      <MilestoneDotSequence milestones={tx.milestones} />
                    </div>
                  </div>
                </div>

                {/* Expanded Details Accordion */}
                {isExpanded && (
                  <div className="p-5 sm:p-6 bg-[#131826]/90 border-t border-[#334155] space-y-5 animate-in fade-in duration-200">
                    {/* TC & Contact Info Pill */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-[#1e293b] rounded-2xl border border-[#334155] text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] block mb-1">
                          Assigned Transaction Coordinator
                        </span>
                        <div className="flex items-center justify-between">
                          <strong className="text-sky-400 font-semibold">{tx.tc_name}</strong>
                          <span className="text-[#94a3b8]">{tx.tc_email}</span>
                        </div>
                      </div>

                      {tx.other_party_agent && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] block mb-1">
                            Co-Op Agent (Other Party)
                          </span>
                          <div className="flex items-center justify-between">
                            <strong className="text-[#f8fafc]">{tx.other_party_agent}</strong>
                            {tx.other_party_phone && (
                              <span className="text-[#94a3b8] font-mono-code">
                                {tx.other_party_phone}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Milestones Detailed Checklist */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="font-editorial text-sm font-bold text-[#f8fafc] flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-[#d97706]" />
                          <span>Full Escrow Milestone Checklist</span>
                        </h3>
                        <span className="text-[11px] text-[#94a3b8]">
                          Read-only • Live with TC & Sisu
                        </span>
                      </div>

                      <div className="space-y-2">
                        {tx.milestones.map((m) => {
                          const config =
                            ALL_MILESTONES_CONFIG.find((c) => c.type === m.milestone_type) || {
                              label: m.milestone_type,
                              description: '',
                            };

                          return (
                            <div
                              key={m.milestone_type}
                              className="p-3.5 bg-[#1e293b] border border-[#334155] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-[#f8fafc]">
                                    {config.label}
                                  </span>
                                  <span
                                    className={`px-2 py-0.2 rounded-full text-[10px] font-bold uppercase border ${
                                      m.status === 'satisfied'
                                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                        : m.status === 'notice_sent' || m.status === 'ordered'
                                        ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                                        : m.status === 'waived'
                                        ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                                        : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                    }`}
                                  >
                                    {m.status}
                                  </span>
                                </div>
                                {m.notes && (
                                  <p className="text-xs text-[#94a3b8] italic">{m.notes}</p>
                                )}
                              </div>

                              {/* Dates & Source Badge */}
                              <div className="flex flex-wrap items-center gap-3 text-xs self-start sm:self-center">
                                <div className="font-mono-code text-[11px]">
                                  {m.target_date && (
                                    <span className="text-[#94a3b8] mr-2">
                                      Target: <strong className="text-[#f8fafc]">{m.target_date}</strong>
                                    </span>
                                  )}
                                  {m.actual_date && (
                                    <span className="text-emerald-400">
                                      Actual: <strong>{m.actual_date}</strong>
                                    </span>
                                  )}
                                </div>

                                {/* Source Provenance Badge */}
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                    m.source === 'sisu'
                                      ? 'bg-slate-700/60 text-slate-300 border-slate-600'
                                      : 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                                  }`}
                                >
                                  {m.source === 'sisu' ? 'Synced from Sisu' : 'Manually entered'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
