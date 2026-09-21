import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../integrations/supabase/client';
import { OpsTransaction, OpsMilestone, ALL_MILESTONES_CONFIG, resolveTcForAgent } from '../types/ops';
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
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  Send,
  Loader2,
} from 'lucide-react';
import { AgentDigestEmailModal } from '../components/AgentDigestEmailModal';

export const MyDealsView: React.FC = () => {
  const { currentUser, isOps, isAdmin } = useAuth();
  const [dealsList, setDealsList] = useState<OpsTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  const [agentRoster, setAgentRoster] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('All');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatusText, setEmailStatusText] = useState<string | null>(null);

  // Email Digest Modal state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  // Load live agent transactions & agent roster from Supabase
  useEffect(() => {
    async function loadLiveAgentDeals() {
      try {
        const { data: dbAgents } = await supabase.from('agents').select('id, name, email').order('name');
        if (dbAgents) {
          setAgentRoster(dbAgents);
        }

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
            const leadAgent = t.side === 'seller' ? (t.listing_agent || t.selling_agent) : (t.selling_agent || t.listing_agent);
            const agentName = leadAgent?.name || t.agent_name || 'Lead Agent';
            const agentEmail = leadAgent?.email || t.agent_email || 'agent@mattsmithrealestategroup.com';
            const fallbackTc = resolveTcForAgent(agentName);
            const tcName = t.assigned_tc?.name || (t.tc_name && t.tc_name !== 'Unassigned TC' ? t.tc_name : fallbackTc.tc_name);
            const tcEmail = t.assigned_tc?.email || t.tc_email || fallbackTc.tc_email;

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

  // Auto-select logged in user's agent profile if available
  useEffect(() => {
    if (currentUser && selectedAgentFilter === 'All' && agentRoster.length > 0) {
      const match = agentRoster.find(
        (a) =>
          a.name.toLowerCase() === currentUser.fullName?.toLowerCase() ||
          (currentUser.email && a.email.toLowerCase() === currentUser.email.toLowerCase())
      );
      if (match) {
        setSelectedAgentFilter(match.name);
      }
    }
  }, [currentUser, agentRoster]);

  // Filter deals to selected agent profile or current logged-in agent
  const myDeals = useMemo(() => {
    return dealsList.filter((t) => {
      if (selectedAgentFilter !== 'All') {
        const isSelectedAgent = t.agent_name.toLowerCase() === selectedAgentFilter.toLowerCase();
        if (!isSelectedAgent) return false;
      } else if (currentUser && currentUser.role === 'agent') {
        const isMyDeal =
          t.agent_name.toLowerCase() === currentUser.fullName.toLowerCase() ||
          t.agent_email === currentUser.email;
        if (!isMyDeal) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchAddr = t.property_address.toLowerCase().includes(q);
        const matchClient = t.client_name.toLowerCase().includes(q);
        const matchSisu = t.sisu_transaction_id && t.sisu_transaction_id.toLowerCase().includes(q);
        if (!matchAddr && !matchClient && !matchSisu) return false;
      }

      return true;
    });
  }, [dealsList, currentUser, selectedAgentFilter, searchQuery]);

  // CSV Export Functionality
  const handleDownloadCSV = () => {
    if (myDeals.length === 0) {
      alert('No transactions available in current view to export.');
      return;
    }

    const headers = [
      'Property Address',
      'City',
      'State',
      'Side',
      'Status',
      'Client Name',
      'Client Phone',
      'Lead Agent',
      'Assigned TC',
      'Contract Date',
      'Target Closing Date',
      'Sisu Transaction ID',
    ];

    const rows = myDeals.map((t) => [
      `"${(t.property_address || '').replace(/"/g, '""')}"`,
      `"${(t.city || 'Waynesville').replace(/"/g, '""')}"`,
      `"${(t.state || 'MO').replace(/"/g, '""')}"`,
      `"${(t.side || '').replace(/"/g, '""')}"`,
      `"${(t.status || '').replace(/"/g, '""')}"`,
      `"${(t.client_name || '').replace(/"/g, '""')}"`,
      `"${(t.client_phone || '').replace(/"/g, '""')}"`,
      `"${(t.agent_name || '').replace(/"/g, '""')}"`,
      `"${(t.tc_name || '').replace(/"/g, '""')}"`,
      `"${(t.contract_date || '').replace(/"/g, '""')}"`,
      `"${(t.target_closing_date || '').replace(/"/g, '""')}"`,
      `"${(t.sisu_transaction_id || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName =
      selectedAgentFilter === 'All'
        ? `MSREG_All_Deals_${new Date().toISOString().split('T')[0]}.csv`
        : `MSREG_Deals_${selectedAgentFilter.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // PDF Print Functionality
  const handleDownloadPDF = () => {
    window.print();
  };

  // Trigger Weekly Update Email Dispatch Modal (Targeted or All)
  const handleSendWeeklyUpdate = () => {
    setIsEmailModalOpen(true);
  };

  const toggleExpand = (txId: string) => {
    setExpandedTxId((prev) => (prev === txId ? null : txId));
  };

  if (!currentUser) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      {/* Admin Agent Profile Selector Dropdown & Action Controls */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#d97706]/15 border border-[#d97706]/30 text-[#d97706]">
              <User className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#d97706]">Agent Profile Selector</span>
              <h2 className="text-base font-bold text-[#f8fafc]">
                {selectedAgentFilter === 'All' ? 'All Team Agents' : selectedAgentFilter}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <label className="text-xs text-[#94a3b8] font-medium hidden sm:inline">Select Agent Profile:</label>
            <select
              value={selectedAgentFilter}
              onChange={(e) => setSelectedAgentFilter(e.target.value)}
              className="bg-[#0f172a] border border-[#334155] text-[#f8fafc] text-xs font-semibold rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#d97706] cursor-pointer shadow-inner"
            >
              <option value="All">All Active Deals ({dealsList.length})</option>
              {agentRoster.map((a) => {
                const count = dealsList.filter((d) => d.agent_name.toLowerCase() === a.name.toLowerCase()).length;
                return (
                  <option key={a.id} value={a.name}>
                    {a.name} ({count} deals)
                  </option>
                );
              })}
            </select>
            {selectedAgentFilter !== 'All' && (
              <button
                onClick={() => setSelectedAgentFilter('All')}
                className="px-3 py-2 bg-[#334155] hover:bg-[#475569] text-white text-xs font-semibold rounded-xl transition-all"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Export & Email Action Toolbar */}
        <div className="pt-3 border-t border-[#334155]/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadCSV}
              className="px-3.5 py-2 rounded-xl bg-[#131826] hover:bg-[#1e293b] border border-[#334155] text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-2 transition-all min-h-[38px] shadow-sm"
              title="Download CSV spreadsheet of current deals"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              <span>Download CSV</span>
            </button>

            <button
              onClick={handleDownloadPDF}
              className="px-3.5 py-2 rounded-xl bg-[#131826] hover:bg-[#1e293b] border border-[#334155] text-xs font-bold text-sky-400 hover:text-sky-300 flex items-center gap-2 transition-all min-h-[38px] shadow-sm"
              title="Download PDF report / print view"
            >
              <Printer className="h-4 w-4 text-sky-400" />
              <span>Export PDF / Print</span>
            </button>
          </div>

          {(isOps || isAdmin) && (
            <button
              onClick={handleSendWeeklyUpdate}
              disabled={isSendingEmail}
              className="px-4 py-2 rounded-xl bg-[#d97706]/15 hover:bg-[#d97706]/25 border border-[#d97706]/40 text-[#d97706] text-xs font-bold flex items-center gap-2 transition-all active:scale-[0.98] min-h-[38px] shadow-sm"
            >
              {isSendingEmail ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#d97706]" />
              ) : (
                <Send className="h-4 w-4 text-[#d97706]" />
              )}
              <span>
                {selectedAgentFilter === 'All'
                  ? 'Send Weekly Update to ALL Agents'
                  : `Send Weekly Update to ${selectedAgentFilter}`}
              </span>
            </button>
          )}
        </div>

        {emailStatusText && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-semibold text-amber-300 flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <span>{emailStatusText}</span>
          </div>
        )}
      </div>

      {/* Mobile-Friendly Header */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-5 sm:p-6 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-editorial text-xl sm:text-2xl font-bold text-[#f8fafc]">
                {selectedAgentFilter !== 'All' ? `${selectedAgentFilter}'s Deals` : 'My Deals'}
              </h1>
              <p className="text-xs text-[#94a3b8]">
                {selectedAgentFilter !== 'All' ? selectedAgentFilter : currentUser.fullName} • Live Agent Portal
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
            This is the live, mobile-ready escrow tracker for <strong>{selectedAgentFilter !== 'All' ? selectedAgentFilter : currentUser.fullName}</strong>. Milestone updates are managed directly by your assigned TC.
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
              <strong className="text-[#f8fafc]">{selectedAgentFilter !== 'All' ? selectedAgentFilter : currentUser.fullName}</strong>. Use the Agent Profile Selector at the top to preview any team agent's profile.
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
                        {tx.milestones
                          .filter((m) => ALL_MILESTONES_CONFIG.some((c) => c.type === m.milestone_type))
                          .map((m) => {
                            const config = ALL_MILESTONES_CONFIG.find((c) => c.type === m.milestone_type)!;

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
                                      m.status === 'satisfied' || m.status === 'complete'
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

      {/* Interactive Email Digest Preview & Send Modal */}
      {isEmailModalOpen && (
        <AgentDigestEmailModal
          agentName={selectedAgentFilter}
          agentEmail={
            selectedAgentFilter === 'All'
              ? ''
              : agentRoster.find((a) => a.name.toLowerCase() === selectedAgentFilter.toLowerCase())?.email ||
                'agent@mattsmithrealestategroup.com'
          }
          transactions={
            selectedAgentFilter === 'All'
              ? dealsList
              : dealsList.filter((d) => d.agent_name.toLowerCase() === selectedAgentFilter.toLowerCase())
          }
          allAgentProfiles={agentRoster}
          onClose={() => setIsEmailModalOpen(false)}
        />
      )}
    </div>
  );
};
