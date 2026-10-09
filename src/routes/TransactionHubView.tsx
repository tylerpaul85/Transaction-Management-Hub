import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../integrations/supabase/client';
import {
  HubTransactionRecord,
  HubRoadmapStep,
  RoadmapTabType,
  StepStatus,
  HubTeamMember,
} from '../types/hub';
import { resolveTcForAgent, normalizeTcEmailFromAllowlist } from '../types/ops';
import {
  REFERENCE_PORTAL_TRANSACTIONS,
  DEFAULT_SERVICES,
  buildDefaultSellerNewListingRoadmap,
  buildDefaultUnderContractRoadmap,
  buildDefaultBuyerRoadmap,
} from '../data/hubReferenceData';
import { CircularProgressGauge } from '../components/hub/CircularProgressGauge';
import { RoadmapStepCard } from '../components/hub/RoadmapStepCard';
import { AddStepModal } from '../components/hub/AddStepModal';
import { TaskCompletionModal } from '../components/hub/TaskCompletionModal';
import {
  parseTaskApproval,
  encodeTaskApproval,
  notifyTcOfTaskSubmission,
  TaskApprovalData,
} from '../utils/taskApproval';
import { GuidesContent } from '../components/hub/GuidesContent';
import { getStoredAvatar } from '../utils/avatarStorage';
import {
  Search,
  Plus,
  ArrowLeft,
  ChevronDown,
  Info,
  Calendar,
  Phone,
  Mail,
  Building,
  User,
  ShieldCheck,
  FileSpreadsheet,
  Download,
  Share2,
  ExternalLink,
  Layers,
  Sparkles,
  Lock,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  Filter,
  Check,
  MapPin,
  Maximize2,
  Printer,
  Copy,
} from 'lucide-react';

interface TransactionHubViewProps {
  initialTransactionId?: string | null;
  onNavigate?: (path: string) => void;
}

export const TransactionHubView: React.FC<TransactionHubViewProps> = ({
  initialTransactionId,
  onNavigate,
}) => {
  const { currentUser, isOps, isAdmin, isTc } = useAuth();
  const isOpsOrTc = Boolean(isOps || isAdmin || isTc);

  // All transactions (Reference items from screenshot merged with live Supabase deals)
  const [transactions, setTransactions] = useState<HubTransactionRecord[]>(REFERENCE_PORTAL_TRANSACTIONS);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(() => {
    // Check URL search param first, then initialTransactionId; otherwise check sessionStorage or default to null
    const urlParams = new URLSearchParams(window.location.search);
    const paramId = urlParams.get('tx') || urlParams.get('id');
    return paramId || initialTransactionId || sessionStorage.getItem('hub_selected_tx_id') || null;
  });

  useEffect(() => {
    if (selectedTransactionId) {
      sessionStorage.setItem('hub_selected_tx_id', selectedTransactionId);
    } else {
      sessionStorage.removeItem('hub_selected_tx_id');
    }
  }, [selectedTransactionId]);

  // Directory filter states
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>(() => sessionStorage.getItem('hub_status_filter') || 'All');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>(() => sessionStorage.getItem('hub_type_filter') || 'All');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>(() => sessionStorage.getItem('hub_agent_filter') || 'All');
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  useEffect(() => {
    sessionStorage.setItem('hub_status_filter', selectedStatusFilter);
  }, [selectedStatusFilter]);

  useEffect(() => {
    sessionStorage.setItem('hub_type_filter', selectedTypeFilter);
  }, [selectedTypeFilter]);

  useEffect(() => {
    sessionStorage.setItem('hub_agent_filter', selectedAgentFilter);
  }, [selectedAgentFilter]);

  // Hub Detail states
  const [activeTab, setActiveTab] = useState<RoadmapTabType>('new_listing');
  const [orderByDate, setOrderByDate] = useState(false);
  const [activeStepId, setActiveStepId] = useState<string | null>('step-nl-3');

  // Modals state
  const [isAddStepOpen, setIsAddStepOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [activeApprovalModalStep, setActiveApprovalModalStep] = useState<HubRoadmapStep | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Load live Supabase transactions and merge
  useEffect(() => {
    async function loadSupabaseTransactions() {
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select(`
            *,
            listing_agent:agents!transactions_listing_agent_id_fkey(name, email, phone),
            selling_agent:agents!transactions_selling_agent_id_fkey(name, email, phone),
            assigned_tc:ops_users!transactions_assigned_tc_id_fkey(name, email),
            milestones (*)
          `)
          .neq('status', 'Closed')
          .order('created_at', { ascending: false })
          .limit(500);

        if (error) {
          console.warn('Could not load live Supabase transactions in Hub:', error);
          return;
        }

        if (data && data.length > 0) {
          const activeOnly = data.filter((t: any) => {
            const s = String(t.status || '').toLowerCase().replace(/_/g, ' ').trim();
            if (
              s === 'closed' ||
              s.includes('closed') ||
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
            return (
              s.includes('under contract') ||
              s.includes('pending') ||
              s.includes('escrow') ||
              s.includes('closing') ||
              s.includes('clear to close')
            );
          });

          const liveMapped: HubTransactionRecord[] = activeOnly.map((t: any) => {
            const leadAgent = t.side === 'seller' ? (t.listing_agent || t.selling_agent) : (t.selling_agent || t.listing_agent);
            const agentName = leadAgent?.name || t.agent_name || 'Shawn McArthur';
            const agentEmail = leadAgent?.email || t.agent_email || 'agent@mattsmithrealestategroup.com';
            const agentPhone = leadAgent?.phone || '(573) 261-6820';
            const fallbackTc = resolveTcForAgent(agentName);
            const tcName = t.assigned_tc?.name || (t.tc_name && t.tc_name !== 'Unassigned TC' ? t.tc_name : fallbackTc.tc_name);
            const tcEmail = normalizeTcEmailFromAllowlist(t.assigned_tc?.email || t.tc_email || fallbackTc.tc_email);

            const names = (t.client_name || 'Client Name').trim().split(' ');
            const firstName = names[0] || 'Client';
            const lastName = names.slice(1).join(' ') || '';

            const isSeller = t.side === 'seller';
            const price = Number(t.price || t.list_price || 248000);

            // Calculate milestone steps from live milestones
            const defaultNewListing = buildDefaultSellerNewListingRoadmap();
            const defaultUnderContract = buildDefaultUnderContractRoadmap();

            const liveMilestones = t.milestones || [];
            const completedCount = liveMilestones.filter((m: any) => m.status === 'satisfied' || m.status === 'complete').length;
            const totalMilestones = liveMilestones.length > 0 ? liveMilestones.length : 13;
            const percentage = Math.round((completedCount / totalMilestones) * 100);

            return {
              id: t.id,
              sisuId: t.sisu_transaction_id || `S-${t.id.slice(0, 6)}`,
              createdAt: t.created_at ? new Date(t.created_at).toLocaleDateString('en-US') : '02/20/2024',
              agent: {
                role: 'AGENT',
                name: agentName,
                company: 'MATT SMITH REAL ESTATE GROUP',
                phone: agentPhone,
                email: agentEmail,
                initials: agentName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
                avatarUrl: getStoredAvatar(leadAgent?.id, agentEmail) || undefined,
              },
              tc: {
                role: 'TC',
                name: tcName,
                company: 'MATT SMITH REAL ESTATE GROUP',
                phone: '(573) 261-3113',
                email: tcEmail,
                initials: tcName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2),
                avatarUrl: getStoredAvatar(t.assigned_tc?.id, tcEmail) || undefined,
              },
              status: (t.status === 'closed' || t.status === 'Closed')
                ? 'Closed'
                : (t.status === 'pending' || t.status === 'under_contract' || (t.status || '').toLowerCase().includes('contract') || (t.status || '').toLowerCase().includes('pending'))
                ? 'Pending'
                : 'Active',
              paymentsDetails: 'Verified Escrow',
              roadmapsAppliedCount: 4,
              clientFirstName: firstName,
              clientLastName: lastName,
              clientFullName: t.client_name || 'Client',
              transactionType: isSeller ? 'Seller' : 'Buyer',
              contactEmail: t.client_email || 'client@gmail.com',
              contactPhone: t.client_phone || '5735550199',
              addressLine1: t.property_address || 'Address Pending',
              city: t.city || 'Rolla',
              state: t.state || 'MO',
              postalCode: t.zip || '65401',
              price,
              mlsId: t.mls_number || '',
              completionPercentage: percentage || 71,
              activeRoadmapTab: isSeller ? 'new_listing' : 'buyer_roadmap',
              roadmaps: {
                new_listing: defaultNewListing,
                under_contract: defaultUnderContract,
                listing_guide: [],
                selling_guide: [],
                buyer_roadmap: buildDefaultBuyerRoadmap(),
                buyer_guide: [],
              },
              services: DEFAULT_SERVICES,
              coopAgent: t.other_party_agent ? {
                name: t.other_party_agent,
                email: t.other_party_email || undefined,
                phone: t.other_party_phone || undefined,
                brokerage: t.other_party_brokerage || t.other_party_name || undefined,
                sideRepresented: isSeller ? 'Buyer' : 'Seller',
              } : undefined,
            };
          });

          // Merge: ensure reference records take precedence if matching ID, then add all live Supabase items
          setTransactions((prev) => {
            const map = new Map<string, HubTransactionRecord>();
            // Add live items
            liveMapped.forEach((item) => map.set(item.id, item));
            // Add reference items (which include screenshot data)
            REFERENCE_PORTAL_TRANSACTIONS.forEach((item) => map.set(item.id, item));
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.warn('Error loading live transactions into Hub:', err);
      }
    }

    loadSupabaseTransactions();
  }, []);

  // Sync URL query param when selected transaction changes
  useEffect(() => {
    if (selectedTransactionId) {
      const url = new URL(window.location.href);
      url.searchParams.set('tx', selectedTransactionId);
      window.history.replaceState({}, '', url.toString());
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete('tx');
      window.history.replaceState({}, '', url.toString());
    }
  }, [selectedTransactionId]);

  // Current selected transaction record
  const selectedTransaction = useMemo(() => {
    if (!selectedTransactionId) return null;
    return transactions.find((t) => t.id === selectedTransactionId) || null;
  }, [transactions, selectedTransactionId]);

  // Filtered transactions for Directory Table
  const filteredDirectoryTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Contact Search Bar (Large top input)
      if (contactSearchQuery.trim()) {
        const q = contactSearchQuery.toLowerCase().trim();
        const matchName = t.clientFullName.toLowerCase().includes(q);
        const matchEmail = t.contactEmail.toLowerCase().includes(q);
        const matchAddr = t.addressLine1.toLowerCase().includes(q);
        const matchAgent = t.agent.name.toLowerCase().includes(q);
        const matchPhone = t.contactPhone.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchAddr && !matchAgent && !matchPhone) {
          return false;
        }
      }

      // In-Table Search
      if (tableSearchQuery.trim()) {
        const q = tableSearchQuery.toLowerCase().trim();
        const matchAll =
          t.addressLine1.toLowerCase().includes(q) ||
          t.clientFullName.toLowerCase().includes(q) ||
          t.sisuId.toLowerCase().includes(q) ||
          t.agent.name.toLowerCase().includes(q) ||
          t.city.toLowerCase().includes(q);
        if (!matchAll) return false;
      }

      // Status Filter
      if (selectedStatusFilter !== 'All') {
        if (t.status.toLowerCase() !== selectedStatusFilter.toLowerCase()) return false;
      }

      // Type Filter
      if (selectedTypeFilter !== 'All') {
        if (t.transactionType.toLowerCase() !== selectedTypeFilter.toLowerCase()) return false;
      }

      // Agent Filter
      if (selectedAgentFilter !== 'All') {
        if (t.agent.name.toLowerCase() !== selectedAgentFilter.toLowerCase()) return false;
      }

      return true;
    });
  }, [
    transactions,
    contactSearchQuery,
    tableSearchQuery,
    selectedStatusFilter,
    selectedTypeFilter,
    selectedAgentFilter,
  ]);

  // Currency formatter
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Submit task completion details to assigned TC for final approval
  const handleSubmitForApproval = async (data: {
    details: string;
    completionDate: string;
    documentLink?: string;
  }) => {
    if (!selectedTransaction || !activeApprovalModalStep) return;

    const stepId = activeApprovalModalStep.id;
    const nowIso = new Date().toISOString();
    const fallbackTc = resolveTcForAgent(selectedTransaction.agent?.name);
    const assignedTcName = selectedTransaction.tc?.name && selectedTransaction.tc.name !== 'Unassigned TC'
      ? selectedTransaction.tc.name
      : fallbackTc.tc_name;
    const assignedTcEmail = normalizeTcEmailFromAllowlist(
      selectedTransaction.tc?.email || fallbackTc.tc_email
    );

    const approvalData: TaskApprovalData = {
      approvalStatus: 'pending_tc_approval',
      details: data.details,
      submittedByName: currentUser?.fullName || selectedTransaction.agent.name || 'Agent',
      submittedByEmail: currentUser?.email || selectedTransaction.agent.email,
      submittedAt: nowIso,
      assignedTcName,
      assignedTcEmail,
      documentLink: data.documentLink,
    };

    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== selectedTransaction.id) return tx;
        const currentSteps = tx.roadmaps[activeTab] || [];
        const updatedSteps = currentSteps.map((s) => {
          if (s.id !== stepId) return s;
          return {
            ...s,
            status: 'in_progress' as StepStatus,
            date: data.completionDate,
            approvalData,
            updatedAt: new Date().toLocaleDateString('en-US'),
          };
        });
        return {
          ...tx,
          roadmaps: {
            ...tx.roadmaps,
            [activeTab]: updatedSteps,
          },
        };
      })
    );

    // If transaction exists in Supabase, update milestone record
    try {
      const encodedNotes = encodeTaskApproval(approvalData);
      const { data: existingMilestone } = await (supabase.from('milestones') as any)
        .select('id, notes')
        .eq('transaction_id', selectedTransaction.id)
        .eq('milestone_type', stepId)
        .maybeSingle();

      if (existingMilestone) {
        await (supabase.from('milestones') as any)
          .update({
            status: 'in_progress',
            actual_date: data.completionDate,
            notes: encodeTaskApproval(approvalData, existingMilestone.notes),
            updated_at: nowIso,
          })
          .eq('id', existingMilestone.id);
      } else if (!selectedTransaction.id.startsWith('ref-') && !selectedTransaction.id.startsWith('deal-')) {
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
      console.warn('Could not update Supabase milestone for task submission:', err);
    }

    if (assignedTcEmail) {
      try {
        const notifyResult = await notifyTcOfTaskSubmission({
          tcName: assignedTcName,
          tcEmail: assignedTcEmail,
          agentName: currentUser?.fullName || selectedTransaction.agent.name || 'Agent',
          agentEmail: currentUser?.email || selectedTransaction.agent.email,
          propertyAddress: selectedTransaction.addressLine1,
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

  // TC Final Approval in Hub
  const handleApproveByTc = async (stepIdOrNotes?: string) => {
    if (!selectedTransaction) return;

    const step =
      activeApprovalModalStep ||
      currentRoadmapSteps.find((s) => s.id === stepIdOrNotes);
    if (!step) return;

    const stepId = step.id;
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];
    const prevApproval = step.approvalData;
    const tcNotes =
      typeof stepIdOrNotes === 'string' && stepIdOrNotes !== stepId
        ? stepIdOrNotes
        : undefined;

    const updatedApproval: TaskApprovalData = {
      ...(prevApproval || {
        details: 'Approved by TC',
        submittedByName: selectedTransaction.agent.name || 'Agent',
        submittedAt: nowIso,
      }),
      approvalStatus: 'approved',
      tcReviewedBy: currentUser?.fullName || 'Assigned TC',
      tcReviewedAt: nowIso,
      tcNotes: tcNotes || prevApproval?.tcNotes,
    };

    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== selectedTransaction.id) return tx;
        const currentSteps = tx.roadmaps[activeTab] || [];
        const updatedSteps = currentSteps.map((s) => {
          if (s.id !== stepId) return s;
          return {
            ...s,
            status: 'completed' as StepStatus,
            date: todayStr,
            approvalData: updatedApproval,
            updatedAt: new Date().toLocaleDateString('en-US'),
          };
        });
        const completedCount = updatedSteps.filter((s) => s.status === 'completed').length;
        const newPercentage = updatedSteps.length > 0 ? Math.round((completedCount / updatedSteps.length) * 100) : tx.completionPercentage;
        return {
          ...tx,
          completionPercentage: newPercentage,
          roadmaps: {
            ...tx.roadmaps,
            [activeTab]: updatedSteps,
          },
        };
      })
    );

    try {
      const { data: existingMilestone } = await (supabase.from('milestones') as any)
        .select('id, notes')
        .eq('transaction_id', selectedTransaction.id)
        .eq('milestone_type', stepId)
        .maybeSingle();

      if (existingMilestone) {
        await (supabase.from('milestones') as any)
          .update({
            status: 'satisfied',
            actual_date: todayStr,
            notes: encodeTaskApproval(updatedApproval, existingMilestone.notes),
            updated_at: nowIso,
          })
          .eq('id', existingMilestone.id);
      }
    } catch (err) {
      console.warn('Could not approve milestone in Supabase:', err);
    }

    setActionSuccessMessage(`Task approved and marked Complete!`);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  // TC Request Changes in Hub
  const handleRequestChangesByTc = async (tcFeedback: string) => {
    if (!selectedTransaction || !activeApprovalModalStep) return;

    const stepId = activeApprovalModalStep.id;
    const nowIso = new Date().toISOString();
    const prevApproval = activeApprovalModalStep.approvalData;

    const updatedApproval: TaskApprovalData = {
      ...(prevApproval || {
        details: 'Changes requested by TC',
        submittedByName: selectedTransaction.agent.name || 'Agent',
        submittedAt: nowIso,
      }),
      approvalStatus: 'changes_requested',
      tcReviewedBy: currentUser?.fullName || 'Assigned TC',
      tcReviewedAt: nowIso,
      tcNotes: tcFeedback,
    };

    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== selectedTransaction.id) return tx;
        const currentSteps = tx.roadmaps[activeTab] || [];
        const updatedSteps = currentSteps.map((s) => {
          if (s.id !== stepId) return s;
          return {
            ...s,
            status: 'pending' as StepStatus,
            approvalData: updatedApproval,
            updatedAt: new Date().toLocaleDateString('en-US'),
          };
        });
        return {
          ...tx,
          roadmaps: {
            ...tx.roadmaps,
            [activeTab]: updatedSteps,
          },
        };
      })
    );

    try {
      const { data: existingMilestone } = await (supabase.from('milestones') as any)
        .select('id, notes')
        .eq('transaction_id', selectedTransaction.id)
        .eq('milestone_type', stepId)
        .maybeSingle();

      if (existingMilestone) {
        await (supabase.from('milestones') as any)
          .update({
            status: 'pending',
            notes: encodeTaskApproval(updatedApproval, existingMilestone.notes),
            updated_at: nowIso,
          })
          .eq('id', existingMilestone.id);
      }
    } catch (err) {
      console.warn('Could not record revision in Supabase:', err);
    }

    setActionSuccessMessage(`Revision request sent to agent.`);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  // Toggle step complete/pending
  const handleToggleStepStatus = (stepId: string) => {
    if (!selectedTransaction) return;

    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== selectedTransaction.id) return tx;

        const currentSteps = tx.roadmaps[activeTab] || [];
        const updatedSteps = currentSteps.map((s) => {
          if (s.id !== stepId) return s;
          const nextStatus: StepStatus = s.status === 'completed' ? 'pending' : 'completed';
          return {
            ...s,
            status: nextStatus,
            updatedAt: new Date().toLocaleDateString('en-US'),
          };
        });

        // Recalculate percentage
        const completedCount = updatedSteps.filter((s) => s.status === 'completed').length;
        const newPercentage = updatedSteps.length > 0 ? Math.round((completedCount / updatedSteps.length) * 100) : tx.completionPercentage;

        return {
          ...tx,
          completionPercentage: newPercentage,
          roadmaps: {
            ...tx.roadmaps,
            [activeTab]: updatedSteps,
          },
        };
      })
    );
  };

  // Update step date
  const handleStepDateChange = (stepId: string, newDate: string) => {
    if (!selectedTransaction) return;

    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== selectedTransaction.id) return tx;

        const currentSteps = tx.roadmaps[activeTab] || [];
        const updatedSteps = currentSteps.map((s) => {
          if (s.id !== stepId) return s;
          return {
            ...s,
            date: newDate,
            updatedAt: new Date().toLocaleDateString('en-US'),
          };
        });

        return {
          ...tx,
          roadmaps: {
            ...tx.roadmaps,
            [activeTab]: updatedSteps,
          },
        };
      })
    );
  };

  // Add custom step
  const handleAddCustomStep = (newStepData: {
    title: string;
    description: string;
    date?: string;
    status: StepStatus;
  }) => {
    if (!selectedTransaction) return;

    const newStep: HubRoadmapStep = {
      id: `step-custom-${Date.now()}`,
      roadmapCategory: activeTab,
      title: newStepData.title,
      description: newStepData.description,
      status: newStepData.status,
      date: newStepData.date || null,
      updatedAt: new Date().toLocaleDateString('en-US'),
      order: (selectedTransaction.roadmaps[activeTab]?.length || 0) + 1,
    };

    setTransactions((prev) =>
      prev.map((tx) => {
        if (tx.id !== selectedTransaction.id) return tx;
        const currentList = tx.roadmaps[activeTab] || [];
        const updatedList = [...currentList, newStep];
        const completedCount = updatedList.filter((s) => s.status === 'completed').length;
        const newPercentage = Math.round((completedCount / updatedList.length) * 100);

        return {
          ...tx,
          completionPercentage: newPercentage,
          roadmaps: {
            ...tx.roadmaps,
            [activeTab]: updatedList,
          },
        };
      })
    );
  };

  // Copy share link
  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopyFeedback('Portal link copied to clipboard!');
    setTimeout(() => setCopyFeedback(null), 2500);
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'ID',
      'Created',
      'Agent',
      'Status',
      'First Name',
      'Last Name',
      'Client Full Name',
      'Transaction Type',
      'Contact Email',
      'Mobile Phone',
      'Address Line 1',
      'City',
      'State',
      'Postal Code',
      'Price',
    ];

    const rows = filteredDirectoryTransactions.map((t) => [
      `"${t.sisuId}"`,
      `"${t.createdAt}"`,
      `"${t.agent.name}"`,
      `"${t.status}"`,
      `"${t.clientFirstName}"`,
      `"${t.clientLastName}"`,
      `"${t.clientFullName}"`,
      `"${t.transactionType}"`,
      `"${t.contactEmail}"`,
      `"${t.contactPhone}"`,
      `"${t.addressLine1}"`,
      `"${t.city}"`,
      `"${t.state}"`,
      `"${t.postalCode}"`,
      `"${t.price}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MSREG_Client_Portal_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Current roadmap steps for the active tab
  const currentRoadmapSteps = useMemo(() => {
    if (!selectedTransaction) return [];
    const steps = selectedTransaction.roadmaps[activeTab] || [];
    if (orderByDate) {
      return [...steps].sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.localeCompare(b.date);
      });
    }
    return steps;
  }, [selectedTransaction, activeTab, orderByDate]);

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 font-sans">
      {/* ─────────────────────────────────────────────────────────────────
          VIEW A: CLIENT PORTAL DIRECTORY
          When no transaction is selected or when browsing directory
         ───────────────────────────────────────────────────────────────── */}
      {!selectedTransaction ? (
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Header & Quick Action Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Client Portal & Transaction Hub</span>
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Live
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Contract-to-close milestones, client roadmap tracking, and transaction compliance.
              </p>
            </div>

            {/* Quick Actions & Counter */}
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-xl bg-[#131b2e] border border-white/10 text-xs text-slate-300 flex items-center gap-2 tabular-nums">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>{filteredDirectoryTransactions.length} Active Files</span>
              </div>
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-1.5 rounded-xl bg-[#131b2e] hover:bg-[#182238] border border-white/10 hover:border-white/20 text-xs font-semibold text-sky-400 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Unified Search & Filter Toolbar */}
          <div className="bg-[#111726] p-3.5 rounded-2xl border border-white/[0.08] flex flex-wrap items-center justify-between gap-3 shadow-sm">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[260px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={contactSearchQuery}
                onChange={(e) => setContactSearchQuery(e.target.value)}
                placeholder="Search address, client name, agent, phone..."
                className="w-full pl-9 pr-8 py-2 bg-[#090d16] border border-white/10 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 transition-all"
              />
              {contactSearchQuery && (
                <button
                  onClick={() => setContactSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Pills / Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Type Filter */}
              <div className="flex items-center bg-[#090d16] p-1 rounded-xl border border-white/10 text-xs font-medium">
                {['All', 'Seller', 'Buyer'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedTypeFilter(type)}
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      selectedTypeFilter.toLowerCase() === type.toLowerCase()
                        ? 'bg-[#182238] text-white font-semibold border border-white/10 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-[#090d16] border border-white/10 rounded-xl text-xs font-medium text-slate-300 focus:outline-none focus:border-amber-500/60 cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Under Contract">Under Contract</option>
                <option value="Pending">Pending</option>
                <option value="Active">Active</option>
              </select>

              {/* Agent Filter */}
              <select
                value={selectedAgentFilter}
                onChange={(e) => setSelectedAgentFilter(e.target.value)}
                className="px-3 py-1.5 bg-[#090d16] border border-white/10 rounded-xl text-xs font-medium text-slate-300 focus:outline-none focus:border-amber-500/60 cursor-pointer"
              >
                <option value="All">All Agents</option>
                {Array.from(new Set(transactions.map((t) => t.agent.name))).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* High-Density Data Table */}
          <div className="bg-[#111726] border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
                <thead>
                  <tr className="bg-[#0e1422] border-b border-white/[0.08] text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={
                          selectedRowIds.length > 0 &&
                          selectedRowIds.length === filteredDirectoryTransactions.length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRowIds(filteredDirectoryTransactions.map((t) => t.id));
                          } else {
                            setSelectedRowIds([]);
                          }
                        }}
                        className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3">File ID</th>
                    <th className="py-3 px-3">Created</th>
                    <th className="py-3 px-3">Agent</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Client</th>
                    <th className="py-3 px-3">Address</th>
                    <th className="py-3 px-3">City</th>
                    <th className="py-3 px-3">Price</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05] text-[12px]">
                  {filteredDirectoryTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-400 font-sans">
                        No transactions found matching your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredDirectoryTransactions.map((trx) => {
                      const isRowSelected = selectedRowIds.includes(trx.id);

                      return (
                        <tr
                          key={trx.id}
                          onClick={() => setSelectedTransactionId(trx.id)}
                          className="hover:bg-white/[0.03] cursor-pointer transition-colors group"
                        >
                          <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isRowSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRowIds((prev) => [...prev, trx.id]);
                                } else {
                                  setSelectedRowIds((prev) => prev.filter((id) => id !== trx.id));
                                }
                              }}
                              className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 cursor-pointer"
                            />
                          </td>

                          {/* ID */}
                          <td className="py-3 px-3 font-mono font-medium text-slate-300 tabular-nums">
                            {trx.sisuId}
                          </td>

                          {/* Created */}
                          <td className="py-3 px-3 text-slate-400 tabular-nums">{trx.createdAt}</td>

                          {/* Agent */}
                          <td className="py-3 px-3 font-sans text-slate-200">
                            <div className="flex items-center gap-2">
                              <span className="h-5 w-5 rounded-full bg-[#182238] border border-white/10 flex items-center justify-center text-[9px] font-bold text-amber-400">
                                {trx.agent.initials || 'A'}
                              </span>
                              <span className="font-medium">{trx.agent.name}</span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                trx.status === 'Closed'
                                  ? 'bg-slate-800 text-slate-300 border border-white/10'
                                  : trx.status === 'Under Contract' || trx.status === 'Pending'
                                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {trx.status}
                            </span>
                          </td>

                          {/* Transaction Type */}
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                trx.transactionType === 'Seller'
                                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                                  : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/25'
                              }`}
                            >
                              {trx.transactionType}
                            </span>
                          </td>

                          {/* Client Full Name */}
                          <td className="py-3 px-3 text-slate-200 font-medium">
                            {trx.clientFullName}
                          </td>

                          {/* Address Line 1 */}
                          <td className="py-3 px-3 font-medium text-white group-hover:text-amber-400 transition-colors">
                            {trx.addressLine1}
                          </td>

                          {/* City */}
                          <td className="py-3 px-3 text-slate-300">{trx.city}</td>

                          {/* Price */}
                          <td className="py-3 px-3 font-mono font-medium text-white tabular-nums">
                            {formatCurrency(trx.price)}
                          </td>

                          {/* Action Button */}
                          <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedTransactionId(trx.id)}
                              className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-semibold rounded-lg text-xs transition-all border border-amber-500/30 cursor-pointer"
                            >
                              View Hub →
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────────
           VIEW B: TRANSACTION HUB DETAIL & ROADMAPS
           Full detail layout with Agent, Gauge, Roadmaps, Property, Team
           ───────────────────────────────────────────────────────────────── */
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Top Return Navigation & Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <button
              onClick={() => setSelectedTransactionId(null)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#111726] hover:bg-[#182238] border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-sm cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Directory</span>
            </button>

            {/* Quick Switcher dropdown & Actions */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 hidden sm:inline">Transaction:</span>
                <select
                  value={selectedTransaction.id}
                  onChange={(e) => setSelectedTransactionId(e.target.value)}
                  className="bg-[#111726] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-amber-500/60 cursor-pointer shadow-sm"
                >
                  {transactions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.addressLine1} ({t.clientFullName})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleCopyLink}
                className="p-2 rounded-xl bg-[#111726] hover:bg-[#182238] border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Copy shareable link"
              >
                <Share2 className="h-4 w-4" />
              </button>

              <button
                onClick={() => window.print()}
                className="p-2 rounded-xl bg-[#111726] hover:bg-[#182238] border border-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Print Roadmap"
              >
                <Printer className="h-4 w-4" />
              </button>
            </div>
          </div>

          {copyFeedback && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs font-semibold text-emerald-300 flex items-center gap-2 animate-in fade-in duration-200">
              <Check className="h-4 w-4 text-emerald-400" />
              <span>{copyFeedback}</span>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              Top Hero Section: Agent Profile, Progress Gauge, Transaction Info
             ───────────────────────────────────────────────────────────── */}
          <div className="bg-[#111726] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Left Column: Agent Profile (Cols 1-5) */}
              <div className="md:col-span-5 flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <div className="h-16 w-16 sm:h-18 sm:w-18 rounded-full overflow-hidden border border-white/10 bg-[#182238] shadow-md">
                    {selectedTransaction.agent.avatarUrl ? (
                      <img
                        src={selectedTransaction.agent.avatarUrl}
                        alt={selectedTransaction.agent.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center font-bold text-base text-amber-400 bg-[#182238]">
                        {selectedTransaction.agent.initials || 'AG'}
                      </div>
                    )}
                  </div>
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-[#111726]" />
                </div>

                <div className="space-y-0.5">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {selectedTransaction.agent.name}
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">
                    {selectedTransaction.agent.company || 'Matt Smith Real Estate Group'}
                  </p>

                  <div className="pt-1 flex flex-col gap-0.5 text-xs text-slate-300">
                    {selectedTransaction.agent.phone && (
                      <a
                        href={`tel:${selectedTransaction.agent.phone}`}
                        className="hover:text-amber-400 transition-colors flex items-center gap-1.5"
                      >
                        <Phone className="h-3 w-3 text-slate-400" />
                        <span className="font-mono tabular-nums">{selectedTransaction.agent.phone}</span>
                      </a>
                    )}
                    {selectedTransaction.agent.email && (
                      <a
                        href={`mailto:${selectedTransaction.agent.email}`}
                        className="hover:text-amber-400 transition-colors flex items-center gap-1.5 truncate max-w-[220px]"
                      >
                        <Mail className="h-3 w-3 text-slate-400" />
                        <span className="truncate">{selectedTransaction.agent.email}</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Center Column: Circular Progress Gauge (Cols 6-8) */}
              <div className="md:col-span-3 flex flex-col items-center justify-center py-2 border-y md:border-y-0 md:border-x border-white/[0.08]">
                <CircularProgressGauge
                  percentage={selectedTransaction.completionPercentage}
                  size={110}
                  strokeWidth={8}
                />
              </div>

              {/* Right Column: Transaction Details (Cols 9-12) */}
              <div className="md:col-span-4 space-y-1 text-left md:text-right">
                <div className="flex items-center justify-start md:justify-end gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 uppercase tracking-wider">
                    {selectedTransaction.status}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-slate-400 border border-white/10 uppercase">
                    {selectedTransaction.transactionType} Rep
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {selectedTransaction.clientFullName}
                </h2>
                <p className="text-xs text-slate-300 font-medium">
                  {selectedTransaction.addressLine1}, {selectedTransaction.city}, {selectedTransaction.state}
                </p>

                <div className="pt-1.5">
                  <span className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums tracking-tight">
                    {formatCurrency(selectedTransaction.price)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────
              Horizontal Sub-Navigation Tabs
             ───────────────────────────────────────────────────────────── */}
          <div className="border-b border-white/[0.08] flex items-center gap-2 sm:gap-6 overflow-x-auto scrollbar-none text-xs sm:text-sm font-semibold select-none">
            {selectedTransaction.transactionType === 'Seller' ? (
              <>
                <button
                  onClick={() => setActiveTab('new_listing')}
                  className={`pb-3 px-2 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'new_listing'
                      ? 'border-amber-400 text-white font-bold'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <span>New Listing</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#182238] text-slate-300 font-mono tabular-nums">
                    {selectedTransaction.roadmaps.new_listing?.length || 7}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('under_contract')}
                  className={`pb-3 px-2 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'under_contract'
                      ? 'border-amber-400 text-white font-bold'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Listing Under Contract</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#182238] text-slate-300 font-mono tabular-nums">
                    {selectedTransaction.roadmaps.under_contract?.length || 11}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('listing_guide')}
                  className={`pb-3 px-2 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'listing_guide'
                      ? 'border-amber-400 text-white font-bold'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Home Listing Guide</span>
                </button>

                <button
                  onClick={() => setActiveTab('selling_guide')}
                  className={`pb-3 px-2 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'selling_guide'
                      ? 'border-amber-400 text-white font-bold'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Home Selling Guide</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setActiveTab('buyer_roadmap')}
                  className={`pb-3 px-2 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'buyer_roadmap'
                      ? 'border-amber-400 text-white font-bold'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Buyer Roadmap</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#182238] text-slate-300 font-mono tabular-nums">
                    5
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('under_contract')}
                  className={`pb-3 px-2 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'under_contract'
                      ? 'border-amber-400 text-white font-bold'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Under Contract Escrow</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#182238] text-slate-300 font-mono tabular-nums">
                    11
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('selling_guide')}
                  className={`pb-3 px-2 border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
                    activeTab === 'selling_guide'
                      ? 'border-amber-400 text-white font-bold'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Home Buying Guide</span>
                </button>
              </>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              Main Workspace: Two Columns Layout (Image 1 Main Body)
              Left: Roadmaps Timeline (or Guides)
              Right: Property, Team, Services Sidebar
             ───────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Roadmaps Steps (Cols 1-8) */}
            <div className="lg:col-span-8 space-y-6">
              {activeTab === 'listing_guide' || activeTab === 'selling_guide' ? (
                <GuidesContent
                  guideType={activeTab}
                  propertyAddress={selectedTransaction.addressLine1}
                />
              ) : (
                <div className="space-y-4">
                  {/* Roadmaps Header & Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-white tracking-tight">Roadmaps</h2>
                      <div
                        className="text-slate-400 hover:text-slate-200 cursor-pointer"
                        title="Interactive contract milestones. Click checkmarks to update status."
                      >
                        <Info className="h-4 w-4" />
                      </div>
                    </div>

                    {/* Controls Bar: Order by date, View Toggles, + Add Step */}
                    <div className="flex items-center gap-4">
                      {/* Order by Date Checkbox */}
                      <label className="flex items-center gap-2 text-xs text-slate-300 font-medium cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={orderByDate}
                          onChange={(e) => setOrderByDate(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0 cursor-pointer"
                        />
                        <span>Order by date</span>
                      </label>

                      {/* Add Step Button */}
                      <button
                        onClick={() => setIsAddStepOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-white text-slate-950 font-bold text-xs transition-all shadow-md active:scale-[0.98] cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5 stroke-[3]" />
                        <span>Add Step</span>
                      </button>
                    </div>
                  </div>

                  {/* Connected Step Cards Timeline List */}
                  <div className="pt-2">
                    {currentRoadmapSteps.length === 0 ? (
                      <div className="p-8 text-center bg-[#0b1320] border border-slate-800 rounded-3xl text-slate-400 space-y-2">
                        <Calendar className="h-6 w-6 mx-auto text-slate-500" />
                        <p className="font-semibold text-white">No steps created yet in this roadmap</p>
                        <p className="text-xs">Click "+ Add Step" above to add custom milestones.</p>
                      </div>
                    ) : (
                      currentRoadmapSteps.map((step, idx) => (
                        <RoadmapStepCard
                          key={step.id}
                          step={step}
                          isFirst={idx === 0}
                          isLast={idx === currentRoadmapSteps.length - 1}
                          isActive={activeStepId === step.id}
                          isOpsOrTc={isOpsOrTc}
                          onRequestApproval={(step) => setActiveApprovalModalStep(step)}
                          onApproveByTc={(stepId) => handleApproveByTc(stepId)}
                          onToggleStatus={handleToggleStepStatus}
                          onDateChange={handleStepDateChange}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Sidebar Cards (Cols 9-12) */}
            <div className="lg:col-span-4 space-y-5">
              {/* Card 1: Property */}
              <div className="bg-[#111726] border border-white/[0.08] rounded-2xl p-5 shadow-lg space-y-3.5">
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                  <h3 className="font-semibold text-sm text-white">Property Information</h3>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${selectedTransaction.addressLine1}, ${selectedTransaction.city}, ${selectedTransaction.state} ${selectedTransaction.postalCode}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
                  >
                    <span>Maps</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-400">Address:</span>
                    <span className="font-medium text-white text-right">
                      {selectedTransaction.addressLine1}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">City:</span>
                    <span className="font-medium text-white">{selectedTransaction.city}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">State:</span>
                    <span className="font-medium text-white">{selectedTransaction.state}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Postal Code:</span>
                    <span className="font-mono text-white tabular-nums">
                      {selectedTransaction.postalCode}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">MLS ID:</span>
                    <span className="font-mono text-slate-300 tabular-nums">
                      {selectedTransaction.mlsId || 'Pending'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
                    <span className="text-slate-400">Contract Price:</span>
                    <span className="font-mono font-bold text-sm text-white tabular-nums">
                      {formatCurrency(selectedTransaction.price)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 2: Team */}
              <div className="bg-[#111726] border border-white/[0.08] rounded-2xl p-5 shadow-lg space-y-3.5">
                <div className="border-b border-white/[0.08] pb-3">
                  <h3 className="font-semibold text-sm text-white">Transaction Team</h3>
                </div>

                <div className="space-y-4">
                  {/* Lead Agent */}
                  <div className="space-y-1 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Agent
                    </span>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-800 border border-slate-700 flex-shrink-0">
                        {selectedTransaction.agent.avatarUrl ? (
                          <img
                            src={selectedTransaction.agent.avatarUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="h-full w-full flex items-center justify-center font-bold text-[10px] text-sky-400">
                            {selectedTransaction.agent.initials || 'AG'}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-white text-xs leading-tight">
                          {selectedTransaction.agent.name}
                        </p>
                        {selectedTransaction.agent.phone && (
                          <a
                            href={`tel:${selectedTransaction.agent.phone}`}
                            className="font-mono tabular-nums text-[11px] text-slate-400 hover:text-sky-300 transition-colors block"
                          >
                            {selectedTransaction.agent.phone}
                          </a>
                        )}
                      </div>
                    </div>

                    {selectedTransaction.agent.email && (
                      <a
                        href={`mailto:${selectedTransaction.agent.email}`}
                        className="text-[11px] text-sky-400 hover:underline block pt-0.5 truncate pl-10"
                      >
                        {selectedTransaction.agent.email}
                      </a>
                    )}
                  </div>

                  {/* Transaction Coordinator */}
                  {selectedTransaction.tc && (
                    <div className="space-y-1 text-xs pt-3 border-t border-slate-800/80">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        TC
                      </span>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-800 border border-slate-700 flex-shrink-0">
                          {selectedTransaction.tc.avatarUrl ? (
                            <img
                              src={selectedTransaction.tc.avatarUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="h-full w-full flex items-center justify-center font-bold text-[10px] text-emerald-400">
                              {selectedTransaction.tc.initials || 'TC'}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-white text-xs leading-tight">
                            {selectedTransaction.tc.name}
                          </p>
                          {selectedTransaction.tc.phone && (
                            <a
                              href={`tel:${selectedTransaction.tc.phone}`}
                              className="font-mono tabular-nums text-[11px] text-slate-400 hover:text-emerald-300 transition-colors block"
                            >
                              {selectedTransaction.tc.phone}
                            </a>
                          )}
                        </div>
                      </div>

                      {selectedTransaction.tc.email && (
                        <a
                          href={`mailto:${selectedTransaction.tc.email}`}
                          className="text-[11px] text-sky-400 hover:underline block pt-0.5 truncate pl-10"
                        >
                          {selectedTransaction.tc.email}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Cooperating Agent (Other Side) */}
                  {selectedTransaction.coopAgent && (
                    <div className="space-y-1 text-xs pt-3 border-t border-slate-800/80">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Co-op Agent
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                          {selectedTransaction.coopAgent.sideRepresented || 'Other Side'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-purple-500/20 border border-purple-500/40 flex items-center justify-center font-bold text-[10px] text-purple-300 flex-shrink-0">
                          {selectedTransaction.coopAgent.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white text-xs leading-tight truncate">
                            {selectedTransaction.coopAgent.name}
                          </p>
                          {selectedTransaction.coopAgent.brokerage && (
                            <p className="text-[10px] text-slate-400 truncate">
                              {selectedTransaction.coopAgent.brokerage}
                            </p>
                          )}
                          {selectedTransaction.coopAgent.phone && (
                            <a
                              href={`tel:${selectedTransaction.coopAgent.phone}`}
                              className="font-mono tabular-nums text-[11px] text-slate-400 hover:text-purple-300 transition-colors block pt-0.5"
                            >
                              {selectedTransaction.coopAgent.phone}
                            </a>
                          )}
                        </div>
                      </div>

                      {selectedTransaction.coopAgent.email && (
                        <a
                          href={`mailto:${selectedTransaction.coopAgent.email}`}
                          className="text-[11px] text-purple-400 hover:underline block pt-0.5 truncate pl-10"
                        >
                          {selectedTransaction.coopAgent.email}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          MODALS: Add Step Modal
         ───────────────────────────────────────────────────────────────── */}
      {isAddStepOpen && (
        <AddStepModal
          roadmapCategory={activeTab}
          categoryLabel={
            activeTab === 'new_listing'
              ? 'New Listing'
              : activeTab === 'under_contract'
              ? 'Listing Under Contract'
              : 'Roadmap'
          }
          onClose={() => setIsAddStepOpen(false)}
          onAdd={handleAddCustomStep}
        />
      )}

      {/* Task Completion Approval Modal */}
      {activeApprovalModalStep && selectedTransaction && (
        <TaskCompletionModal
          isOpen={Boolean(activeApprovalModalStep)}
          onClose={() => setActiveApprovalModalStep(null)}
          taskTitle={activeApprovalModalStep.title}
          stepNumber={activeApprovalModalStep.order}
          propertyAddress={selectedTransaction.addressLine1}
          clientName={selectedTransaction.clientFullName}
          assignedTcName={
            selectedTransaction.tc?.name && selectedTransaction.tc.name !== 'Unassigned TC'
              ? selectedTransaction.tc.name
              : resolveTcForAgent(selectedTransaction.agent?.name).tc_name
          }
          assignedTcEmail={
            normalizeTcEmailFromAllowlist(
              selectedTransaction.tc?.email ||
              resolveTcForAgent(selectedTransaction.agent?.name).tc_email
            )
          }
          currentDate={activeApprovalModalStep.date}
          existingApprovalData={activeApprovalModalStep.approvalData}
          isOpsOrTc={isOpsOrTc}
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
