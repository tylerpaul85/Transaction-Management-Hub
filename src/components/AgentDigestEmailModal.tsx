import React, { useState, useMemo } from 'react';
import {
  renderAgentDigestEmail,
  DigestTransactionItem,
  ACTIVE_MILESTONES_SET,
  MILESTONE_LABELS,
  isFieldComplete,
  getFieldStatus,
} from '../utils/agentDigestEmail';
import { OpsTransaction } from '../types/ops';
import { supabase } from '../integrations/supabase/client';
import {
  X,
  Send,
  Mail,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  ArrowLeft,
  Users,
  Search,
  CheckSquare,
  Square,
  Sparkles,
  AlertTriangle,
  Clock,
  Building,
} from 'lucide-react';

interface AgentDigestEmailModalProps {
  agentName: string; // 'All' or specific agent name like 'Amy Reid'
  agentEmail?: string;
  transactions: OpsTransaction[];
  allAgentProfiles?: Array<{ id: string; name: string; email: string }>;
  onClose: () => void;
}

interface AgentGroupInfo {
  id?: string;
  name: string;
  email: string;
  transactions: OpsTransaction[];
  overdueCount: number;
  totalDeals: number;
}

export const AgentDigestEmailModal: React.FC<AgentDigestEmailModalProps> = ({
  agentName: initialAgentName,
  agentEmail: initialAgentEmail,
  transactions,
  allAgentProfiles = [],
  onClose,
}) => {
  const isInitialAll = initialAgentName === 'All';
  const [viewMode, setViewMode] = useState<'all' | 'single'>(isInitialAll ? 'all' : 'single');

  // Single Agent mode state
  const [activeAgentName, setActiveAgentName] = useState<string>(
    isInitialAll ? '' : initialAgentName
  );
  const [recipientEmail, setRecipientEmail] = useState<string>(
    allAgentProfiles.find((a) => a.name.toLowerCase() === initialAgentName.toLowerCase())?.email ||
      initialAgentEmail ||
      'tyler.p@mattsmithrealestategroup.com'
  );

  // Multi-agent selection & search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgentNames, setSelectedAgentNames] = useState<Set<string>>(new Set());

  // Cloud dispatch states
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
    details?: string[];
  } | null>(null);

  // Per-agent status map from server response
  const [agentSendStatuses, setAgentSendStatuses] = useState<
    Record<string, { status: 'sent' | 'skipped' | 'failed'; messageId?: string; error?: string }>
  >({});

  const [copiedType, setCopiedType] = useState<'html' | 'text' | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // Group all transactions by agent for the multi-agent view
  const agentGroups: AgentGroupInfo[] = useMemo(() => {
    const map = new Map<string, { canonicalName: string; id?: string; email?: string; txs: OpsTransaction[] }>();

    // First seed with verified profiles
    allAgentProfiles.forEach((p) => {
      if (p.name) {
        map.set(p.name.trim().toLowerCase(), { canonicalName: p.name.trim(), id: p.id, email: p.email, txs: [] });
      }
    });

    // Distribute transactions to agents
    transactions.forEach((tx) => {
      const rawName = (tx.agent_name || 'Unassigned Agent').trim();
      const key = rawName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { canonicalName: rawName, email: tx.agent_email, txs: [] });
      }
      const item = map.get(key)!;
      // If no verified email, fallback to transaction email
      if (!item.email && tx.agent_email) {
        item.email = tx.agent_email;
      }
      item.txs.push(tx);
    });

    // Map into array with overdue counts, only include agents with > 0 deals or active profiles
    const list: AgentGroupInfo[] = [];
    map.forEach((data, name) => {
      if (data.txs.length === 0) return; // Skip agents with 0 active deals

      let overdue = 0;
      data.txs.forEach((tx) => {
        const milestonesList = (tx.milestones || []).filter((m) =>
          ACTIVE_MILESTONES_SET.has(m.milestone_type)
        );
        milestonesList.forEach((m) => {
          const isDone =
            m.status === 'satisfied' ||
            m.status === 'complete' ||
            m.status === 'waived' ||
            m.status === 'na' ||
            isFieldComplete(m.milestone_type, milestonesList, tx.custom_fields) ||
            getFieldStatus(m.milestone_type, milestonesList, tx.custom_fields) === 'na';
          if (m.target_date && m.target_date < todayStr && !isDone) {
            overdue++;
          }
        });
      });

      list.push({
        id: data.id,
        name: data.canonicalName,
        email: data.email || 'agent@mattsmithrealestategroup.com',
        transactions: data.txs,
        overdueCount: overdue,
        totalDeals: data.txs.length,
      });
    });

    // Sort: highest overdue first, then most deals
    return list.sort((a, b) => b.overdueCount - a.overdueCount || b.totalDeals - a.totalDeals);
  }, [transactions, allAgentProfiles, todayStr]);

  // Initialize selected agents to all agents with deals
  useState(() => {
    const allNames = new Set(agentGroups.map((g) => g.name));
    setSelectedAgentNames(allNames);
  });

  // Filtered agent list based on search
  const filteredAgentGroups = useMemo(() => {
    if (!searchQuery.trim()) return agentGroups;
    const q = searchQuery.toLowerCase();
    return agentGroups.filter(
      (g) => g.name.toLowerCase().includes(q) || g.email.toLowerCase().includes(q)
    );
  }, [agentGroups, searchQuery]);

  // Toggle agent selection
  const handleToggleAgent = (name: string) => {
    setSelectedAgentNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedAgentNames(new Set(agentGroups.map((g) => g.name)));
  };

  const handleDeselectAll = () => {
    setSelectedAgentNames(new Set());
  };

  // Switch to single agent preview
  const handlePreviewAgent = (agent: AgentGroupInfo) => {
    setActiveAgentName(agent.name);
    setRecipientEmail(agent.email);
    setSendResult(null);
    setViewMode('single');
  };

  // Transactions for the currently viewed single agent
  const currentAgentTransactions = useMemo(() => {
    if (!activeAgentName || activeAgentName === 'All') {
      return transactions;
    }
    return transactions.filter(
      (tx) => (tx.agent_name || '').toLowerCase() === activeAgentName.toLowerCase()
    );
  }, [transactions, activeAgentName]);

  // Convert transactions into DigestTransactionItems for preview
  const singleAgentDigestItems: DigestTransactionItem[] = useMemo(() => {
    return currentAgentTransactions.map((tx) => {
      const milestonesList = (tx.milestones || []).filter((m) =>
        ACTIVE_MILESTONES_SET.has(m.milestone_type)
      );

      const checkDoneOrExempt = (m: any) => {
        const s = (m.status || '').toLowerCase();
        if (s === 'satisfied' || s === 'complete' || s === 'waived' || s === 'na') return true;
        const status = getFieldStatus(m.milestone_type, milestonesList, tx.custom_fields);
        return status === 'complete' || status === 'na';
      };

      const overdue = milestonesList
        .filter((m) => {
          if (!m.target_date) return false;
          return !checkDoneOrExempt(m) && m.target_date < todayStr;
        })
        .map((m) => {
          const targetMs = new Date(m.target_date!).getTime();
          const nowMs = new Date(todayStr).getTime();
          const diffDays = Math.max(1, Math.round((nowMs - targetMs) / (1000 * 60 * 60 * 24)));
          return {
            type: m.milestone_type,
            label: MILESTONE_LABELS[m.milestone_type] || m.milestone_type,
            target_date: m.target_date,
            status: m.status,
            days_overdue: diffDays,
          };
        });

      const pending = milestonesList
        .filter((m) => {
          return !checkDoneOrExempt(m) && m.target_date && m.target_date >= todayStr;
        })
        .sort((a, b) => (a.target_date! > b.target_date! ? 1 : -1));

      const nextM = pending.length > 0 ? pending[0] : null;

      return {
        id: tx.id,
        property_address: tx.property_address,
        client_name: tx.client_name,
        side: tx.side,
        contract_date: tx.contract_date,
        target_closing_date: tx.target_closing_date,
        custom_fields: tx.custom_fields,
        next_milestone: nextM
          ? {
              type: nextM.milestone_type,
              label: MILESTONE_LABELS[nextM.milestone_type] || nextM.milestone_type,
              target_date: nextM.target_date,
              status: nextM.status,
            }
          : null,
        overdue_milestones: overdue,
        milestones: milestonesList.map((m) => ({
          milestone_type: m.milestone_type,
          status: m.status,
          target_date: m.target_date,
          actual_date: m.actual_date,
        })),
      };
    });
  }, [currentAgentTransactions, todayStr]);

  const { subject, html, text } = renderAgentDigestEmail({
    agentName: activeAgentName || 'Agent',
    agentEmail: recipientEmail,
    transactions: singleAgentDigestItems,
    frequencyName: 'Weekly',
  });

  // Send single agent email
  const handleSendSingleAgentEmail = async () => {
    setIsSending(true);
    setSendResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('weekly-agent-digest', {
        body: {
          agent_name: activeAgentName,
          agent_email: recipientEmail,
        },
      });

      if (error) throw error;

      if (data?.summary?.emails_sent > 0) {
        setSendResult({
          type: 'success',
          message: `Email update successfully dispatched to ${recipientEmail}!`,
        });
      } else {
        setSendResult({
          type: 'warning',
          message: `Digest generated with ${currentAgentTransactions.length} deals. Note: If RESEND_API_KEY is not set in Supabase, use the 'Open Mail App' or 'Copy Text' options below to send immediately!`,
        });
      }
    } catch (err: any) {
      console.warn('Digest invoke result:', err);
      setSendResult({
        type: 'warning',
        message: `Digest generated for ${activeAgentName} (${recipientEmail})! Use 'Open Mail App' or 'Copy HTML/Text' to send directly.`,
      });
    } finally {
      setIsSending(false);
    }
  };

  // Send to all selected agents
  const handleSendAllSelectedAgents = async () => {
    if (selectedAgentNames.size === 0) {
      alert('Please select at least one agent to email.');
      return;
    }

    const agentsToSend = agentGroups
      .filter((g) => selectedAgentNames.has(g.name))
      .map((g) => ({
        id: g.id,
        name: g.name,
        email: g.email,
      }));

    setIsSending(true);
    setSendResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('weekly-agent-digest', {
        body: {
          target_agents: agentsToSend,
        },
      });

      if (error) throw error;

      const summary = data?.summary;
      const statusMap: Record<string, { status: 'sent' | 'skipped' | 'failed'; messageId?: string; error?: string }> = {};

      if (summary?.dispatches) {
        summary.dispatches.forEach((d: any) => {
          statusMap[d.agent_name] = {
            status: d.status,
            messageId: d.resend_message_id,
            error: d.error,
          };
        });
        setAgentSendStatuses(statusMap);
      }

      if (summary?.emails_sent > 0) {
        setSendResult({
          type: 'success',
          message: `Broadcast complete! Successfully dispatched updates to ${summary.emails_sent} agents (${summary.agents_skipped_zero_deals} skipped with 0 deals).`,
        });
      } else {
        setSendResult({
          type: 'warning',
          message: `Prepared updates for ${agentsToSend.length} agents. Notice: RESEND_API_KEY can be configured in Supabase secrets for instant cloud delivery, or preview/open drafts individually below.`,
        });
      }
    } catch (err: any) {
      console.error('Batch digest invoke error:', err);
      setSendResult({
        type: 'warning',
        message: `Batch payload generated for ${agentsToSend.length} agents. You can also preview and send to individual agents using the Preview buttons below.`,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenMailClient = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(text)}`;
    window.open(mailtoUrl, '_blank');
  };

  const handleCopy = (content: string, type: 'html' | 'text') => {
    navigator.clipboard.writeText(content);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#1e293b] border border-[#334155] rounded-3xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-[#131826] border-b border-[#334155] flex items-center justify-between">
          <div className="flex items-center gap-3">
            {viewMode === 'single' && isInitialAll && (
              <button
                onClick={() => {
                  setViewMode('all');
                  setSendResult(null);
                }}
                className="p-2 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-[#94a3b8] hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold"
                title="Back to all agents roster"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">All Agents</span>
              </button>
            )}

            <div className="p-2.5 rounded-2xl bg-[#d97706]/15 border border-[#d97706]/30 text-[#d97706]">
              {viewMode === 'all' ? <Users className="h-6 w-6" /> : <Mail className="h-6 w-6" />}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#d97706]">
                  {viewMode === 'all' ? 'Team Broadcast Dispatch' : 'Agent Transaction Update'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  {viewMode === 'all' ? `${agentGroups.length} Active Agents` : `${currentAgentTransactions.length} Deals`}
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#f8fafc]">
                {viewMode === 'all'
                  ? 'Send File Update Emails to All Agents'
                  : `Email Overview for ${activeAgentName || 'Agent'}`}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {viewMode === 'single' && isInitialAll && (
              <button
                onClick={() => {
                  setViewMode('all');
                  setSendResult(null);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-xs font-bold text-[#94a3b8] hover:text-white transition-all"
              >
                View All Agents
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-[#94a3b8] hover:text-white transition-all"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* Status Feedback banner */}
          {sendResult && (
            <div
              className={`p-4 rounded-2xl text-xs font-semibold flex items-start gap-3 border ${
                sendResult.type === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              }`}
            >
              {sendResult.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <span>{sendResult.message}</span>
              </div>
            </div>
          )}

          {/* VIEW MODE: ALL AGENTS */}
          {viewMode === 'all' ? (
            <div className="space-y-5">
              {/* Summary Metrics Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-[#131826] rounded-2xl border border-[#334155]">
                  <span className="text-[11px] text-[#94a3b8] block font-medium uppercase tracking-wider">
                    Agents With Active Files
                  </span>
                  <span className="font-mono-code text-xl font-bold text-sky-400">
                    {agentGroups.length} Agents
                  </span>
                </div>

                <div className="p-3.5 bg-[#131826] rounded-2xl border border-[#334155]">
                  <span className="text-[11px] text-[#94a3b8] block font-medium uppercase tracking-wider">
                    Total Active Files
                  </span>
                  <span className="font-mono-code text-xl font-bold text-[#d97706]">
                    {transactions.length} Files
                  </span>
                </div>

                <div className="p-3.5 bg-[#131826] rounded-2xl border border-[#334155]">
                  <span className="text-[11px] text-[#94a3b8] block font-medium uppercase tracking-wider">
                    Selected for Email
                  </span>
                  <span className="font-mono-code text-xl font-bold text-emerald-400">
                    {selectedAgentNames.size} of {agentGroups.length}
                  </span>
                </div>
              </div>

              {/* Controls bar: Search + Select All */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search agents by name or email..."
                    className="w-full pl-9 pr-3 py-2 bg-[#131826] border border-[#334155] rounded-xl text-xs font-semibold text-[#f8fafc] placeholder-[#94a3b8] focus:outline-none focus:border-[#d97706]"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-1.5 rounded-lg bg-[#131826] hover:bg-[#334155] border border-[#334155] text-xs font-bold text-[#94a3b8] hover:text-white transition-all flex items-center gap-1.5"
                  >
                    <CheckSquare className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Select All</span>
                  </button>

                  <button
                    onClick={handleDeselectAll}
                    className="px-3 py-1.5 rounded-lg bg-[#131826] hover:bg-[#334155] border border-[#334155] text-xs font-bold text-[#94a3b8] hover:text-white transition-all flex items-center gap-1.5"
                  >
                    <Square className="h-3.5 w-3.5 text-slate-400" />
                    <span>Deselect All</span>
                  </button>
                </div>
              </div>

              {/* Agent Roster List */}
              <div className="bg-[#0f172a] border border-[#334155] rounded-2xl p-2 max-h-96 overflow-y-auto divide-y divide-[#1e293b]">
                {filteredAgentGroups.length === 0 ? (
                  <div className="p-8 text-center text-[#94a3b8] text-xs">
                    No agents match your search filter.
                  </div>
                ) : (
                  filteredAgentGroups.map((agent) => {
                    const isChecked = selectedAgentNames.has(agent.name);
                    const statusInfo = agentSendStatuses[agent.name];

                    return (
                      <div
                        key={agent.name}
                        className={`p-3 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                          isChecked ? 'bg-[#1e293b]/60' : 'bg-transparent opacity-70'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleAgent(agent.name)}
                            className="h-4 w-4 rounded border-[#334155] text-[#d97706] focus:ring-[#d97706] focus:ring-offset-0 bg-[#131826] cursor-pointer"
                          />

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-[#f8fafc] truncate">
                                {agent.name}
                              </span>

                              {agent.overdueCount > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  <span>{agent.overdueCount} Overdue</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                                  On Schedule
                                </span>
                              )}

                              {statusInfo && (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    statusInfo.status === 'sent'
                                      ? 'bg-emerald-500 text-[#0f172a]'
                                      : statusInfo.status === 'skipped'
                                      ? 'bg-amber-500 text-[#0f172a]'
                                      : 'bg-red-500 text-white'
                                  }`}
                                >
                                  {statusInfo.status.toUpperCase()}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-[#94a3b8] truncate font-mono-code">
                              {agent.email} • {agent.totalDeals} deal{agent.totalDeals === 1 ? '' : 's'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handlePreviewAgent(agent)}
                            className="px-3 py-1.5 rounded-xl bg-[#131826] hover:bg-[#334155] border border-[#334155] text-sky-400 hover:text-sky-300 text-xs font-bold flex items-center gap-1.5 transition-all"
                            title="Preview and customize email for this agent"
                          >
                            <FileText className="h-3.5 w-3.5 text-sky-400" />
                            <span>Preview</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* VIEW MODE: SINGLE AGENT PREVIEW */
            <div className="space-y-5">
              {/* Target Email and Subject Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1.5">
                    Recipient Email Address
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#131826] border border-[#334155] rounded-xl text-sm font-semibold text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1.5">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={subject}
                    className="w-full px-4 py-2.5 bg-[#131826]/70 border border-[#334155] rounded-xl text-xs font-semibold text-[#94a3b8]"
                  />
                </div>
              </div>

              {/* Email Content Preview Card */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-[#94a3b8] uppercase flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-[#d97706]" />
                    <span>Live Email Preview ({currentAgentTransactions.length} Deals)</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(html, 'html')}
                      className="px-3 py-1 bg-[#131826] hover:bg-[#334155] border border-[#334155] text-xs text-sky-400 font-bold rounded-lg flex items-center gap-1 transition-all"
                    >
                      {copiedType === 'html' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>Copy HTML</span>
                    </button>
                    <button
                      onClick={() => handleCopy(text, 'text')}
                      className="px-3 py-1 bg-[#131826] hover:bg-[#334155] border border-[#334155] text-xs text-emerald-400 font-bold rounded-lg flex items-center gap-1 transition-all"
                    >
                      {copiedType === 'text' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>Copy Text</span>
                    </button>
                  </div>
                </div>

                <div className="bg-[#0f172a] border border-[#334155] rounded-2xl p-4 max-h-96 overflow-y-auto">
                  <div dangerouslySetInnerHTML={{ __html: html }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-[#131826] border-t border-[#334155] flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[#334155] hover:bg-[#475569] text-white text-xs font-semibold transition-all"
          >
            Close
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            {viewMode === 'all' ? (
              <button
                onClick={handleSendAllSelectedAgents}
                disabled={isSending || selectedAgentNames.size === 0}
                className="px-5 py-2.5 rounded-xl bg-[#d97706] hover:bg-[#b45309] text-[#0f172a] font-extrabold text-xs flex items-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-[#d97706]/20 disabled:opacity-50 cursor-pointer"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#0f172a]" />
                ) : (
                  <Send className="h-4 w-4 text-[#0f172a]" />
                )}
                <span>Send Updates to {selectedAgentNames.size} Selected Agents</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleOpenMailClient}
                  className="px-4 py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-xs font-bold flex items-center gap-2 transition-all active:scale-[0.98]"
                  title="Open pre-filled draft in Outlook / Apple Mail / Gmail"
                >
                  <ExternalLink className="h-4 w-4 text-sky-400" />
                  <span>Open Mail App</span>
                </button>

                <button
                  onClick={handleSendSingleAgentEmail}
                  disabled={isSending}
                  className="px-5 py-2.5 rounded-xl bg-[#d97706] hover:bg-[#b45309] text-[#0f172a] font-extrabold text-xs flex items-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-[#d97706]/20 disabled:opacity-50 cursor-pointer"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#0f172a]" />
                  ) : (
                    <Send className="h-4 w-4 text-[#0f172a]" />
                  )}
                  <span>Send Update to {activeAgentName || 'Agent'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
