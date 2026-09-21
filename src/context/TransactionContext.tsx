import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  Transaction,
  TransactionStage,
  RepresentationType,
  TransactionHealth,
  ContingencyStatus,
  DocumentStatus,
  ComplianceDocument,
  ActivityNote,
  CommissionBreakdown,
  PartyContact,
} from '../types/transaction';
import { INITIAL_TRANSACTIONS } from '../data/mockTransactions';

import { supabase } from '../integrations/supabase/client';

export type ViewMode = 'kanban' | 'table' | 'deadlines';

interface TransactionContextType {
  transactions: Transaction[];
  selectedTransaction: Transaction | null;
  setSelectedTransactionId: (id: string | null) => void;
  activeDetailTab: 'overview' | 'documents' | 'parties' | 'commission' | 'activity';
  setActiveDetailTab: (tab: 'overview' | 'documents' | 'parties' | 'commission' | 'activity') => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterRepresentation: 'All' | RepresentationType;
  setFilterRepresentation: (rep: 'All' | RepresentationType) => void;
  filterStage: 'All' | TransactionStage;
  setFilterStage: (stage: 'All' | TransactionStage) => void;
  filterHealth: 'All' | TransactionHealth;
  setFilterHealth: (health: 'All' | TransactionHealth) => void;
  isNewModalOpen: boolean;
  setIsNewModalOpen: (open: boolean) => void;
  isCdaModalOpen: boolean;
  setIsCdaModalOpen: (open: boolean) => void;
  cdaTransaction: Transaction | null;
  openCdaModal: (trx: Transaction) => void;
  closeCdaModal: () => void;
  createTransaction: (trx: Omit<Transaction, 'id' | 'fileNumber' | 'activityLog'>) => void;
  updateTransactionStage: (trxId: string, newStage: TransactionStage) => void;
  updateContingencyStatus: (
    trxId: string,
    contingencyId: string,
    status: ContingencyStatus,
    notes?: string
  ) => void;
  updateDocumentStatus: (trxId: string, docId: string, status: DocumentStatus) => void;
  addDocument: (trxId: string, doc: Omit<ComplianceDocument, 'id'>) => void;
  toggleMilestone: (trxId: string, milestoneId: string) => void;
  addActivityNote: (
    trxId: string,
    content: string,
    type?: ActivityNote['type'],
    author?: string,
    role?: string,
    isPinned?: boolean
  ) => void;
  updateCommission: (trxId: string, commission: Partial<CommissionBreakdown>) => void;
  addOrUpdateParty: (trxId: string, party: PartyContact) => void;
  deleteTransaction: (trxId: string) => void;
  filteredTransactions: Transaction[];
  metrics: {
    activeVolume: number;
    projectedGci: number;
    activeCount: number;
    closingThisMonthCount: number;
    urgentAlertsCount: number;
  };
}

const STORAGE_KEY = 'msreg_transaction_management_db_live_v2';

// Purge any legacy localStorage cache with fake addresses
try {
  const legacyCache = localStorage.getItem('msreg_transaction_management_db_v1');
  if (legacyCache && (legacyCache.includes('Lincoln Park') || legacyCache.includes('TRX-2026-081'))) {
    localStorage.removeItem('msreg_transaction_management_db_v1');
  }
} catch (e) {
  // ignore
}

const TransactionContext = createContext<TransactionContextType | undefined>(undefined);

export const TransactionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved transactions from localStorage', e);
    }
    return [];
  });

  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'documents' | 'parties' | 'commission' | 'activity'>('overview');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterRepresentation, setFilterRepresentation] = useState<'All' | RepresentationType>('All');
  const [filterStage, setFilterStage] = useState<'All' | TransactionStage>('All');
  const [filterHealth, setFilterHealth] = useState<'All' | TransactionHealth>('All');
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [isCdaModalOpen, setIsCdaModalOpen] = useState<boolean>(false);
  const [cdaTransaction, setCdaTransaction] = useState<Transaction | null>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch (e) {
      console.error('Failed to save transactions to localStorage', e);
    }
  }, [transactions]);

  // Load from Supabase on mount & listen to real-time changes
  useEffect(() => {
    async function loadSupabaseData() {
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
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data) {
          const mapped: Transaction[] = data.map((t: any, idx: number) => {
            const price = Number(t.price || t.list_price || 0);
            const leadAgent = t.side === 'seller' ? t.listing_agent : (t.selling_agent || t.listing_agent);
            const agentName = leadAgent?.name || t.agent_name || 'Lead Agent';
            const agentEmail = leadAgent?.email || t.agent_email || 'agent@mattsmithrealestategroup.com';
            const tcName = t.assigned_tc?.name || t.tc_name || 'Assigned TC';

            const partiesList: any[] = [];
            if (t.client_name && t.client_name !== 'Unnamed Client') {
              partiesList.push({
                id: `party-client-${t.id}`,
                name: t.client_name,
                role: t.side === 'seller' ? 'Seller' : 'Buyer',
                email: t.client_email || '',
                phone: t.client_phone || '',
                isPrimary: true,
              });
            }
            if (t.other_party_agent) {
              partiesList.push({
                id: `party-coop-${t.id}`,
                name: t.other_party_agent,
                role: 'Co-op Agent',
                email: t.other_party_email || '',
                phone: t.other_party_phone || '',
                company: t.other_party_brokerage || '',
              });
            }
            if (t.lender_name) {
              partiesList.push({
                id: `party-lender-${t.id}`,
                name: t.lender_name,
                role: 'Mortgage Lender',
                email: t.lender_email || '',
                phone: t.lender_phone || '',
                company: t.loan_type ? `Loan: ${t.loan_type}` : undefined,
              });
            }
            if (t.title_company) {
              partiesList.push({
                id: `party-title-${t.id}`,
                name: t.title_company,
                role: 'Title / Escrow Officer',
                email: '',
                phone: '',
              });
            }

            return {
              id: t.id,
              fileNumber: t.sisu_transaction_id ? `SISU-${t.sisu_transaction_id}` : `TRX-2026-${String(idx + 1).padStart(3, '0')}`,
              address: t.property_address || 'Pending Address',
              unit: '',
              city: t.city || 'Waynesville',
              state: t.state || 'MO',
              zip: t.zip || '65583',
              mlsId: t.mls_number || '',
              photoUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=900&q=80',
              propertyType: 'Single Family',
              contractPrice: price,
              mutualAcceptanceDate: t.contract_date || new Date().toISOString().split('T')[0],
              targetClosingDate: t.target_closing_date || '',
              stage: (t.status === 'active' || t.status === 'pre_listing' || t.status === 'coming_soon' || t.status === 'Appt Set' || t.status === 'N') ? 'intake' : 'escrow_opened',
              representation: t.side === 'seller' ? 'Seller' : 'Buyer',
              health: 'on_track',
              agentName,
              agentEmail,
              agentPhone: t.client_phone || '(573) 555-0100',
              agentAvatar: agentName.split(' ').map((n: string) => n[0]).join('').toUpperCase(),
              tcName,
              tcAvatar: tcName.split(' ').map((n: string) => n[0]).join('').toUpperCase(),
              clientNames: [t.client_name || 'Client'],
              contingencies: [],
              documents: [],
              parties: partiesList,
              commission: {
                purchasePrice: price,
                commissionRate: 2.5,
                grossCommission: price * 0.025,
                agentSplitPercentage: 85,
                agentGrossPayout: price * 0.025 * 0.85,
                brokerageGrossSplit: price * 0.025 * 0.15,
                transactionCoordinatorFee: 450,
                eoInsuranceFee: 50,
                adminFee: 195,
                otherDeductions: 0,
                netAgentPayout: Math.max(0, price * 0.025 * 0.85 - 695),
                escrowCompany: 'Matt Smith Real Estate Group Escrow',
                escrowOfficer: 'Compliance Office',
                escrowEmail: 'compliance@mattsmithrealestategroup.com',
                cdaNumber: `CDA-2026-${String(idx + 1).padStart(3, '0')}`,
                cdaStatus: 'Draft',
              },
              milestones: (t.milestones || []).map((m: any) => ({
                id: m.id,
                title: m.milestone_type.replace(/_/g, ' ').toUpperCase(),
                completed: m.status === 'satisfied' || m.status === 'complete',
                dueDate: m.target_date || undefined,
                completedAt: m.actual_date || undefined,
              })),
              customFields: t.custom_fields || undefined,
              sisuTransactionId: t.sisu_transaction_id || undefined,
              activityLog: [
                {
                  id: `act-init-${t.id}`,
                  author: 'Sisu Sync',
                  role: 'System',
                  content: `Transaction active in MSREG Hub for ${t.property_address}`,
                  createdAt: t.created_at,
                  type: 'status_change',
                },
              ],
            };
          });

          setTransactions(mapped);
        }
      } catch (err) {
        console.warn('Live transactions query warning in TransactionContext:', err);
      }
    }

    loadSupabaseData();

    const channel = supabase
      .channel('realtime_transactions_context')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          loadSupabaseData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'milestones' },
        () => {
          loadSupabaseData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const selectedTransaction = useMemo(() => {
    if (!selectedTransactionId) return null;
    return transactions.find((t) => t.id === selectedTransactionId) || null;
  }, [transactions, selectedTransactionId]);

  const openCdaModal = (trx: Transaction) => {
    setCdaTransaction(trx);
    setIsCdaModalOpen(true);
  };

  const closeCdaModal = () => {
    setIsCdaModalOpen(false);
    setCdaTransaction(null);
  };

  const createTransaction = (trxData: Omit<Transaction, 'id' | 'fileNumber' | 'activityLog'>) => {
    const nextNum = transactions.length + 86;
    const fileNumber = `TRX-2026-${String(nextNum).padStart(3, '0')}`;
    const newId = `trx-${Date.now()}`;

    const newTransaction: Transaction = {
      ...trxData,
      id: newId,
      fileNumber,
      activityLog: [
        {
          id: `act-${Date.now()}`,
          author: trxData.agentName || 'Lead Agent',
          role: 'Lead Broker',
          content: `Transaction intake created for ${trxData.address} (${trxData.representation} representation). Initial timeline generated.`,
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          type: 'status_change',
        },
      ],
    };

    setTransactions((prev) => [newTransaction, ...prev]);
    setSelectedTransactionId(newId);
    setActiveDetailTab('overview');
  };

  const updateTransactionStage = async (trxId: string, newStage: TransactionStage) => {
    let dbStatus = 'active';
    if (newStage === 'intake') dbStatus = 'pre_listing';
    else if (
      newStage === 'escrow_opened' ||
      newStage === 'inspection' ||
      newStage === 'appraisal_loan' ||
      newStage === 'clear_to_close'
    )
      dbStatus = 'under_contract';
    else if (newStage === 'closed') dbStatus = 'closed';

    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== trxId) return t;
        const note: ActivityNote = {
          id: `act-${Date.now()}`,
          author: 'Lead Broker',
          role: 'Lead Broker',
          content: `Stage updated to: ${newStage.replace(/_/g, ' ').toUpperCase()}`,
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          type: 'status_change',
        };
        const updatedHealth: TransactionHealth = newStage === 'closed' ? 'completed' : t.health;
        return {
          ...t,
          stage: newStage,
          health: updatedHealth,
          actualClosingDate: newStage === 'closed' ? new Date().toISOString().split('T')[0] : t.actualClosingDate,
          activityLog: [note, ...t.activityLog],
        };
      })
    );

    try {
      await (supabase.from('transactions') as any)
        .update({ status: dbStatus, updated_at: new Date().toISOString() })
        .eq('id', trxId);
    } catch (e) {
      console.error('Failed to persist transaction stage update to Supabase:', e);
    }
  };

  const updateContingencyStatus = (
    trxId: string,
    contingencyId: string,
    status: ContingencyStatus,
    notes?: string
  ) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== trxId) return t;
        const updatedContingencies = t.contingencies.map((c) => {
          if (c.id !== contingencyId) return c;
          return {
            ...c,
            status,
            notes: notes !== undefined ? notes : c.notes,
            resolvedDate: status === 'satisfied' || (status as any) === 'complete' || status === 'waived' ? new Date().toISOString().split('T')[0] : c.resolvedDate,
          };
        });

        const targetContingency = t.contingencies.find((c) => c.id === contingencyId);
        const note: ActivityNote = {
          id: `act-${Date.now()}`,
          author: 'Transaction Coordinator',
          role: 'Transaction Coordinator',
          content: `Contingency "${targetContingency?.name || contingencyId}" status changed to ${status.toUpperCase()}${notes ? `: ${notes}` : ''}`,
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          type: 'contingency',
        };

        return {
          ...t,
          contingencies: updatedContingencies,
          activityLog: [note, ...t.activityLog],
        };
      })
    );
  };

  const updateDocumentStatus = (trxId: string, docId: string, status: DocumentStatus) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== trxId) return t;
        const updatedDocs = t.documents.map((d) => {
          if (d.id !== docId) return d;
          return {
            ...d,
            status,
            uploadedAt: status === 'uploaded' || status === 'in_review' || status === 'approved' ? (d.uploadedAt || new Date().toISOString().split('T')[0]) : d.uploadedAt,
          };
        });

        const targetDoc = t.documents.find((d) => d.id === docId);
        const note: ActivityNote = {
          id: `act-${Date.now()}`,
          author: 'Transaction Coordinator',
          role: 'Transaction Coordinator',
          content: `Document "${targetDoc?.name || docId}" marked as ${status.toUpperCase()}`,
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          type: 'document',
        };

        return {
          ...t,
          documents: updatedDocs,
          activityLog: [note, ...t.activityLog],
        };
      })
    );
  };

  const addDocument = (trxId: string, doc: Omit<ComplianceDocument, 'id'>) => {
    const newDoc: ComplianceDocument = {
      ...doc,
      id: `doc-${Date.now()}`,
    };
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== trxId) return t;
        const note: ActivityNote = {
          id: `act-${Date.now()}`,
          author: 'Lead Agent',
          role: 'Lead Broker',
          content: `New compliance document uploaded: "${newDoc.name}" (${newDoc.category})`,
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          type: 'document',
        };
        return {
          ...t,
          documents: [...t.documents, newDoc],
          activityLog: [note, ...t.activityLog],
        };
      })
    );
  };

  const toggleMilestone = async (trxId: string, milestoneId: string) => {
    let milestoneToSync: { completed: boolean } | null = null;
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== trxId) return t;
        const updatedMilestones = t.milestones.map((m) => {
          if (m.id !== milestoneId) return m;
          const nextCompleted = !m.completed;
          milestoneToSync = { completed: nextCompleted };
          return {
            ...m,
            completed: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString().split('T')[0] : undefined,
          };
        });
        return {
          ...t,
          milestones: updatedMilestones,
        };
      })
    );

    if (milestoneToSync && !milestoneId.startsWith('m-new-')) {
      try {
        await (supabase.from('milestones') as any)
          .update({
            status: (milestoneToSync as any).completed ? 'satisfied' : 'pending',
            actual_date: (milestoneToSync as any).completed ? new Date().toISOString().split('T')[0] : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', milestoneId);
      } catch (e) {
        console.error('Failed to persist milestone toggle to Supabase:', e);
      }
    }
  };

  const addActivityNote = (
    trxId: string,
    content: string,
    type: ActivityNote['type'] = 'note',
    author = 'MSREG User',
    role = 'Lead Broker',
    isPinned = false
  ) => {
    const newNote: ActivityNote = {
      id: `act-${Date.now()}`,
      author,
      role,
      content,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      type,
      isPinned,
    };
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== trxId) return t;
        return {
          ...t,
          activityLog: [newNote, ...t.activityLog],
        };
      })
    );
  };

  const updateCommission = (trxId: string, commissionData: Partial<CommissionBreakdown>) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== trxId) return t;
        const current = t.commission;
        const purchasePrice = commissionData.purchasePrice ?? current.purchasePrice;
        const commissionRate = commissionData.commissionRate ?? current.commissionRate;
        const grossCommission = purchasePrice * (commissionRate / 100);
        const agentSplitPercentage = commissionData.agentSplitPercentage ?? current.agentSplitPercentage;
        const agentGrossPayout = grossCommission * (agentSplitPercentage / 100);
        const brokerageGrossSplit = grossCommission - agentGrossPayout;
        const tc = commissionData.transactionCoordinatorFee ?? current.transactionCoordinatorFee;
        const eo = commissionData.eoInsuranceFee ?? current.eoInsuranceFee;
        const admin = commissionData.adminFee ?? current.adminFee;
        const other = commissionData.otherDeductions ?? current.otherDeductions;
        const netAgentPayout = agentGrossPayout - tc - eo - admin - other;

        const updatedCommission: CommissionBreakdown = {
          ...current,
          ...commissionData,
          purchasePrice,
          commissionRate,
          grossCommission,
          agentSplitPercentage,
          agentGrossPayout,
          brokerageGrossSplit,
          transactionCoordinatorFee: tc,
          eoInsuranceFee: eo,
          adminFee: admin,
          otherDeductions: other,
          netAgentPayout,
        };

        const note: ActivityNote = {
          id: `act-${Date.now()}`,
          author: 'Transaction Coordinator',
          role: 'Transaction Coordinator',
          content: `Commission calculations updated. Net payout: $${netAgentPayout.toLocaleString()}`,
          createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
          type: 'document',
        };

        return {
          ...t,
          contractPrice: purchasePrice,
          commission: updatedCommission,
          activityLog: [note, ...t.activityLog],
        };
      })
    );
  };

  const addOrUpdateParty = (trxId: string, party: PartyContact) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== trxId) return t;
        const exists = t.parties.some((p) => p.id === party.id);
        const updatedParties = exists
          ? t.parties.map((p) => (p.id === party.id ? party : p))
          : [...t.parties, party];
        return {
          ...t,
          parties: updatedParties,
        };
      })
    );
  };

  const deleteTransaction = (trxId: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== trxId));
    if (selectedTransactionId === trxId) {
      setSelectedTransactionId(null);
    }
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesAddress = t.address.toLowerCase().includes(q) || (t.unit && t.unit.toLowerCase().includes(q));
        const matchesFile = t.fileNumber.toLowerCase().includes(q);
        const matchesMls = t.mlsId && t.mlsId.toLowerCase().includes(q);
        const matchesClient = t.clientNames.some((c) => c.toLowerCase().includes(q));
        const matchesAgent = t.agentName.toLowerCase().includes(q);
        if (!matchesAddress && !matchesFile && !matchesMls && !matchesClient && !matchesAgent) {
          return false;
        }
      }

      // Representation
      if (filterRepresentation !== 'All' && t.representation !== filterRepresentation) {
        return false;
      }

      // Stage
      if (filterStage !== 'All' && t.stage !== filterStage) {
        return false;
      }

      // Health
      if (filterHealth !== 'All' && t.health !== filterHealth) {
        return false;
      }

      return true;
    });
  }, [transactions, searchQuery, filterRepresentation, filterStage, filterHealth]);

  // High-level Metrics
  const metrics = useMemo(() => {
    const active = transactions.filter((t) => t.stage !== 'closed');
    const activeVolume = active.reduce((acc, t) => acc + t.contractPrice, 0);
    const projectedGci = active.reduce((acc, t) => acc + (t.commission?.grossCommission || 0), 0);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const closingThisMonthCount = active.filter((t) => {
      const closeDate = new Date(t.targetClosingDate);
      return closeDate.getFullYear() === currentYear && closeDate.getMonth() === currentMonth;
    }).length;

    // Urgent alerts: pending contingencies due within 3 days or overdue
    let urgentAlertsCount = 0;
    active.forEach((t) => {
      t.contingencies.forEach((c) => {
        if (c.status === 'pending') {
          const due = new Date(c.dueDate);
          const diffDays = (due.getTime() - now.getTime()) / (1000 * 3600 * 24);
          if (diffDays <= 3) {
            urgentAlertsCount += 1;
          }
        }
      });
    });

    return {
      activeVolume,
      projectedGci,
      activeCount: active.length,
      closingThisMonthCount,
      urgentAlertsCount,
    };
  }, [transactions]);

  return (
    <TransactionContext.Provider
      value={{
        transactions,
        selectedTransaction,
        setSelectedTransactionId,
        activeDetailTab,
        setActiveDetailTab,
        viewMode,
        setViewMode,
        searchQuery,
        setSearchQuery,
        filterRepresentation,
        setFilterRepresentation,
        filterStage,
        setFilterStage,
        filterHealth,
        setFilterHealth,
        isNewModalOpen,
        setIsNewModalOpen,
        isCdaModalOpen,
        setIsCdaModalOpen,
        cdaTransaction,
        openCdaModal,
        closeCdaModal,
        createTransaction,
        updateTransactionStage,
        updateContingencyStatus,
        updateDocumentStatus,
        addDocument,
        toggleMilestone,
        addActivityNote,
        updateCommission,
        addOrUpdateParty,
        deleteTransaction,
        filteredTransactions,
        metrics,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
};

export const useTransactions = () => {
  const context = useContext(TransactionContext);
  if (!context) {
    throw new Error('useTransactions must be used within a TransactionProvider');
  }
  return context;
};
