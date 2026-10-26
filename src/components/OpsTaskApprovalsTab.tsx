import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../context/AuthContext';
import { OpsTransaction, ALL_MILESTONES_CONFIG } from '../types/ops';
import { parseTaskApproval, encodeTaskApproval, TaskApprovalData } from '../utils/taskApproval';
import confetti from 'canvas-confetti';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  User,
  ShieldCheck,
  Calendar,
  ExternalLink,
  Check,
  X,
  FileText,
  Building,
  RefreshCw,
  Archive,
  ArrowRight,
  Sparkles,
  MessageSquare,
  ChevronRight,
  Send,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

export interface TaskApprovalItem {
  id: string; // milestone id
  transactionId: string;
  milestoneType: string;
  milestoneLabel: string;
  milestoneDescription: string;
  status: string;
  actualDate: string | null;
  targetDate: string | null;
  source: string;
  updatedAt: string;
  cleanNotes: string;
  approvalData: TaskApprovalData;
  transaction: {
    id: string;
    propertyAddress: string;
    city: string;
    state: string;
    zip: string;
    clientName: string;
    clientPhone?: string;
    clientEmail?: string;
    side: 'buyer' | 'seller' | 'dual';
    status: string;
    agentName: string;
    agentEmail?: string;
    tcName: string;
    tcEmail?: string;
  };
}

interface OpsTaskApprovalsTabProps {
  onOpenTransaction: (transactionId: string) => void;
  onMilestoneUpdated?: (transactionId: string, milestoneType: string, newStatus: string) => void;
  activeTransactions?: OpsTransaction[];
  onPendingCountChange?: (count: number) => void;
}

export const OpsTaskApprovalsTab: React.FC<OpsTaskApprovalsTabProps> = ({
  onOpenTransaction,
  onMilestoneUpdated,
  activeTransactions = [],
  onPendingCountChange,
}) => {
  const { currentUser } = useAuth();
  const [items, setItems] = useState<TaskApprovalItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Sub-tabs: 'pending' (Awaiting TC Check) | 'archived' (Marked through / Historical) | 'all'
  const [statusTab, setStatusTab] = useState<'pending' | 'archived' | 'all'>('pending');

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tcFilter, setTcFilter] = useState<string>(() => {
    // If current user is a TC, default to their own queue, otherwise 'All'
    if (currentUser?.role === 'tc' && currentUser?.fullName) {
      return currentUser.fullName;
    }
    return 'All';
  });
  const [agentFilter, setAgentFilter] = useState<string>('All');

  // Action states
  const [actionProcessingId, setActionProcessingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'alert' | 'info' } | null>(null);

  // Revision modal state
  const [revisionItem, setRevisionItem] = useState<TaskApprovalItem | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState<string>('');
  const [isSubmittingRevision, setIsSubmittingRevision] = useState<boolean>(false);

  // Load all task approval milestones from Supabase
  const loadApprovals = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    setIsRefreshing(true);

    try {
      // Query milestones that contain task approval metadata
      const { data, error } = await supabase
        .from('milestones')
        .select(`
          id,
          transaction_id,
          milestone_type,
          status,
          actual_date,
          target_date,
          source,
          notes,
          updated_at,
          transactions (
            id,
            property_address,
            city,
            state,
            zip,
            side,
            status,
            client_name,
            client_phone,
            client_email,
            assigned_tc_id,
            listing_agent_id,
            selling_agent_id
          )
        `)
        .or('notes.ilike.%---MSREG_TASK_APPROVAL---%,notes.ilike.%"approvalStatus"%')
        .order('updated_at', { ascending: false });

      if (error) {
        console.warn('Error loading task approval milestones:', error);
        return;
      }

      if (data) {
        const mappedItems: TaskApprovalItem[] = [];

        for (const row of data as any[]) {
          const { approvalData, cleanNotes } = parseTaskApproval(row.notes);
          if (!approvalData) continue;

          // Find milestone metadata label
          const config = ALL_MILESTONES_CONFIG.find((c) => c.type === row.milestone_type);
          const milestoneLabel = config?.label || row.milestone_type.replace(/_/g, ' ').toUpperCase();
          const milestoneDescription = config?.description || 'Milestone verification submitted by agent.';

          const tx = row.transactions || {};
          const matchedActiveTx = activeTransactions.find((at) => at.id === row.transaction_id);

          const propertyAddress = tx.property_address || matchedActiveTx?.property_address || 'Address Pending';
          const clientName = tx.client_name || matchedActiveTx?.client_name || 'Client';
          const side = (tx.side || matchedActiveTx?.side || 'buyer') as 'buyer' | 'seller' | 'dual';
          const txStatus = tx.status || matchedActiveTx?.status || 'Pending';

          const agentName =
            approvalData.submittedByName ||
            matchedActiveTx?.agent_name ||
            'Submitting Agent';
          const agentEmail =
            approvalData.submittedByEmail ||
            matchedActiveTx?.agent_email ||
            undefined;

          const tcName =
            approvalData.assignedTcName ||
            matchedActiveTx?.tc_name ||
            'Assigned TC';
          const tcEmail =
            approvalData.assignedTcEmail ||
            matchedActiveTx?.tc_email ||
            undefined;

          mappedItems.push({
            id: row.id,
            transactionId: row.transaction_id,
            milestoneType: row.milestone_type,
            milestoneLabel,
            milestoneDescription,
            status: row.status,
            actualDate: row.actual_date,
            targetDate: row.target_date,
            source: row.source,
            updatedAt: row.updated_at,
            cleanNotes,
            approvalData,
            transaction: {
              id: row.transaction_id,
              propertyAddress,
              city: tx.city || matchedActiveTx?.city || '',
              state: tx.state || matchedActiveTx?.state || 'MO',
              zip: tx.zip || matchedActiveTx?.zip || '',
              clientName,
              clientPhone: tx.client_phone || matchedActiveTx?.client_phone || undefined,
              clientEmail: tx.client_email || matchedActiveTx?.client_email || undefined,
              side,
              status: txStatus,
              agentName,
              agentEmail,
              tcName,
              tcEmail,
            },
          });
        }

        setItems(mappedItems);

        const pendingCount = mappedItems.filter(
          (i) => i.approvalData.approvalStatus === 'pending_tc_approval'
        ).length;
        onPendingCountChange?.(pendingCount);
      }
    } catch (err) {
      console.warn('Failed to load approvals:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTransactions, onPendingCountChange]);

  // Initial fetch and Realtime subscription
  useEffect(() => {
    loadApprovals();

    const channel = supabase
      .channel('realtime_task_approvals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'milestones' }, () => {
        loadApprovals(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadApprovals]);

  // Distinct TC & Agent list for filters
  const distinctTcs = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.transaction.tcName && item.transaction.tcName !== 'Unassigned TC') {
        set.add(item.transaction.tcName);
      }
      if (item.approvalData.assignedTcName) {
        set.add(item.approvalData.assignedTcName);
      }
    });
    return Array.from(set).sort();
  }, [items]);

  const distinctAgents = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      if (item.approvalData.submittedByName) {
        set.add(item.approvalData.submittedByName);
      }
      if (item.transaction.agentName) {
        set.add(item.transaction.agentName);
      }
    });
    return Array.from(set).sort();
  }, [items]);

  // Metrics counts
  const pendingCount = useMemo(() => {
    return items.filter((i) => i.approvalData.approvalStatus === 'pending_tc_approval').length;
  }, [items]);

  const archivedCount = useMemo(() => {
    return items.filter(
      (i) => i.approvalData.approvalStatus === 'approved' || i.approvalData.approvalStatus === 'changes_requested'
    ).length;
  }, [items]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const isPending = item.approvalData.approvalStatus === 'pending_tc_approval';
      const isArchived =
        item.approvalData.approvalStatus === 'approved' ||
        item.approvalData.approvalStatus === 'changes_requested';

      // Status tab filter
      if (statusTab === 'pending' && !isPending) return false;
      if (statusTab === 'archived' && !isArchived) return false;

      // TC filter
      if (tcFilter !== 'All') {
        const itemTcName = item.approvalData.assignedTcName || item.transaction.tcName;
        if (itemTcName.toLowerCase() !== tcFilter.toLowerCase()) return false;
      }

      // Agent filter
      if (agentFilter !== 'All') {
        const itemAgent = item.approvalData.submittedByName || item.transaction.agentName;
        if (itemAgent.toLowerCase() !== agentFilter.toLowerCase()) return false;
      }

      // Search query (matches address, client, agent, or milestone label)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const address = item.transaction.propertyAddress.toLowerCase();
        const client = item.transaction.clientName.toLowerCase();
        const agent = (item.approvalData.submittedByName || item.transaction.agentName).toLowerCase();
        const milestone = item.milestoneLabel.toLowerCase();
        const details = item.approvalData.details.toLowerCase();
        if (
          !address.includes(q) &&
          !client.includes(q) &&
          !agent.includes(q) &&
          !milestone.includes(q) &&
          !details.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [items, statusTab, tcFilter, agentFilter, searchQuery]);

  // TC Approves Task
  const handleApprove = async (item: TaskApprovalItem, customNote?: string) => {
    setActionProcessingId(item.id);
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];

    const updatedApproval: TaskApprovalData = {
      ...item.approvalData,
      approvalStatus: 'approved',
      tcReviewedBy: currentUser?.fullName || 'Assigned TC',
      tcReviewedAt: nowIso,
      tcNotes: customNote || item.approvalData.tcNotes || 'Verified & approved by TC',
    };

    const encodedNotes = encodeTaskApproval(updatedApproval, item.cleanNotes);

    try {
      const { error } = await (supabase.from('milestones') as any)
        .update({
          status: 'satisfied',
          actual_date: item.actualDate || todayStr,
          notes: encodedNotes,
          updated_at: nowIso,
        })
        .eq('id', item.id);

      if (error) throw error;

      // Celebrate success!
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#10b981', '#34d399', '#6ee7b7', '#f59e0b'],
      });

      // Update local state immediately
      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== item.id) return i;
          return {
            ...i,
            status: 'satisfied',
            actualDate: i.actualDate || todayStr,
            approvalData: updatedApproval,
            updatedAt: nowIso,
          };
        })
      );

      onMilestoneUpdated?.(item.transactionId, item.milestoneType, 'satisfied');

      setToastMessage({
        text: `Approved "${item.milestoneLabel}" for ${item.transaction.propertyAddress}! Archived to history.`,
        type: 'success',
      });
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.warn('Error approving milestone:', err);
      setToastMessage({
        text: `Could not approve milestone: ${err.message || 'database error'}`,
        type: 'alert',
      });
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setActionProcessingId(null);
    }
  };

  // TC Requests Revisions
  const handleConfirmRevision = async () => {
    if (!revisionItem) return;
    if (!revisionFeedback.trim()) {
      alert('Please enter revision notes describing what the agent needs to update.');
      return;
    }

    setIsSubmittingRevision(true);
    const nowIso = new Date().toISOString();

    const updatedApproval: TaskApprovalData = {
      ...revisionItem.approvalData,
      approvalStatus: 'changes_requested',
      tcReviewedBy: currentUser?.fullName || 'Assigned TC',
      tcReviewedAt: nowIso,
      tcNotes: revisionFeedback.trim(),
    };

    const encodedNotes = encodeTaskApproval(updatedApproval, revisionItem.cleanNotes);

    try {
      const { error } = await (supabase.from('milestones') as any)
        .update({
          status: 'pending',
          notes: encodedNotes,
          updated_at: nowIso,
        })
        .eq('id', revisionItem.id);

      if (error) throw error;

      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== revisionItem.id) return i;
          return {
            ...i,
            status: 'pending',
            approvalData: updatedApproval,
            updatedAt: nowIso,
          };
        })
      );

      onMilestoneUpdated?.(revisionItem.transactionId, revisionItem.milestoneType, 'pending');

      setToastMessage({
        text: `Revision requested for "${revisionItem.milestoneLabel}". Notes saved.`,
        type: 'info',
      });
      setTimeout(() => setToastMessage(null), 5000);

      setRevisionItem(null);
      setRevisionFeedback('');
    } catch (err: any) {
      console.warn('Error requesting changes:', err);
      alert(`Could not request revisions: ${err.message}`);
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 shadow-lg animate-in slide-in-from-top-2 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : toastMessage.type === 'alert'
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              : 'bg-sky-500/15 border-sky-500/30 text-sky-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Command Bar & Filters */}
      <div className="bg-[#111726] border border-white/[0.08] rounded-2xl p-5 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <Clock className="h-4 w-4" />
              </span>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <span>Agent Task Verifications</span>
                {pendingCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    {pendingCount} Pending Check
                  </span>
                )}
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Review and approve completed tasks submitted by agents. Approved tasks are archived to history with full lookback.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadApprovals(false)}
              disabled={isRefreshing}
              className="px-3 py-1.5 rounded-xl bg-[#131b2e] hover:bg-[#182238] text-slate-200 border border-white/10 hover:border-white/20 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
              title="Refresh approvals from Supabase"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* View Switcher Tabs: Pending vs Archived History vs All */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
          <div className="flex flex-wrap items-center bg-[#090d16] p-1 rounded-xl border border-white/10 gap-1 text-xs">
            <button
              onClick={() => setStatusTab('pending')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                statusTab === 'pending'
                  ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Pending Review ({pendingCount})</span>
            </button>

            <button
              onClick={() => setStatusTab('archived')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                statusTab === 'archived'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Archive className="h-3.5 w-3.5" />
              <span>Archived & Approved ({archivedCount})</span>
            </button>

            <button
              onClick={() => setStatusTab('all')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                statusTab === 'all'
                  ? 'bg-[#182238] text-white font-semibold border border-white/10 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>All Submissions ({items.length})</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Real-time verification queue</span>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-white/[0.08]">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by address, client, agent, or milestone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#090d16] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400/50"
            />
          </div>

          {/* TC Filter */}
          <div className="flex items-center gap-2 bg-[#090d16] border border-white/10 rounded-xl px-3 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-xs text-slate-400 whitespace-nowrap">TC:</span>
            <select
              value={tcFilter}
              onChange={(e) => setTcFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none w-full cursor-pointer font-medium"
            >
              <option value="All" className="bg-[#111726] text-white">All TCs ({items.length})</option>
              {distinctTcs.map((name) => (
                <option key={name} value={name} className="bg-[#111726] text-white">
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Agent Filter */}
          <div className="flex items-center gap-2 bg-[#090d16] border border-white/10 rounded-xl px-3 py-1.5">
            <User className="h-3.5 w-3.5 text-sky-400 flex-shrink-0" />
            <span className="text-xs text-slate-400 whitespace-nowrap">Agent:</span>
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-200 focus:outline-none w-full cursor-pointer font-medium"
            >
              <option value="All" className="bg-[#111726] text-white">All Agents</option>
              {distinctAgents.map((name) => (
                <option key={name} value={name} className="bg-[#111726] text-white">
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Task Approvals List */}
      {isLoading ? (
        <div className="bg-[#111726] border border-white/[0.08] rounded-2xl p-12 text-center space-y-3">
          <RefreshCw className="h-7 w-7 text-amber-400 animate-spin mx-auto" />
          <p className="text-sm text-slate-300 font-medium">Loading task verifications...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-[#111726] border border-white/[0.08] rounded-2xl p-12 text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto opacity-75" />
          <h3 className="text-base font-bold text-white">
            {statusTab === 'pending'
              ? 'All caught up! No pending agent tasks to verify.'
              : 'No task verifications match your current filters.'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {statusTab === 'pending'
              ? 'When agents submit task completions from My Deals or the Roadmap, they will appear right here for TC approval.'
              : 'Try clearing the search query or switching to All TCs.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isPending = item.approvalData.approvalStatus === 'pending_tc_approval';
            const isApproved = item.approvalData.approvalStatus === 'approved';
            const isChangesRequested = item.approvalData.approvalStatus === 'changes_requested';
            const isProcessing = actionProcessingId === item.id;

            return (
              <div
                key={item.id}
                className={`bg-[#111726] border rounded-2xl p-5 shadow-lg transition-all space-y-4 hover:border-white/20 ${
                  isPending
                    ? 'border-amber-500/40 bg-gradient-to-r from-[#111726] via-[#141b2e] to-[#111726]'
                    : isApproved
                    ? 'border-emerald-500/25 bg-[#0e1626]'
                    : 'border-rose-500/25 bg-[#16121f]'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Status Badge */}
                      {isPending && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 animate-pulse">
                          <Clock className="h-3 w-3" />
                          Pending TC Check
                        </span>
                      )}
                      {isApproved && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3" />
                          Approved & Verified
                        </span>
                      )}
                      {isChangesRequested && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5">
                          <AlertCircle className="h-3 w-3" />
                          Changes Requested
                        </span>
                      )}

                      {/* Milestone Type */}
                      <span className="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-500/20">
                        {item.milestoneLabel}
                      </span>

                      {/* Submission Age */}
                      {item.approvalData.submittedAt && (
                        <span className="text-[11px] text-slate-400">
                          • Submitted {formatDistanceToNow(new Date(item.approvalData.submittedAt), { addSuffix: true })}
                        </span>
                      )}
                    </div>

                    {/* Property Address */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => onOpenTransaction(item.transactionId)}
                        className="text-base sm:text-lg font-bold text-white hover:text-amber-400 transition-colors flex items-center gap-1.5 cursor-pointer text-left"
                      >
                        <Building className="h-4 w-4 text-slate-400" />
                        <span>{item.transaction.propertyAddress}</span>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </button>

                      {item.transaction.clientName && (
                        <span className="text-xs text-slate-400 font-medium">
                          (Client: {item.transaction.clientName})
                        </span>
                      )}

                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {item.transaction.side}
                      </span>
                    </div>
                  </div>

                  {/* Quick Escrow Detail Link */}
                  <button
                    onClick={() => onOpenTransaction(item.transactionId)}
                    className="px-3 py-1.5 rounded-xl bg-[#131b2e] hover:bg-[#182238] border border-white/10 hover:border-white/20 text-xs text-sky-300 font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <span>View Escrow File</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                {/* Submitting Agent & Assigned TC Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 p-3 rounded-xl bg-[#090d16] border border-white/[0.06] text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Submitting Agent</span>
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5 mt-0.5">
                      <User className="h-3 w-3 text-sky-400" />
                      {item.approvalData.submittedByName || item.transaction.agentName}
                    </span>
                    {item.approvalData.submittedByEmail && (
                      <span className="text-[11px] text-slate-400 block truncate">{item.approvalData.submittedByEmail}</span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Assigned TC</span>
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5 mt-0.5">
                      <ShieldCheck className="h-3 w-3 text-amber-400" />
                      {item.approvalData.assignedTcName || item.transaction.tcName}
                    </span>
                    {item.approvalData.assignedTcEmail && (
                      <span className="text-[11px] text-slate-400 block truncate">{item.approvalData.assignedTcEmail}</span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Submitted Date</span>
                    <span className="font-medium text-slate-200 flex items-center gap-1.5 mt-0.5">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      {item.approvalData.submittedAt
                        ? format(new Date(item.approvalData.submittedAt), 'MMM d, yyyy h:mm a')
                        : 'Recent'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block font-medium uppercase tracking-wider">Effective Date</span>
                    <span className="font-mono tabular-nums text-slate-200 flex items-center gap-1.5 mt-0.5">
                      <Calendar className="h-3 w-3 text-emerald-400" />
                      {item.actualDate || item.targetDate || 'Pending'}
                    </span>
                  </div>
                </div>

                {/* Agent Completion Note Card */}
                <div className="p-3.5 rounded-xl bg-[#131d2e]/80 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Agent Proof & Submission Memo:
                    </span>
                    {item.approvalData.documentLink && (
                      <a
                        href={item.approvalData.documentLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        <FileText className="h-3 w-3" />
                        <span>Open Document / Loop</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  <p className="text-xs text-slate-100 whitespace-pre-wrap leading-relaxed bg-[#090d16]/70 p-2.5 rounded-lg border border-white/5 font-medium">
                    {item.approvalData.details || 'No details provided.'}
                  </p>
                </div>

                {/* TC Review Notes (if already reviewed / archived) */}
                {(isApproved || isChangesRequested) && item.approvalData.tcReviewedBy && (
                  <div
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      isApproved
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
                        : 'bg-rose-500/10 border-rose-500/25 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5">
                        {isApproved ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-rose-400" />
                        )}
                        Reviewed by {item.approvalData.tcReviewedBy}
                      </span>
                      {item.approvalData.tcReviewedAt && (
                        <span className="text-[11px] opacity-80">
                          {format(new Date(item.approvalData.tcReviewedAt), 'MMM d, yyyy h:mm a')}
                        </span>
                      )}
                    </div>
                    {item.approvalData.tcNotes && (
                      <p className="text-xs opacity-90 pl-5 whitespace-pre-wrap">
                        {item.approvalData.tcNotes}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/[0.08]">
                  <div className="text-[11px] text-slate-400">
                    Milestone ID: <span className="font-mono">{item.id.slice(0, 8)}</span> • Source: {item.source}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* If pending, show Approve & Request Changes */}
                    {isPending ? (
                      <>
                        <button
                          onClick={() => {
                            setRevisionItem(item);
                            setRevisionFeedback('');
                          }}
                          disabled={isProcessing}
                          className="px-3.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Request Changes</span>
                        </button>

                        <button
                          onClick={() => handleApprove(item)}
                          disabled={isProcessing}
                          className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-500/20 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                          <span>{isProcessing ? 'Verifying...' : 'Approve & Mark Complete'}</span>
                        </button>
                      </>
                    ) : (
                      /* If already archived / approved, allow re-approving or viewing */
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(item, 'Re-verified by TC')}
                          disabled={isProcessing}
                          className="px-3 py-1.5 rounded-xl bg-[#131b2e] hover:bg-[#182238] border border-white/10 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                          title="Re-verify or update confirmation"
                        >
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          <span>Re-Verify</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Revision Request Modal */}
      {revisionItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-200">
          <div
            className="bg-[#0e1726] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-[#171224] to-[#0e1726] flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-max">
                  <AlertCircle className="h-3 w-3" />
                  Request Revisions
                </span>
                <h3 className="text-base font-bold text-white">
                  {revisionItem.milestoneLabel}
                </h3>
                <p className="text-xs text-sky-400 font-semibold">
                  {revisionItem.transaction.propertyAddress}
                </p>
              </div>
              <button
                onClick={() => setRevisionItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-[#090d16] border border-white/5 rounded-xl space-y-1 text-xs">
                <span className="text-slate-400 block font-medium">Agent Submission:</span>
                <p className="text-slate-200 font-medium">
                  {revisionItem.approvalData.details}
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Revision Notes for {revisionItem.approvalData.submittedByName || 'Agent'}:
                </label>
                <textarea
                  rows={4}
                  value={revisionFeedback}
                  onChange={(e) => setRevisionFeedback(e.target.value)}
                  placeholder="Explain what is missing or needs attention (e.g., 'Please upload the signed repair addendum to loop before we can mark satisfied')..."
                  className="w-full bg-[#090d16] border border-white/10 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-400"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-[#090d16] flex items-center justify-end gap-2.5">
              <button
                onClick={() => setRevisionItem(null)}
                disabled={isSubmittingRevision}
                className="px-4 py-2 rounded-xl bg-[#131b2e] hover:bg-[#182238] border border-white/10 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRevision}
                disabled={isSubmittingRevision}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-rose-500/20 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isSubmittingRevision ? 'Sending...' : 'Send Revision Request'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
