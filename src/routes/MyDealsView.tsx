import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../integrations/supabase/client';
import { OpsTransaction, resolveTcForAgent, getAllMilestonesConfig, normalizeTcEmailFromAllowlist } from '../types/ops';
import { MilestoneType, MilestoneStatus } from '../types/database.types';
import { MilestoneDotSequence } from '../components/MilestoneDotSequence';
import { CircularProgressGauge } from '../components/hub/CircularProgressGauge';
import { RoadmapStepCard } from '../components/hub/RoadmapStepCard';
import { TaskCompletionModal } from '../components/hub/TaskCompletionModal';
import {
  parseTaskApproval,
  encodeTaskApproval,
  notifyTcOfTaskSubmission,
  TaskApprovalData,
} from '../utils/taskApproval';
import { GuidesContent } from '../components/hub/GuidesContent';
import { AgentHeadshotModal } from '../components/AgentHeadshotModal';
import { AgentDigestEmailModal } from '../components/AgentDigestEmailModal';
import { AgentFinancialRadar } from '../components/hub/AgentFinancialRadar';
import { getStoredAvatar } from '../utils/avatarStorage';
import {
  Building,
  User,
  Calendar,
  Clock,
  Phone,
  Mail,
  ShieldCheck,
  Search,
  Sparkles,
  Info,
  CheckCircle2,
  Printer,
  Send,
  Loader2,
  Compass,
  Camera,
  ArrowLeft,
  Share2,
  FileSpreadsheet,
  Layers,
  DollarSign,
  ChevronRight,
  ExternalLink,
  FileText,
  Briefcase,
  AlertCircle,
  Check,
  LayoutGrid,
  List,
} from 'lucide-react';
import { HubRoadmapStep, RoadmapTabType, StepStatus } from '../types/hub';

export const MyDealsView: React.FC = () => {
  const { currentUser, isOps, isAdmin } = useAuth();
  const [dealsList, setDealsList] = useState<OpsTransaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sideFilter, setSideFilter] = useState<'all' | 'buyer' | 'seller'>(() => {
    return (sessionStorage.getItem('mydeals_side_filter') as any) || 'all';
  });
  const [activeHubSection, setActiveHubSection] = useState<'deals' | 'financials'>(() => {
    return (sessionStorage.getItem('mydeals_hub_section') as any) || 'deals';
  });
  const [allDealsList, setAllDealsList] = useState<OpsTransaction[]>([]);
  const [selectedTxId, setSelectedTxId] = useState<string | null>(() => {
    return sessionStorage.getItem('mydeals_selected_tx_id') || null;
  });

  // Agent Roster & View As selection (for Admins / TCs)
  const [agentRoster, setAgentRoster] = useState<{
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    role?: string | null;
    category?: string | null;
    avatar_url?: string | null;
  }[]>([]);
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>(() => {
    return sessionStorage.getItem('mydeals_agent_filter') || 'All';
  });

  useEffect(() => {
    sessionStorage.setItem('mydeals_side_filter', sideFilter);
  }, [sideFilter]);

  useEffect(() => {
    if (selectedTxId) {
      sessionStorage.setItem('mydeals_selected_tx_id', selectedTxId);
    } else {
      sessionStorage.removeItem('mydeals_selected_tx_id');
    }
  }, [selectedTxId]);

  useEffect(() => {
    sessionStorage.setItem('mydeals_agent_filter', selectedAgentFilter);
  }, [selectedAgentFilter]);

  useEffect(() => {
    sessionStorage.setItem('mydeals_hub_section', activeHubSection);
  }, [activeHubSection]);

  // Headshot Modal State
  const [isHeadshotModalOpen, setIsHeadshotModalOpen] = useState(false);
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(0);

  // Email Digest Modal State
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailStatusText, setEmailStatusText] = useState<string | null>(null);

  // Roadmap & Detail View State
  const [activeTab, setActiveTab] = useState<RoadmapTabType>('under_contract');
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [activeApprovalModalStep, setActiveApprovalModalStep] = useState<HubRoadmapStep | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Load live agent transactions & agent roster from Supabase
  useEffect(() => {
    async function loadLiveAgentDeals() {
      try {
        const { data: dbAgents } = await (supabase.from('agents') as any)
          .select('id, name, email, phone, role, category')
          .order('name');
        if (dbAgents) {
          setAgentRoster(dbAgents);
        }

        const allFetched: any[] = [];
        let page = 0;
        const pageSize = 1000;

        while (true) {
          const { data: chunk, error } = await supabase
            .from('transactions')
            .select(`
              *,
              listing_agent:agents!transactions_listing_agent_id_fkey(id, name, email, phone),
              selling_agent:agents!transactions_selling_agent_id_fkey(id, name, email, phone),
              assigned_tc:ops_users!transactions_assigned_tc_id_fkey(name, email),
              milestones (*)
            `)
            .order('created_at', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) {
            console.warn('Could not fetch Supabase agent transactions chunk:', error);
            break;
          }

          if (chunk && chunk.length > 0) {
            allFetched.push(...chunk);
          }

          if (!chunk || chunk.length < pageSize) {
            break;
          }
          page++;
        }

        const data = allFetched;

        if (data) {
          const validDeals = data.filter((t: any) => {
            const s = String(t.status || '').toLowerCase().replace(/_/g, ' ').trim();
            if (
              s === 'lost' ||
              s.includes('lost') ||
              s === 'signed' ||
              s.includes('signed') ||
              s.includes('release') ||
              s.includes('cancel') ||
              s.includes('terminate') ||
              s.includes('fell through') ||
              s.includes('archived') ||
              s.includes('appt') ||
              s.includes('pipeline') ||
              s.includes('expired') ||
              s.includes('showing') ||
              s.includes('live listing') ||
              s.includes('listing') ||
              s.includes('1st time')
            ) {
              return false;
            }

            // Deal must be either closed (for financial analytics) OR pending / under contract (for active escrow files)
            const isClosed = s === 'closed' || s.includes('closed') || Boolean(t.custom_fields?.closed_date);
            const isPending =
              s.includes('under contract') ||
              s.includes('pending') ||
              s.includes('escrow') ||
              s.includes('closing') ||
              s.includes('clear to close');

            return isClosed || isPending;
          });

          const allMapped: OpsTransaction[] = validDeals.map((t: any) => {
            const leadAgent = t.side === 'seller' ? (t.listing_agent || t.selling_agent) : (t.selling_agent || t.listing_agent);
            const agentName = leadAgent?.name || t.agent_name || 'Lead Agent';
            const agentEmail = leadAgent?.email || t.agent_email || 'agent@mattsmithrealestategroup.com';
            const fallbackTc = resolveTcForAgent(agentName);
            const tcName = t.assigned_tc?.name || (t.tc_name && t.tc_name !== 'Unassigned TC' ? t.tc_name : fallbackTc.tc_name);
            const tcEmail = normalizeTcEmailFromAllowlist(t.assigned_tc?.email || t.tc_email || fallbackTc.tc_email);

            const isClosed = String(t.status).toLowerCase().trim() === 'closed' || Boolean(t.custom_fields?.closed_date);

            return {
              id: t.id,
              sisu_transaction_id: t.sisu_transaction_id || undefined,
              status: isClosed ? 'closed' : 'Pending',
              property_address: t.property_address,
              city: t.city || 'Waynesville',
              state: t.state || 'MO',
              zip: t.zip || '65583',
              side: t.side,
              client_name: t.client_name,
              client_phone: t.client_phone || undefined,
              other_party_name: t.other_party_name || undefined,
              other_party_agent: t.other_party_agent || undefined,
              other_party_phone: t.other_party_phone || undefined,
              other_party_email: t.other_party_email || undefined,
              other_party_brokerage: t.other_party_brokerage || undefined,
              listing_agent_id: t.listing_agent_id,
              selling_agent_id: t.selling_agent_id,
              assigned_tc_id: t.assigned_tc_id,
              agent_name: agentName,
              agent_email: agentEmail,
              tc_name: tcName,
              tc_email: tcEmail,
              contract_date: t.contract_date || undefined,
              target_closing_date: t.target_closing_date || t.custom_fields?.target_closing_date || t.custom_fields?.forecasted_closing_date || t.custom_fields?.forecasted_closed_date || undefined,
              closed_date: t.closed_date || t.custom_fields?.closed_date || undefined,
              gross_agent_paid_income: t.gross_agent_paid_income ?? t.custom_fields?.gross_agent_paid_income ?? null,
              gci: t.gci ?? t.custom_fields?.gci ?? null,
              commission_rate: t.commission_rate ?? t.custom_fields?.commission_rate ?? null,
              price: t.price ?? t.custom_fields?.price ?? null,
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

          setAllDealsList(allMapped);
          setDealsList(allMapped.filter((t) => t.status !== 'closed'));
        }
      } catch (err) {
        console.warn('Live agent transactions query error:', err);
      }
    }

    loadLiveAgentDeals();

    const channel = supabase
      .channel('realtime_agent_deals_portal')
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
    if (currentUser) {
      if (!isOps && !isAdmin) {
        // Regular Agent: always strictly locked to their own agent identity
        const match = agentRoster.find(
          (a) =>
            (currentUser.email && a.email?.toLowerCase() === currentUser.email.toLowerCase()) ||
            a.name.toLowerCase() === currentUser.fullName?.toLowerCase()
        );
        if (match) {
          setSelectedAgentFilter(match.name);
        } else if (currentUser.fullName) {
          setSelectedAgentFilter(currentUser.fullName);
        }
      } else if (selectedAgentFilter === 'All' && agentRoster.length > 0) {
        // Ops / Admin can initially view All or select any agent
      }
    }
  }, [currentUser, agentRoster, isOps, isAdmin]);

  // Current viewed agent object
  const currentAgentObj = useMemo(() => {
    if (selectedAgentFilter !== 'All') {
      return (
        agentRoster.find((a) => a.name.toLowerCase() === selectedAgentFilter.toLowerCase()) || {
          id: currentUser?.agent_id || currentUser?.id || '',
          name: selectedAgentFilter,
          email: currentUser?.email || '',
          phone: '(573) 261-3113',
          role: 'Sales Specialist',
          category: 'Matt Smith Real Estate Group',
          avatar_url: null,
        }
      );
    }
    return {
      id: currentUser?.id || '',
      name: currentUser?.fullName || 'Matt Smith Team Agent',
      email: currentUser?.email || 'agent@mattsmithrealestategroup.com',
      phone: '(573) 261-3113',
      role: isOps ? 'Operations Team' : 'Lead Specialist',
      category: 'Matt Smith Real Estate Group',
      avatar_url: null,
    };
  }, [selectedAgentFilter, agentRoster, currentUser, isOps]);

  // Current headshot avatar
  const currentAvatar = useMemo(() => {
    return (
      currentAgentObj.avatar_url ||
      getStoredAvatar(currentAgentObj.id, currentAgentObj.email) ||
      null
    );
  }, [currentAgentObj, avatarRefreshKey]);

  // Filter deals to selected agent
  const myDeals = useMemo(() => {
    return dealsList.filter((t) => {
      // If user is Admin or Ops (TC / LC), they can view 'All' or filter to any agent
      if (isOps || isAdmin) {
        if (selectedAgentFilter !== 'All') {
          return t.agent_name.toLowerCase() === selectedAgentFilter.toLowerCase();
        }
        return true;
      }

      // If user is an Agent, STRICTLY restrict to only their assigned transactions
      const userEmail = (currentUser?.email || '').toLowerCase().trim();
      const userName = (currentUser?.fullName || '').toLowerCase().trim();
      const userAgentId = currentUser?.agent_id;

      const matchEmail = Boolean(t.agent_email && t.agent_email.toLowerCase().trim() === userEmail);
      const matchName = Boolean(t.agent_name && t.agent_name.toLowerCase().trim() === userName);
      const matchId = Boolean(userAgentId && (t.listing_agent_id === userAgentId || t.selling_agent_id === userAgentId));

      return matchEmail || matchName || matchId;
    });
  }, [dealsList, selectedAgentFilter, currentUser, isOps, isAdmin]);

  // Filter all deals (including closed historical) to selected agent for Financial Radar
  const agentAllDeals = useMemo(() => {
    return allDealsList.filter((t) => {
      if (isOps || isAdmin) {
        if (selectedAgentFilter !== 'All') {
          return t.agent_name.toLowerCase() === selectedAgentFilter.toLowerCase();
        }
        return true;
      }

      const userEmail = (currentUser?.email || '').toLowerCase().trim();
      const userName = (currentUser?.fullName || '').toLowerCase().trim();
      const userAgentId = currentUser?.agent_id;

      const matchEmail = Boolean(t.agent_email && t.agent_email.toLowerCase().trim() === userEmail);
      const matchName = Boolean(t.agent_name && t.agent_name.toLowerCase().trim() === userName);
      const matchId = Boolean(userAgentId && (t.listing_agent_id === userAgentId || t.selling_agent_id === userAgentId));

      return matchEmail || matchName || matchId;
    });
  }, [allDealsList, selectedAgentFilter, currentUser, isOps, isAdmin]);

  // Filtered by side and search
  const filteredDeals = useMemo(() => {
    return myDeals.filter((tx) => {
      if (sideFilter === 'buyer' && tx.side.toLowerCase() !== 'buyer') return false;
      if (sideFilter === 'seller' && tx.side.toLowerCase() !== 'seller') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchAddr = tx.property_address.toLowerCase().includes(q);
        const matchClient = tx.client_name.toLowerCase().includes(q);
        const matchCity = tx.city.toLowerCase().includes(q);
        const matchSisu = tx.sisu_transaction_id && tx.sisu_transaction_id.toLowerCase().includes(q);
        if (!matchAddr && !matchClient && !matchCity && !matchSisu) return false;
      }
      return true;
    });
  }, [myDeals, sideFilter, searchQuery]);

  // Selected Transaction for Roadmap View
  const selectedTransaction = useMemo(() => {
    if (!selectedTxId) return null;
    return myDeals.find((t) => t.id === selectedTxId) || null;
  }, [selectedTxId, myDeals]);

  // Calculate stats for current agent
  // Calculate stats for current agent
  const agentStats = useMemo(() => {
    const totalActive = myDeals.length;
    const buyerCount = myDeals.filter((d) => d.side.toLowerCase() === 'buyer').length;
    const sellerCount = myDeals.filter((d) => d.side.toLowerCase() === 'seller').length;

    let totalMilestones = 0;
    let completedMilestones = 0;

    myDeals.forEach((d) => {
      const configCount = getAllMilestonesConfig(d.side).length;
      totalMilestones += configCount;
      d.milestones.forEach((m) => {
        if (m.status === 'satisfied' || m.status === 'complete') {
          completedMilestones++;
        }
      });
    });

    const completionRate =
      totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

    return {
      totalActive,
      buyerCount,
      sellerCount,
      completionRate,
      completedMilestones,
      totalMilestones,
    };
  }, [myDeals]);

  // Sync activeTab when selected transaction changes
  useEffect(() => {
    if (selectedTransaction) {
      if (selectedTransaction.side.toLowerCase() === 'seller') {
        setActiveTab('under_contract');
      } else {
        setActiveTab('buyer_roadmap');
      }
    }
  }, [selectedTransaction]);

  // True Contract-to-Close Roadmap Steps for selected transaction (matching ops config and Supabase milestones)
  const currentRoadmapSteps: HubRoadmapStep[] = useMemo(() => {
    if (!selectedTransaction) return [];

    const configMilestones = getAllMilestonesConfig(selectedTransaction.side);
    const category: RoadmapTabType =
      selectedTransaction.side.toLowerCase() === 'seller' ? 'under_contract' : 'buyer_roadmap';

    return configMilestones.map((cfg, idx) => {
      const matchMilestone = selectedTransaction.milestones?.find(
        (m) => m.milestone_type === cfg.type
      );

      let stepStatus: StepStatus = 'pending';
      let date: string | null = null;
      let updatedAt: string | null = null;
      let description = cfg.description;
      let approvalData: TaskApprovalData | null = null;

      if (matchMilestone) {
        const parsed = parseTaskApproval(matchMilestone.notes);
        approvalData = parsed.approvalData;

        if (approvalData?.approvalStatus === 'pending_tc_approval') {
          // Task submitted by agent and awaiting TC approval
          stepStatus = 'in_progress';
        } else if (matchMilestone.status === 'satisfied' || matchMilestone.status === 'complete') {
          stepStatus = 'completed';
        } else if (
          matchMilestone.status === 'in_progress' ||
          matchMilestone.status === 'ordered' ||
          matchMilestone.status === 'notice_sent'
        ) {
          stepStatus = 'in_progress';
        } else if (matchMilestone.status === 'waived' || matchMilestone.status === 'na') {
          stepStatus = 'waived';
        } else {
          stepStatus = 'pending';
        }

        date = matchMilestone.actual_date || matchMilestone.target_date || null;
        if (matchMilestone.updated_at) {
          try {
            updatedAt = new Date(matchMilestone.updated_at).toLocaleDateString('en-US');
          } catch {
            updatedAt = matchMilestone.updated_at;
          }
        }
        if (parsed.cleanNotes && parsed.cleanNotes.trim()) {
          description = `${cfg.description} — ${parsed.cleanNotes.trim()}`;
        }
      }

      return {
        id: cfg.type,
        roadmapCategory: category,
        title: cfg.label,
        description,
        status: stepStatus,
        date,
        updatedAt,
        order: idx + 1,
        notes: matchMilestone?.notes || null,
        approvalData,
      };
    });
  }, [selectedTransaction]);

  // Calculate completion percentage for currently selected transaction
  const transactionProgress = useMemo(() => {
    if (!selectedTransaction || currentRoadmapSteps.length === 0) return 0;
    const completed = currentRoadmapSteps.filter((s) => s.status === 'completed').length;
    return Math.round((completed / currentRoadmapSteps.length) * 100);
  }, [selectedTransaction, currentRoadmapSteps]);

  // Active step highlight: defaults to first in_progress or first pending step
  const highlightedStepId = useMemo(() => {
    if (activeStepId) return activeStepId;
    const inProg = currentRoadmapSteps.find((s) => s.status === 'in_progress');
    if (inProg) return inProg.id;
    const firstPending = currentRoadmapSteps.find((s) => s.status === 'pending');
    return firstPending ? firstPending.id : null;
  }, [activeStepId, currentRoadmapSteps]);

  // Submit task completion details to assigned TC for final approval
  const handleSubmitForApproval = async (data: {
    details: string;
    completionDate: string;
    documentLink?: string;
  }) => {
    if (!selectedTransaction || !activeApprovalModalStep) return;

    const stepId = activeApprovalModalStep.id;
    const nowIso = new Date().toISOString();
    const existingMilestone = selectedTransaction.milestones?.find(
      (m) => m.milestone_type === stepId
    );

    const tcInfo = resolveTcForAgent(selectedTransaction.agent_name);
    const assignedTcName =
      selectedTransaction.tc_name && selectedTransaction.tc_name !== 'Unassigned TC'
        ? selectedTransaction.tc_name
        : tcInfo.tc_name;
    const assignedTcEmail = normalizeTcEmailFromAllowlist(
      selectedTransaction.tc_email || tcInfo.tc_email
    );

    const approvalData: TaskApprovalData = {
      approvalStatus: 'pending_tc_approval',
      details: data.details,
      submittedByName: currentUser?.fullName || selectedTransaction.agent_name || 'Agent',
      submittedByEmail: currentUser?.email || selectedTransaction.agent_email,
      submittedAt: nowIso,
      assignedTcName,
      assignedTcEmail,
      documentLink: data.documentLink,
    };

    const encodedNotes = encodeTaskApproval(approvalData, existingMilestone?.notes);

    const updateTransactionList = (list: OpsTransaction[]) =>
      list.map((tx) => {
        if (tx.id !== selectedTransaction.id) return tx;
        const idx = tx.milestones.findIndex((m) => m.milestone_type === stepId);
        let updatedMilestones = [...tx.milestones];
        if (idx >= 0) {
          updatedMilestones[idx] = {
            ...updatedMilestones[idx],
            status: 'in_progress',
            actual_date: data.completionDate,
            notes: encodedNotes,
            updated_at: nowIso,
          };
        } else {
          updatedMilestones.push({
            id: `temp-${stepId}-${Date.now()}`,
            transaction_id: tx.id,
            milestone_type: stepId as MilestoneType,
            target_date: null,
            actual_date: data.completionDate,
            status: 'in_progress',
            source: 'manual',
            notes: encodedNotes,
            updated_at: nowIso,
          });
        }
        return { ...tx, milestones: updatedMilestones };
      });

    setDealsList(updateTransactionList);
    setAllDealsList(updateTransactionList);

    // Persist to Supabase
    try {
      if (existingMilestone && existingMilestone.id && !existingMilestone.id.startsWith('temp-')) {
        await (supabase.from('milestones') as any)
          .update({
            status: 'in_progress',
            actual_date: data.completionDate,
            notes: encodedNotes,
            updated_at: nowIso,
          })
          .eq('id', existingMilestone.id);
      } else {
        await (supabase.from('milestones') as any).insert({
          transaction_id: selectedTransaction.id,
          milestone_type: stepId,
          status: 'in_progress',
          source: 'manual',
          actual_date: data.completionDate,
          notes: encodedNotes,
          updated_at: nowIso,
        });
      }
    } catch (err) {
      console.error('Error persisting task submission to Supabase:', err);
    }

    // Dispatch automated email notification to assigned TC
    if (assignedTcEmail) {
      try {
        const notifyResult = await notifyTcOfTaskSubmission({
          tcName: assignedTcName,
          tcEmail: assignedTcEmail,
          agentName: currentUser?.fullName || selectedTransaction.agent_name || 'Agent',
          agentEmail: currentUser?.email || selectedTransaction.agent_email,
          propertyAddress: selectedTransaction.property_address,
          taskTitle: activeApprovalModalStep.title,
          details: data.details,
          completionDate: data.completionDate,
          transactionId: selectedTransaction.id,
        });

        if (notifyResult?.success) {
          setActionSuccessMessage(`Submitted! Notification email delivered to ${assignedTcName} (${assignedTcEmail}).`);
        } else {
          setActionSuccessMessage(`Submitted! Awaiting ${assignedTcName}'s final approval.`);
        }
      } catch (err) {
        console.warn('Could not dispatch TC notification:', err);
        setActionSuccessMessage(`Submitted! Awaiting ${assignedTcName}'s final approval.`);
      }
    } else {
      setActionSuccessMessage(`Submitted! Awaiting ${assignedTcName}'s final approval.`);
    }

    setTimeout(() => setActionSuccessMessage(null), 5000);
  };

  // TC Final Approval - marks milestone as satisfied / complete
  const handleApproveByTc = async (stepIdOrNotes?: string) => {
    if (!selectedTransaction) return;

    const step =
      activeApprovalModalStep ||
      currentRoadmapSteps.find((s) => s.id === stepIdOrNotes);
    if (!step) return;

    const stepId = step.id;
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];
    const existingMilestone = selectedTransaction.milestones?.find(
      (m) => m.milestone_type === stepId
    );

    const prevApproval = parseTaskApproval(existingMilestone?.notes).approvalData;
    const tcNotes =
      typeof stepIdOrNotes === 'string' && stepIdOrNotes !== stepId
        ? stepIdOrNotes
        : undefined;

    const updatedApproval: TaskApprovalData = {
      ...(prevApproval || {
        details: 'Approved by TC',
        submittedByName: selectedTransaction.agent_name || 'Agent',
        submittedAt: nowIso,
      }),
      approvalStatus: 'approved',
      tcReviewedBy: currentUser?.fullName || 'Assigned TC',
      tcReviewedAt: nowIso,
      tcNotes: tcNotes || prevApproval?.tcNotes,
    };

    const encodedNotes = encodeTaskApproval(updatedApproval, existingMilestone?.notes);

    const updateTransactionList = (list: OpsTransaction[]) =>
      list.map((tx) => {
        if (tx.id !== selectedTransaction.id) return tx;
        const idx = tx.milestones.findIndex((m) => m.milestone_type === stepId);
        let updatedMilestones = [...tx.milestones];
        if (idx >= 0) {
          updatedMilestones[idx] = {
            ...updatedMilestones[idx],
            status: 'satisfied',
            actual_date: todayStr,
            notes: encodedNotes,
            updated_at: nowIso,
          };
        } else {
          updatedMilestones.push({
            id: `temp-${stepId}-${Date.now()}`,
            transaction_id: tx.id,
            milestone_type: stepId as MilestoneType,
            target_date: null,
            actual_date: todayStr,
            status: 'satisfied',
            source: 'manual',
            notes: encodedNotes,
            updated_at: nowIso,
          });
        }
        return { ...tx, milestones: updatedMilestones };
      });

    setDealsList(updateTransactionList);
    setAllDealsList(updateTransactionList);

    try {
      if (existingMilestone && existingMilestone.id && !existingMilestone.id.startsWith('temp-')) {
        await (supabase.from('milestones') as any)
          .update({
            status: 'satisfied',
            actual_date: todayStr,
            notes: encodedNotes,
            updated_at: nowIso,
          })
          .eq('id', existingMilestone.id);
      } else {
        await (supabase.from('milestones') as any).insert({
          transaction_id: selectedTransaction.id,
          milestone_type: stepId,
          status: 'satisfied',
          source: 'manual',
          actual_date: todayStr,
          notes: encodedNotes,
          updated_at: nowIso,
        });
      }
    } catch (err) {
      console.error('Error approving milestone in Supabase:', err);
    }

    setActionSuccessMessage(`Task approved and marked Complete!`);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  // TC Request Changes - returns task to pending with feedback notes
  const handleRequestChangesByTc = async (tcFeedback: string) => {
    if (!selectedTransaction || !activeApprovalModalStep) return;

    const stepId = activeApprovalModalStep.id;
    const nowIso = new Date().toISOString();
    const existingMilestone = selectedTransaction.milestones?.find(
      (m) => m.milestone_type === stepId
    );

    const prevApproval = parseTaskApproval(existingMilestone?.notes).approvalData;

    const updatedApproval: TaskApprovalData = {
      ...(prevApproval || {
        details: 'Changes requested by TC',
        submittedByName: selectedTransaction.agent_name || 'Agent',
        submittedAt: nowIso,
      }),
      approvalStatus: 'changes_requested',
      tcReviewedBy: currentUser?.fullName || 'Assigned TC',
      tcReviewedAt: nowIso,
      tcNotes: tcFeedback,
    };

    const encodedNotes = encodeTaskApproval(updatedApproval, existingMilestone?.notes);

    const updateTransactionList = (list: OpsTransaction[]) =>
      list.map((tx) => {
        if (tx.id !== selectedTransaction.id) return tx;
        const idx = tx.milestones.findIndex((m) => m.milestone_type === stepId);
        let updatedMilestones = [...tx.milestones];
        if (idx >= 0) {
          updatedMilestones[idx] = {
            ...updatedMilestones[idx],
            status: 'pending',
            notes: encodedNotes,
            updated_at: nowIso,
          };
        }
        return { ...tx, milestones: updatedMilestones };
      });

    setDealsList(updateTransactionList);
    setAllDealsList(updateTransactionList);

    try {
      if (existingMilestone && existingMilestone.id && !existingMilestone.id.startsWith('temp-')) {
        await (supabase.from('milestones') as any)
          .update({
            status: 'pending',
            notes: encodedNotes,
            updated_at: nowIso,
          })
          .eq('id', existingMilestone.id);
      }
    } catch (err) {
      console.error('Error recording revision request in Supabase:', err);
    }

    setActionSuccessMessage(`Revision request sent to agent.`);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  // Toggle milestone status between pending and satisfied
  const handleToggleStepStatus = async (stepId: string) => {
    if (!selectedTransaction) return;

    const currentStep = currentRoadmapSteps.find((s) => s.id === stepId);
    if (!currentStep) return;

    const isCurrentlyDone = currentStep.status === 'completed';
    const newStatus: MilestoneStatus = isCurrentlyDone ? 'pending' : 'satisfied';
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];

    // Optimistically update local dealsList state
    setDealsList((prevList) =>
      prevList.map((tx) => {
        if (tx.id !== selectedTransaction.id) return tx;

        const idx = tx.milestones.findIndex((m) => m.milestone_type === stepId);
        let updatedMilestones = [...tx.milestones];

        if (idx >= 0) {
          updatedMilestones[idx] = {
            ...updatedMilestones[idx],
            status: newStatus,
            actual_date: isCurrentlyDone ? null : todayStr,
            updated_at: nowIso,
          };
        } else {
          updatedMilestones.push({
            id: `temp-${stepId}-${Date.now()}`,
            transaction_id: tx.id,
            milestone_type: stepId as MilestoneType,
            target_date: null,
            actual_date: isCurrentlyDone ? null : todayStr,
            status: newStatus,
            source: 'manual',
            notes: null,
            updated_at: nowIso,
          });
        }

        return {
          ...tx,
          milestones: updatedMilestones,
        };
      })
    );

    // Persist to Supabase
    try {
      const existing = selectedTransaction.milestones.find(
        (m) => m.milestone_type === stepId
      );

      if (existing && existing.id && !existing.id.startsWith('temp-')) {
        await (supabase.from('milestones') as any)
          .update({
            status: newStatus,
            actual_date: isCurrentlyDone ? null : todayStr,
            updated_at: nowIso,
          })
          .eq('id', existing.id);
      } else {
        await (supabase.from('milestones') as any).insert({
          transaction_id: selectedTransaction.id,
          milestone_type: stepId,
          status: newStatus,
          source: 'manual',
          actual_date: isCurrentlyDone ? null : todayStr,
          updated_at: nowIso,
        });
      }
    } catch (err) {
      console.error('Error toggling milestone status:', err);
    }
  };

  // Update milestone target or actual date
  const handleStepDateChange = async (stepId: string, newDate: string) => {
    if (!selectedTransaction) return;
    const nowIso = new Date().toISOString();

    setDealsList((prevList) =>
      prevList.map((tx) => {
        if (tx.id !== selectedTransaction.id) return tx;

        const idx = tx.milestones.findIndex((m) => m.milestone_type === stepId);
        let updatedMilestones = [...tx.milestones];

        if (idx >= 0) {
          updatedMilestones[idx] = {
            ...updatedMilestones[idx],
            target_date: newDate,
            actual_date: newDate,
            updated_at: nowIso,
          };
        } else {
          updatedMilestones.push({
            id: `temp-${stepId}-${Date.now()}`,
            transaction_id: tx.id,
            milestone_type: stepId as MilestoneType,
            target_date: newDate,
            actual_date: newDate,
            status: 'pending',
            source: 'manual',
            notes: null,
            updated_at: nowIso,
          });
        }

        return {
          ...tx,
          milestones: updatedMilestones,
        };
      })
    );

    try {
      const existing = selectedTransaction.milestones.find(
        (m) => m.milestone_type === stepId
      );

      if (existing && existing.id && !existing.id.startsWith('temp-')) {
        await (supabase.from('milestones') as any)
          .update({
            target_date: newDate,
            actual_date: newDate,
            updated_at: nowIso,
          })
          .eq('id', existing.id);
      } else {
        await (supabase.from('milestones') as any).insert({
          transaction_id: selectedTransaction.id,
          milestone_type: stepId,
          status: 'pending',
          source: 'manual',
          target_date: newDate,
          actual_date: newDate,
          updated_at: nowIso,
        });
      }
    } catch (err) {
      console.error('Error updating milestone date:', err);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/my-deals?tx=${selectedTransaction?.id}`;
    navigator.clipboard.writeText(url);
    setCopyFeedback('Roadmap link copied to clipboard!');
    setTimeout(() => setCopyFeedback(null), 3500);
  };

  const handleExportCSV = () => {
    const headers = [
      'File ID',
      'Property Address',
      'City',
      'State',
      'Client Name',
      'Representation',
      'Status',
      'Contract Date',
      'Target Close Date',
      'Assigned TC',
    ];

    const rows = filteredDeals.map((t) => [
      `"${t.sisu_transaction_id || t.id}"`,
      `"${t.property_address}"`,
      `"${t.city}"`,
      `"${t.state}"`,
      `"${t.client_name}"`,
      `"${t.side.toUpperCase()} REP"`,
      `"${t.status}"`,
      `"${t.contract_date || ''}"`,
      `"${t.target_closing_date || ''}"`,
      `"${t.tc_name}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `My_Deals_${selectedAgentFilter.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const initials = currentAgentObj.name
    ? currentAgentObj.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'MS';

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans pb-16 selection:bg-amber-500/20 selection:text-amber-200">
      {/* ─────────────────────────────────────────────────────────────────
          VIEW A: AGENT DIRECTORY & PIPELINE DASHBOARD (WHEN NO TX CLICKED)
         ───────────────────────────────────────────────────────────────── */}
      {!selectedTransaction ? (
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Top Brand Header Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold tracking-wider text-amber-500 uppercase font-mono">
                Matt Smith Real Estate Group
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <span>Agent Deals & Workspace</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-400">
                  2.0
                </span>
              </h1>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              {(isOps || isAdmin) && (
                <button
                  onClick={() => setIsEmailModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold flex items-center gap-2 transition-all active:scale-[0.98] shadow-sm cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5 text-amber-400" />
                  <span>
                    {selectedAgentFilter === 'All'
                      ? 'Email Weekly Digest (All)'
                      : `Email Digest to ${selectedAgentFilter}`}
                  </span>
                </button>
              )}

              <button
                onClick={handleExportCSV}
                className="px-3.5 py-1.5 rounded-lg bg-[#111726] hover:bg-[#162035] border border-white/10 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-slate-400" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {emailStatusText && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-semibold text-amber-300 flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="h-4 w-4 text-amber-400 flex-shrink-0" />
              <span>{emailStatusText}</span>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              AGENT COMMAND CENTER HERO
             ───────────────────────────────────────────────────────────── */}
          <div className="bg-[#111726] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Left Column: Agent Profile Card with Clickable Headshot */}
              <div className="lg:col-span-5 flex items-center gap-4">
                {/* Agent Photo with Camera Trigger */}
                <div
                  onClick={() => setIsHeadshotModalOpen(true)}
                  className="relative group cursor-pointer flex-shrink-0"
                  title="Click to update headshot"
                >
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full overflow-hidden border-2 border-amber-500/30 bg-[#162035] shadow-lg flex items-center justify-center transition-all group-hover:border-amber-400">
                    {currentAvatar ? (
                      <img
                        src={currentAvatar}
                        alt={currentAgentObj.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-[#162035] text-amber-400 font-bold text-xl font-mono">
                        {initials}
                      </div>
                    )}
                  </div>
                  {/* Camera overlay */}
                  <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-amber-300">
                    <Camera className="h-4 w-4" />
                    <span className="text-[8px] font-bold uppercase tracking-wider mt-0.5">Edit</span>
                  </div>
                </div>

                {/* Agent Bio & Details */}
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold text-white truncate">
                      {currentAgentObj.name}
                    </h2>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      Verified Agent
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Briefcase className="h-3 w-3 text-slate-500" />
                    <span>{currentAgentObj.role || 'Sales Specialist'}</span>
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-0.5">
                    {currentAgentObj.phone && (
                      <a
                        href={`tel:${currentAgentObj.phone.replace(/[^0-9]/g, '')}`}
                        className="hover:text-amber-400 flex items-center gap-1 transition-colors"
                      >
                        <Phone className="h-3 w-3 text-slate-500" />
                        <span>{currentAgentObj.phone}</span>
                      </a>
                    )}
                    {currentAgentObj.email && (
                      <a
                        href={`mailto:${currentAgentObj.email}`}
                        className="hover:text-amber-400 flex items-center gap-1 transition-colors"
                      >
                        <Mail className="h-3 w-3 text-slate-500" />
                        <span className="truncate max-w-[180px]">{currentAgentObj.email}</span>
                      </a>
                    )}
                  </div>

                  <button
                    onClick={() => setIsHeadshotModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] text-amber-400/90 hover:text-amber-300 pt-0.5 font-medium cursor-pointer"
                  >
                    <Camera className="h-3 w-3" />
                    <span>Upload headshot</span>
                  </button>
                </div>
              </div>

              {/* Center Column: Pipeline Stats */}
              <div className="lg:col-span-4 grid grid-cols-3 gap-2 border-y lg:border-y-0 lg:border-x border-white/10 py-3 lg:py-0 lg:px-6">
                <div className="text-center p-2 rounded-xl bg-[#162035]/50 border border-white/5">
                  <span className="text-xl sm:text-2xl font-bold text-white block tabular-nums">
                    {agentStats.totalActive}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Deals</span>
                </div>
                <div className="text-center p-2 rounded-xl bg-[#162035]/50 border border-white/5">
                  <span className="text-xl sm:text-2xl font-bold text-sky-400 block tabular-nums">
                    {agentStats.buyerCount}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Buyer Rep</span>
                </div>
                <div className="text-center p-2 rounded-xl bg-[#162035]/50 border border-white/5">
                  <span className="text-xl sm:text-2xl font-bold text-amber-400 block tabular-nums">
                    {agentStats.sellerCount}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Seller Rep</span>
                </div>
              </div>

              {/* Right Column: TC View As Switcher (for Admins / TCs) */}
              <div className="lg:col-span-3 space-y-2">
                {(isOps || isAdmin) ? (
                  <div className="bg-[#162035] border border-white/10 rounded-xl p-3 space-y-1.5">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Switch Agent View
                    </label>
                    <select
                      value={selectedAgentFilter}
                      onChange={(e) => setSelectedAgentFilter(e.target.value)}
                      className="w-full bg-[#111726] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="All">All Team Escrows ({dealsList.length})</option>
                      {agentRoster.map((agent) => (
                        <option key={agent.id} value={agent.name}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-500 block">
                      Previewing as agent sees it.
                    </span>
                  </div>
                ) : (
                  <div className="bg-[#162035] border border-white/10 rounded-xl p-3.5 space-y-1 text-center">
                    <span className="text-xs text-slate-400 block">Milestone Velocity</span>
                    <span className="text-2xl font-bold text-emerald-400 tabular-nums">{agentStats.completionRate}%</span>
                    <span className="text-[10px] text-slate-500 block tabular-nums">
                      {agentStats.completedMilestones} of {agentStats.totalMilestones} satisfied
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Navigation Tabs: Active Escrows vs Income & Financials */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2">
            <button
              onClick={() => setActiveHubSection('deals')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeHubSection === 'deals'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Building className="h-3.5 w-3.5" />
              <span>Active Escrow Files</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#162035] text-slate-300 tabular-nums">
                {myDeals.length}
              </span>
            </button>

            <button
              onClick={() => setActiveHubSection('financials')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeHubSection === 'financials'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
              <span>Income & Financials</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Sisu Analytics
              </span>
            </button>
          </div>

          {activeHubSection === 'financials' ? (
            <AgentFinancialRadar
              transactions={agentAllDeals}
              agentName={currentAgentObj.name}
              agentEmail={currentAgentObj.email}
              agentAvatarUrl={currentAvatar}
            />
          ) : (
            /* ─────────────────────────────────────────────────────────────
                DIRECTORY SEARCH & FILTER CONTROLS
               ───────────────────────────────────────────────────────────── */
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-lg">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search address, client, city, or Sisu ID..."
                    className="w-full pl-10 pr-9 py-2 bg-[#111726] border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all shadow-inner"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Side Filter Tabs */}
                  <div className="flex items-center gap-1 bg-[#111726] p-1 rounded-lg border border-white/10">
                    <button
                      onClick={() => setSideFilter('all')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        sideFilter === 'all'
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      All ({myDeals.length})
                    </button>
                    <button
                      onClick={() => setSideFilter('buyer')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        sideFilter === 'buyer'
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Buyer ({agentStats.buyerCount})
                    </button>
                    <button
                      onClick={() => setSideFilter('seller')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        sideFilter === 'seller'
                          ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Seller ({agentStats.sellerCount})
                    </button>
                  </div>

                  {/* Grid vs Table View Mode Switcher */}
                  <div className="flex items-center bg-[#111726] p-1 rounded-lg border border-white/10">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-md transition-all cursor-pointer ${
                        viewMode === 'grid'
                          ? 'bg-white/10 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Grid View"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('table')}
                      className={`p-1.5 rounded-md transition-all cursor-pointer ${
                        viewMode === 'table'
                          ? 'bg-white/10 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Spreadsheet Table View"
                    >
                      <List className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  ACTIVE DEALS LIST / TABLE
                 ───────────────────────────────────────────────────────────── */}
              {filteredDeals.length === 0 ? (
                <div className="bg-[#111726] border border-white/10 rounded-2xl p-10 text-center space-y-3">
                  <Compass className="h-9 w-9 mx-auto text-slate-600" />
                  <h3 className="text-base font-bold text-white">No Active Escrow Files Match</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    No active pending transactions were found matching your current search or side filter.
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="mt-2 px-3 py-1.5 bg-[#162035] hover:bg-slate-700 text-xs font-semibold text-amber-400 rounded-lg transition-colors cursor-pointer"
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              ) : viewMode === 'table' ? (
                /* High-Density Spreadsheet Table View */
                <div className="bg-[#111726] border border-white/10 rounded-xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-white/10 bg-[#162035]/60 text-slate-400 uppercase font-mono text-[10px] tracking-wider">
                          <th className="py-2.5 px-4 font-semibold">Property Address</th>
                          <th className="py-2.5 px-4 font-semibold">Client</th>
                          <th className="py-2.5 px-3 font-semibold">Rep Side</th>
                          <th className="py-2.5 px-3 font-semibold">Milestone Progress</th>
                          <th className="py-2.5 px-4 font-semibold">Target Close</th>
                          <th className="py-2.5 px-4 font-semibold">Assigned TC</th>
                          <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredDeals.map((tx) => {
                          const allConfigs = getAllMilestonesConfig(tx.side);
                          const totalCount = allConfigs.length;
                          const completedCount = tx.milestones.filter(
                            (m) => m.status === 'satisfied' || m.status === 'complete'
                          ).length;
                          const pct = Math.round((completedCount / totalCount) * 100);

                          return (
                            <tr
                              key={tx.id}
                              onClick={() => setSelectedTxId(tx.id)}
                              className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                            >
                              <td className="py-3 px-4">
                                <div className="font-semibold text-white group-hover:text-amber-400 transition-colors">
                                  {tx.property_address}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono">
                                  {tx.city}, {tx.state} • {tx.sisu_transaction_id || tx.id.substring(0, 8)}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-300 font-medium">
                                {tx.client_name}
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    tx.side.toLowerCase() === 'seller'
                                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                      : 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                                  }`}
                                >
                                  {tx.side.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-3 px-3 min-w-[140px]">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-[#162035] rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-emerald-400 rounded-full transition-all"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] font-bold text-emerald-400 font-mono tabular-nums">
                                    {pct}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-300 font-mono tabular-nums text-xs">
                                {tx.target_closing_date || 'TBD'}
                              </td>
                              <td className="py-3 px-4 text-slate-300 text-xs">
                                {tx.tc_name}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 group-hover:text-amber-300">
                                  <span>Open</span>
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Card Grid View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDeals.map((tx) => {
                    const allConfigs = getAllMilestonesConfig(tx.side);
                    const totalCount = allConfigs.length;
                    const completedCount = tx.milestones.filter(
                      (m) => m.status === 'satisfied' || m.status === 'complete'
                    ).length;
                    const pct = Math.round((completedCount / totalCount) * 100);

                    return (
                      <div
                        key={tx.id}
                        onClick={() => setSelectedTxId(tx.id)}
                        className="bg-[#111726] border border-white/10 hover:border-amber-500/40 rounded-xl p-5 shadow-lg transition-all cursor-pointer group flex flex-col justify-between space-y-4"
                      >
                        {/* Top Header Strip */}
                        <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-3">
                          <div className="space-y-0.5">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                tx.side.toLowerCase() === 'seller'
                                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                                  : 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                              }`}
                            >
                              PENDING • {tx.side.toUpperCase()} REP
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono block tabular-nums">
                              File ID: {tx.sisu_transaction_id || tx.id.substring(0, 8)}
                            </span>
                          </div>

                          {/* Completion Gauge Mini */}
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#162035] border border-white/5">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            <span className="text-xs font-bold text-emerald-400 font-mono tabular-nums">
                              {pct}%
                            </span>
                          </div>
                        </div>

                        {/* Main Address Headline */}
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                            {tx.property_address}
                          </h3>
                          <p className="text-xs text-slate-400">
                            {tx.city}, {tx.state} • Client:{' '}
                            <strong className="text-slate-200 font-medium">{tx.client_name}</strong>
                          </p>
                        </div>

                        {/* Milestone Progress Dot Sequence */}
                        <div className="space-y-1 pt-0.5">
                          <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block">
                            Milestone Track
                          </span>
                          <MilestoneDotSequence milestones={tx.milestones} side={tx.side} />
                        </div>

                        {/* Key Dates & Assigned TC */}
                        <div className="grid grid-cols-2 gap-2 text-xs border-t border-white/5 pt-3">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Target Closing</span>
                            <span className="font-semibold text-white font-mono tabular-nums text-xs">
                              {tx.target_closing_date || 'TBD'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Assigned TC</span>
                            <span className="font-semibold text-slate-300 truncate block text-xs">
                              {tx.tc_name}
                            </span>
                          </div>
                        </div>

                        {/* Open Roadmap CTA Button */}
                        <div className="pt-0.5">
                          <button
                            type="button"
                            className="w-full py-2 rounded-lg bg-[#162035] group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-300 text-xs font-semibold transition-all border border-white/10 group-hover:border-amber-500 flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <Compass className="h-3.5 w-3.5" />
                            <span>Open Interactive Roadmap</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────────
           VIEW B: FULL CLIENT PORTAL ROADMAP & TEAM VIEW
           When a transaction is clicked
           ───────────────────────────────────────────────────────────────── */
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Top Return Navigation & Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <button
              onClick={() => setSelectedTxId(null)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#111726] hover:bg-[#162035] border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-sm cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Directory</span>
            </button>

            {/* Quick Switcher dropdown & Actions */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 hidden sm:inline">Switch Deal:</span>
                <select
                  value={selectedTransaction.id}
                  onChange={(e) => setSelectedTxId(e.target.value)}
                  className="bg-[#111726] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-amber-500 cursor-pointer shadow-sm"
                >
                  {myDeals.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.property_address} ({t.client_name})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleCopyLink}
                className="p-1.5 rounded-lg bg-[#111726] hover:bg-[#162035] border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Copy shareable link"
              >
                <Share2 className="h-4 w-4" />
              </button>

              <button
                onClick={() => window.print()}
                className="p-1.5 rounded-lg bg-[#111726] hover:bg-[#162035] border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Print Roadmap"
              >
                <Printer className="h-4 w-4" />
              </button>
            </div>
          </div>

          {copyFeedback && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-300 flex items-center gap-2 animate-in fade-in duration-200">
              <Check className="h-4 w-4 text-emerald-400" />
              <span>{copyFeedback}</span>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TOP COCKPIT HERO CARD
             ───────────────────────────────────────────────────────────── */}
          <div className="bg-[#111726] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Left Column: Agent Profile Card (Cols 1-5) */}
              <div className="md:col-span-5 flex items-center gap-4">
                {/* Agent Photo */}
                <div
                  onClick={() => setIsHeadshotModalOpen(true)}
                  className="relative flex-shrink-0 cursor-pointer group"
                  title="Click to change headshot"
                >
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full overflow-hidden border-2 border-white/10 bg-[#162035] shadow-lg group-hover:border-amber-400 transition-colors">
                    {currentAvatar ? (
                      <img
                        src={currentAvatar}
                        alt={selectedTransaction.agent_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-[#162035] text-amber-400 font-bold text-lg font-mono">
                        {initials}
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-amber-300">
                    <Camera className="h-4 w-4" />
                  </div>
                </div>

                {/* Agent Meta & Quick Actions */}
                <div className="space-y-1 min-w-0">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block">
                      LEAD AGENT
                    </span>
                    <h2 className="text-base sm:text-lg font-bold text-white truncate">
                      {selectedTransaction.agent_name}
                    </h2>
                    <span className="text-xs text-slate-400 block truncate">
                      Matt Smith Real Estate Group
                    </span>
                  </div>

                  {/* Contact Buttons */}
                  <div className="flex items-center gap-2 pt-0.5">
                    {selectedTransaction.tc_email && (
                      <a
                        href={`mailto:${selectedTransaction.tc_email}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#162035] hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors border border-white/10"
                      >
                        <Mail className="h-3 w-3 text-slate-400" />
                        <span>Email TC</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Center Column: Circular Progress Gauge (Cols 6-8) */}
              <div className="md:col-span-3 flex justify-center py-2 md:py-0 border-y md:border-y-0 md:border-x border-white/10">
                <CircularProgressGauge
                  percentage={transactionProgress}
                  size={110}
                  strokeWidth={8}
                />
              </div>

              {/* Right Column: Transaction & Property Card (Cols 9-12) */}
              <div className="md:col-span-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      selectedTransaction.side.toLowerCase() === 'seller'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                    }`}
                  >
                    PENDING • {selectedTransaction.side.toUpperCase()} REP
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                    File: {selectedTransaction.sisu_transaction_id || selectedTransaction.id.slice(0, 8)}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-white line-clamp-1">
                    {selectedTransaction.property_address}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedTransaction.city}, {selectedTransaction.state} {selectedTransaction.zip}
                  </p>
                </div>

                <div className="pt-1 flex items-center justify-between border-t border-white/5 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Target Closing</span>
                    <span className="font-semibold text-white font-mono tabular-nums text-xs">
                      {selectedTransaction.target_closing_date || 'TBD'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Assigned TC</span>
                    <span className="font-semibold text-slate-300 text-xs">
                      {selectedTransaction.tc_name}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              ROADMAP TABS NAVIGATION
             ───────────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              {selectedTransaction.side.toLowerCase() === 'seller' ? (
                <>
                  <button
                    onClick={() => setActiveTab('under_contract')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === 'under_contract'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                        : 'bg-[#111726] text-slate-400 hover:text-white border border-white/10'
                    }`}
                  >
                    Seller Escrow Roadmap ({currentRoadmapSteps.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('listing_guide')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === 'listing_guide'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                        : 'bg-[#111726] text-slate-400 hover:text-white border border-white/10'
                    }`}
                  >
                    Seller Guide & FAQs
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setActiveTab('buyer_roadmap')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === 'buyer_roadmap'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                        : 'bg-[#111726] text-slate-400 hover:text-white border border-white/10'
                    }`}
                  >
                    Buyer Escrow Roadmap ({currentRoadmapSteps.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('buyer_guide')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === 'buyer_guide'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-md'
                        : 'bg-[#111726] text-slate-400 hover:text-white border border-white/10'
                    }`}
                  >
                    Buyer Guide & FAQs
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 tabular-nums">
                {currentRoadmapSteps.filter((s) => s.status === 'completed').length} of{' '}
                {currentRoadmapSteps.length} Steps Completed
              </span>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              MAIN CONTENT: STEP CARDS OR GUIDES
             ───────────────────────────────────────────────────────────── */}
          {activeTab.includes('guide') ? (
            <GuidesContent
              guideType={activeTab === 'listing_guide' ? 'listing_guide' : 'buyer_guide'}
              propertyAddress={selectedTransaction.property_address}
            />
          ) : (
            <div className="space-y-3">
              {currentRoadmapSteps.map((step, idx) => (
                <RoadmapStepCard
                  key={step.id}
                  step={step}
                  isFirst={idx === 0}
                  isLast={idx === currentRoadmapSteps.length - 1}
                  isActive={highlightedStepId === step.id}
                  isOpsOrTc={isOps || isAdmin}
                  onRequestApproval={(step) => setActiveApprovalModalStep(step)}
                  onApproveByTc={(stepId) => handleApproveByTc(stepId)}
                  onToggleStatus={handleToggleStepStatus}
                  onDateChange={handleStepDateChange}
                />
              ))}
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              KEY PARTIES & CONNECTED TEAM
             ───────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-3 border-t border-white/10">
            {/* TC Card */}
            <div className="bg-[#111726] border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Transaction Coordinator
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Operations
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[#162035] text-sky-400 border border-white/10 flex items-center justify-center font-bold text-xs font-mono">
                  {selectedTransaction.tc_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-white text-xs truncate">{selectedTransaction.tc_name}</h4>
                  <span className="text-[11px] text-slate-400 block truncate">Matt Smith Real Estate Group</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-white/5 text-xs">
                {selectedTransaction.tc_email && (
                  <a
                    href={`mailto:${selectedTransaction.tc_email}`}
                    className="flex-1 py-1.5 text-center bg-[#162035] hover:bg-slate-700 rounded-lg text-slate-200 font-medium transition-colors border border-white/5 text-xs"
                  >
                    Email TC
                  </a>
                )}
              </div>
            </div>

            {/* Client Card */}
            <div className="bg-[#111726] border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Client ({selectedTransaction.side.toUpperCase()})
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Active
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[#162035] text-emerald-400 border border-white/10 flex items-center justify-center font-bold text-xs font-mono">
                  {selectedTransaction.client_name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-white text-xs truncate">{selectedTransaction.client_name}</h4>
                  <span className="text-[11px] text-slate-400 block font-mono tabular-nums">
                    {selectedTransaction.client_phone || 'Phone on file'}
                  </span>
                </div>
              </div>
              <div className="pt-1 border-t border-white/5 text-xs">
                {selectedTransaction.client_phone ? (
                  <a
                    href={`tel:${selectedTransaction.client_phone.replace(/[^0-9]/g, '')}`}
                    className="block w-full py-1.5 text-center bg-[#162035] hover:bg-slate-700 rounded-lg text-slate-200 font-medium transition-colors border border-white/5 text-xs"
                  >
                    Call Client
                  </a>
                ) : (
                  <span className="block text-center text-slate-500 py-1.5 text-xs">No direct cell</span>
                )}
              </div>
            </div>

            {/* Co-op Agent Card */}
            <div className="bg-[#111726] border border-white/10 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Co-op Agent
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Other Side ({selectedTransaction.side === 'seller' ? 'Buyer' : 'Seller'})
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[#162035] text-purple-300 border border-white/10 flex items-center justify-center font-bold text-xs font-mono">
                  {selectedTransaction.other_party_agent
                    ? selectedTransaction.other_party_agent.split(' ').map((n) => n[0]).join('').slice(0, 2)
                    : 'CO'}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-white text-xs truncate">
                    {selectedTransaction.other_party_agent || 'Co-op Agent Pending'}
                  </h4>
                  <span className="text-[11px] text-slate-400 block truncate">
                    {selectedTransaction.other_party_brokerage || selectedTransaction.other_party_name || 'Cross Brokerage'}
                  </span>
                </div>
              </div>

              {/* Contact Info */}
              {(selectedTransaction.other_party_phone || selectedTransaction.other_party_email) && (
                <div className="pt-2 border-t border-white/5 space-y-1.5 text-xs">
                  {selectedTransaction.other_party_phone && (
                    <a
                      href={`tel:${selectedTransaction.other_party_phone}`}
                      className="flex items-center gap-2 text-slate-300 hover:text-purple-400 transition-colors font-mono tabular-nums text-[11px]"
                    >
                      <Phone className="h-3 w-3 text-slate-500 flex-shrink-0" />
                      <span>{selectedTransaction.other_party_phone}</span>
                    </a>
                  )}
                  {selectedTransaction.other_party_email && (
                    <a
                      href={`mailto:${selectedTransaction.other_party_email}`}
                      className="flex items-center gap-2 text-slate-300 hover:text-purple-400 transition-colors text-[11px] truncate"
                    >
                      <Mail className="h-3 w-3 text-slate-500 flex-shrink-0" />
                      <span className="truncate">{selectedTransaction.other_party_email}</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          MODALS
         ───────────────────────────────────────────────────────────────── */}
      {/* Headshot Upload / Change Modal */}
      {isHeadshotModalOpen && (
        <AgentHeadshotModal
          isOpen={isHeadshotModalOpen}
          onClose={() => setIsHeadshotModalOpen(false)}
          agentName={currentAgentObj.name}
          agentEmail={currentAgentObj.email}
          agentId={currentAgentObj.id}
          currentAvatarUrl={currentAvatar}
          onAvatarUpdated={() => {
            setAvatarRefreshKey((k) => k + 1);
            setEmailStatusText('Agent headshot updated successfully!');
            setTimeout(() => setEmailStatusText(null), 4000);
          }}
        />
      )}

      {/* Weekly Digest Email Modal (TC/Admin) */}
      {isEmailModalOpen && (
        <AgentDigestEmailModal
          agentName={selectedAgentFilter}
          agentEmail={currentAgentObj.email}
          transactions={myDeals}
          allAgentProfiles={agentRoster}
          onClose={() => setIsEmailModalOpen(false)}
        />
      )}

      {/* Task Completion Approval Modal */}
      {activeApprovalModalStep && selectedTransaction && (
        <TaskCompletionModal
          isOpen={Boolean(activeApprovalModalStep)}
          onClose={() => setActiveApprovalModalStep(null)}
          taskTitle={activeApprovalModalStep.title}
          stepNumber={activeApprovalModalStep.order}
          propertyAddress={selectedTransaction.property_address}
          clientName={selectedTransaction.client_name}
          assignedTcName={
            selectedTransaction.tc_name && selectedTransaction.tc_name !== 'Unassigned TC'
              ? selectedTransaction.tc_name
              : resolveTcForAgent(selectedTransaction.agent_name).tc_name
          }
          assignedTcEmail={
            normalizeTcEmailFromAllowlist(
              selectedTransaction.tc_email ||
              resolveTcForAgent(selectedTransaction.agent_name).tc_email
            )
          }
          currentDate={activeApprovalModalStep.date}
          existingApprovalData={activeApprovalModalStep.approvalData}
          isOpsOrTc={isOps || isAdmin}
          onSubmitForApproval={handleSubmitForApproval}
          onApproveByTc={handleApproveByTc}
          onRequestChangesByTc={handleRequestChangesByTc}
        />
      )}

      {/* Floating Action Success Toast */}
      {actionSuccessMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-5 border border-emerald-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-xs sm:text-sm">{actionSuccessMessage}</span>
        </div>
      )}
    </div>
  );
};
