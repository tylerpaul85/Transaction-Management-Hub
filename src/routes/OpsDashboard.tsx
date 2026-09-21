import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../integrations/supabase/client';
import { OpsTransaction, OpsMilestone, ALL_MILESTONES_CONFIG, resolveTcForAgent } from '../types/ops';
import { MilestoneDotSequence } from '../components/MilestoneDotSequence';
import { OpsTransactionDetailModal } from '../components/OpsTransactionDetailModal';
import { AdminUserManagement } from '../components/AdminUserManagement';
import { AdminTaskMappings } from '../components/AdminTaskMappings';
import { AgentDigestEmailModal } from '../components/AgentDigestEmailModal';
import {
  ListChecks,
  Settings,
  Search,
  Filter,
  Flag,
  CheckCircle2,
  Clock,
  Layers,
  Building,
  Plus,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Eye,
  Edit,
  User,
  Sparkles,
  Users,
  Shield,
  Tag,
  Camera,
  Calendar,
  DollarSign,
  Home,
  Check,
  X,
  LayoutGrid,
  Table,
  Phone,
  ExternalLink,
  Upload,
  Mail,
  Send,
} from 'lucide-react';

export const OpsDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<OpsTransaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<OpsTransaction | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusText, setSyncStatusText] = useState<string | null>(null);

  // Main Dashboard View Section: 'escrows' | 'users' | 'tasks'
  const [activeSection, setActiveSection] = useState<'escrows' | 'users' | 'tasks'>('escrows');
  // Representation Tab: 'all' | 'buyer' | 'seller'
  const [representationTab, setRepresentationTab] = useState<'all' | 'buyer' | 'seller'>('all');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [tcFilter, setTcFilter] = useState<string>('All');
  const [agentFilter, setAgentFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [reviewOnlyFilter, setReviewOnlyFilter] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  // Quick Add Modals
  const [isAddEscrowModalOpen, setIsAddEscrowModalOpen] = useState(false);
  const [isBatchImportModalOpen, setIsBatchImportModalOpen] = useState(false);
  const [batchImportText, setBatchImportText] = useState('');
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const [batchImportSummary, setBatchImportSummary] = useState<string | null>(null);

  // Form states for New Escrow Deal
  const [newEscrowAddress, setNewEscrowAddress] = useState('');
  const [newEscrowCity, setNewEscrowCity] = useState('Waynesville');
  const [newEscrowState, setNewEscrowState] = useState('MO');
  const [newEscrowSide, setNewEscrowSide] = useState<'buyer' | 'seller'>('buyer');
  const [newEscrowClient, setNewEscrowClient] = useState('');
  const [newEscrowClientPhone, setNewEscrowClientPhone] = useState('');
  const [newEscrowContractDate, setNewEscrowContractDate] = useState('');
  const [newEscrowClosingDate, setNewEscrowClosingDate] = useState('');
  const [newEscrowAgent, setNewEscrowAgent] = useState('');
  const [newEscrowTc, setNewEscrowTc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [allAgentProfiles, setAllAgentProfiles] = useState<{ id: string; name: string; email: string }[]>([]);
  const [allOpsUsers, setAllOpsUsers] = useState<{ id: string; name: string; email: string }[]>([]);

  const loadLiveTransactions = async () => {
    try {
      const { data: agentsData } = await supabase.from('agents').select('id, name, email').order('name');
      if (agentsData) {
        setAllAgentProfiles(agentsData);
      }

      const { data: opsData } = await supabase.from('ops_users').select('id, name, email').order('name');
      if (opsData) {
        setAllOpsUsers(opsData);
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
        .limit(10000);

      if (error) {
        console.warn('Could not fetch Supabase transactions:', error);
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
            side: t.side || 'buyer',
            client_name: t.client_name || 'Client',
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
            flagged_for_review: Boolean(t.flagged_for_review),
            created_at: t.created_at,
            updated_at: t.updated_at,
            price: t.price || undefined,
            list_price: t.list_price || undefined,
            mls_number: t.mls_number || undefined,
            listing_date: t.listing_date || undefined,
            photography_status: t.photography_status || 'scheduled',
            sign_lockbox_status: t.sign_lockbox_status || 'installed',
            custom_fields: t.custom_fields || undefined,
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

        setTransactions(mapped);
        setSelectedTx((prev) => (prev ? mapped.find((t) => t.id === prev.id) || prev : null));
      }
    } catch (err) {
      console.warn('Live transactions query error:', err);
    }
  };

  useEffect(() => {
    loadLiveTransactions();

    const channel = supabase
      .channel('realtime_ops_transactions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => {
          loadLiveTransactions();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'milestones' },
        () => {
          loadLiveTransactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSyncSisu = async () => {
    setIsSyncing(true);
    setSyncStatusText('Pulling Sisu transactions...');
    try {
      const { data, error } = await supabase.functions.invoke('sisu-nightly-reconciliation');
      if (error) throw error;
      setSyncStatusText(`Synced ${data?.transactions_checked || 0} deals from Sisu!`);
      await loadLiveTransactions();
    } catch (err: any) {
      console.error('Sisu manual sync error:', err);
      setSyncStatusText('Sync triggered. Refreshing data...');
      await loadLiveTransactions();
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusText(null), 4000);
    }
  };

  // Run Sisu Batch CSV/JSON Import
  const handleRunBatchImport = async () => {
    if (!batchImportText.trim()) return;
    setIsBatchImporting(true);
    setBatchImportSummary(null);
    try {
      let rows: any[] = [];
      try {
        const parsed = JSON.parse(batchImportText);
        rows = Array.isArray(parsed) ? parsed : (parsed.data || parsed.transactions || parsed.clients || [parsed]);
      } catch {
        const lines = batchImportText.split('\n').filter((l) => l.trim());
        if (lines.length > 0) {
          const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
          const isHeader = headers.some((h) => h.includes('address') || h.includes('client') || h.includes('status') || h.includes('city'));
          const startIdx = isHeader ? 1 : 0;
          for (let i = startIdx; i < lines.length; i++) {
            const vals = lines[i].split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''));
            if (vals.length === 0 || !vals.join('')) continue;
            const obj: any = {};
            if (isHeader) {
              headers.forEach((h, idx) => {
                obj[h] = vals[idx] || '';
              });
            } else {
              obj.property_address = vals[0];
              obj.client_name = vals[1] || 'Client';
              obj.city = vals[2] || 'Waynesville';
              obj.status = vals[3] || 'under_contract';
            }
            rows.push(obj);
          }
        }
      }

      if (rows.length === 0) {
        alert('No valid transaction rows found in input.');
        setIsBatchImporting(false);
        return;
      }

      const validRows = rows.filter((r) => {
        const addr = (r.property_address || r.address || r.address_1 || r['street address'] || r['property address'] || '').trim();
        return addr.length > 0 && addr.toLowerCase() !== 'tbd' && addr.toLowerCase() !== 'unknown address';
      });

      if (validRows.length === 0) {
        alert('No transactions with valid street addresses found in input.');
        setIsBatchImporting(false);
        return;
      }

      const toInsert = validRows.map((r, idx) => {
        const addr =
          r.property_address || r.address || r.address_1 || r['street address'] || r['property address'] || 'Unknown Address';
        let city = r.city || 'Waynesville';
        if (city === 'Chicago') city = 'Waynesville';
        let state = r.state || 'MO';
        if (state === 'IL') state = 'MO';
        const side = String(r.side || r.transaction_side || r.type || 'buyer').toLowerCase().includes('sell')
          ? 'seller'
          : 'buyer';

        let status = String(r.status || r.pipeline_status || r.stage || 'under_contract').toLowerCase();
        if (status.includes('contract') || status.includes('pending') || status.includes('escrow')) {
          status = 'under_contract';
        } else if (status.includes('list') || status.includes('active')) {
          status = 'active';
        }

        const clientName =
          r.client_name || r.client || r.full_name || (r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : 'Client');
        const clientPhone = r.client_phone || r.phone || r['phone number'] || null;

        const rawId = r.sisu_transaction_id || r.id || r.client_id;
        const sisuTxId = rawId ? String(rawId).replace(/^SISU-/, '').trim() : `BATCH-${Date.now()}-${idx}`;

        return {
          property_address: addr,
          city,
          state,
          side,
          status,
          client_name: clientName,
          client_phone: clientPhone,
          contract_date: r.contract_date || r.contractDate || new Date().toISOString().split('T')[0],
          target_closing_date: r.closing_date || r.closingDate || null,
          sisu_transaction_id: String(sisuTxId),
        };
      });

      const { data, error } = await (supabase
        .from('transactions') as any)
        .upsert(toInsert, { onConflict: 'sisu_transaction_id' })
        .select();

      if (error) throw error;

      setBatchImportSummary(`Successfully imported ${data?.length || toInsert.length} deals into Supabase!`);
      await loadLiveTransactions();
    } catch (err: any) {
      console.error('Batch import error:', err);
      alert('Batch import failed: ' + (err.message || String(err)));
    } finally {
      setIsBatchImporting(false);
    }
  };

  // Create Escrow Transaction (TC)
  const handleCreateEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEscrowAddress.trim()) return;

    setIsSubmitting(true);
    try {
      const { data: newTx, error: txErr } = await (supabase
        .from('transactions') as any)
        .insert({
          property_address: newEscrowAddress,
          city: newEscrowCity,
          side: newEscrowSide,
          status: 'under_contract',
          client_name: newEscrowClient || 'New Buyer Client',
          client_phone: newEscrowClientPhone || null,
          contract_date: newEscrowContractDate || new Date().toISOString().split('T')[0],
          target_closing_date: newEscrowClosingDate || null,
          listing_agent_id: newEscrowSide === 'seller' ? (newEscrowAgent || null) : null,
          selling_agent_id: newEscrowSide === 'buyer' ? (newEscrowAgent || null) : null,
          assigned_tc_id: newEscrowTc || null,
        })
        .select()
        .single();

      if (txErr) throw txErr;

      if (newTx) {
        // Initialize default milestones
        const milestoneInserts = ALL_MILESTONES_CONFIG.map((cfg) => ({
          transaction_id: (newTx as any).id,
          milestone_type: cfg.type,
          status: 'pending',
          source: 'manual',
          notes: `Created via TC Intake on ${new Date().toLocaleDateString()}`,
        }));

        await (supabase.from('milestones') as any).insert(milestoneInserts);
      }

      setIsAddEscrowModalOpen(false);
      setNewEscrowAddress('');
      setNewEscrowClient('');
      setNewEscrowClientPhone('');
      setNewEscrowAgent('');
      setNewEscrowTc('');
      await loadLiveTransactions();
    } catch (err: any) {
      console.error('Failed to create escrow transaction:', err);
      alert(`Could not save transaction: ${err?.message || String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };


  // Toggle Friday review flag
  const handleToggleReviewFlag = async (txId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const target = transactions.find((t) => t.id === txId);
    if (!target) return;

    const nextFlag = !target.flagged_for_review;

    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, flagged_for_review: nextFlag } : t))
    );

    try {
      await (supabase
        .from('transactions') as any)
        .update({ flagged_for_review: nextFlag })
        .eq('id', txId);
    } catch (err) {
      console.warn('Could not persist review flag to Supabase:', err);
    }
  };

  const isValidUuid = (str: any) =>
    typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  const handleSaveTransaction = async (updatedTx: OpsTransaction) => {
    setTransactions((prev) => prev.map((t) => (t.id === updatedTx.id ? updatedTx : t)));
    setSelectedTx(updatedTx);

    try {
      const updatePayload: any = {
        property_address: updatedTx.property_address,
        city: updatedTx.city,
        status: updatedTx.status,
        side: updatedTx.side,
        contract_date: updatedTx.contract_date || null,
        client_name: updatedTx.client_name,
        client_phone: updatedTx.client_phone || null,
        client_email: updatedTx.client_email || null,
        other_party_name: updatedTx.other_party_name || null,
        other_party_agent: updatedTx.other_party_agent || null,
        other_party_phone: updatedTx.other_party_phone || null,
        other_party_brokerage: updatedTx.other_party_brokerage || null,
        flagged_for_review: updatedTx.flagged_for_review,
        reviewed_at: updatedTx.reviewed_at || null,
        reviewed_by: updatedTx.reviewed_by || null,
        target_closing_date: updatedTx.target_closing_date || null,
        listing_agent_id: isValidUuid(updatedTx.listing_agent_id) ? updatedTx.listing_agent_id : null,
        selling_agent_id: isValidUuid(updatedTx.selling_agent_id) ? updatedTx.selling_agent_id : null,
        assigned_tc_id: isValidUuid(updatedTx.assigned_tc_id) ? updatedTx.assigned_tc_id : null,
        updated_at: new Date().toISOString(),
      };

      const { error: txErr } = await (supabase
        .from('transactions') as any)
        .update(updatePayload)
        .eq('id', updatedTx.id);

      if (txErr) {
        console.error('Error persisting transaction edit to Supabase:', txErr);
        throw txErr;
      }

      if (updatedTx.milestones && updatedTx.milestones.length > 0) {
        const milestoneUpserts = updatedTx.milestones.map((m) => {
          return {
            transaction_id: updatedTx.id,
            milestone_type: m.milestone_type,
            target_date: m.target_date || null,
            actual_date: m.actual_date || null,
            status: m.status,
            source: m.source,
            notes: m.notes || null,
            updated_at: m.updated_at || new Date().toISOString(),
          };
        });

        const { error: msErr } = await (supabase
          .from('milestones') as any)
          .upsert(milestoneUpserts, { onConflict: 'transaction_id,milestone_type' });

        if (msErr) {
          console.error('Error persisting milestones edit to Supabase:', msErr);
          throw msErr;
        }
      }

      await loadLiveTransactions();
    } catch (err) {
      console.error('Failed to save transaction to Supabase:', err);
      throw err;
    }
  };

  // Distinct Filter Options
  const tcOptions = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => { if (t.tc_name) set.add(t.tc_name); });
    return Array.from(set).sort();
  }, [transactions]);

  const agentOptions = useMemo(() => {
    const set = new Set<string>();
    allAgentProfiles.forEach((a) => { if (a.name) set.add(a.name); });
    transactions.forEach((t) => { if (t.agent_name) set.add(t.agent_name); });
    return Array.from(set).sort();
  }, [allAgentProfiles, transactions]);

  const selectedAgentDealCount = useMemo(() => {
    if (agentFilter === 'All') return transactions.length;
    return transactions.filter(
      (t) => (t.agent_name || '').toLowerCase() === agentFilter.toLowerCase()
    ).length;
  }, [transactions, agentFilter]);

  const selectedAgentEmail = useMemo(() => {
    if (agentFilter === 'All') return '';
    const matchProfile = allAgentProfiles.find(
      (a) => a.name.toLowerCase() === agentFilter.toLowerCase()
    );
    if (matchProfile?.email) return matchProfile.email;
    const matchTx = transactions.find(
      (t) => (t.agent_name || '').toLowerCase() === agentFilter.toLowerCase()
    );
    return matchTx?.agent_email || '';
  }, [allAgentProfiles, transactions, agentFilter]);

  const allStatusOptions = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => { if (t.status) set.add(t.status); });
    return Array.from(set).sort();
  }, [transactions]);

  // Active TC Escrows (Under Contract / Pending)
  const tcEscrows = useMemo(() => {
    return transactions.filter((t) => {
      const s = (t.status || '').toLowerCase().replace(/_/g, ' ').trim();
      if (
        s === 'closed' ||
        s.startsWith('closed') ||
        s.includes('terminated') ||
        s.includes('cancelled') ||
        s.includes('cancel') ||
        s.includes('fell through') ||
        s.includes('archived')
      ) {
        return false;
      }
      return (
        s.includes('under contract') ||
        s.includes('pending') ||
        s.includes('escrow') ||
        s.includes('closing') ||
        s.includes('clear to close') ||
        s.includes('needed') ||
        s.includes('offer') ||
        Boolean(t.contract_date)
      );
    });
  }, [transactions]);

  // Dedicated Buyer and Seller Escrow Files
  const buyerEscrows = useMemo(() => {
    return tcEscrows.filter((t) => (t.side || '').toLowerCase() === 'buyer');
  }, [tcEscrows]);

  const sellerEscrows = useMemo(() => {
    return tcEscrows.filter((t) => (t.side || '').toLowerCase() === 'seller');
  }, [tcEscrows]);

  // Active Filtered List based on selected Representation Tab
  const displayList = useMemo(() => {
    let baseList = tcEscrows;
    if (representationTab === 'buyer') baseList = buyerEscrows;
    else if (representationTab === 'seller') baseList = sellerEscrows;

    return baseList.filter((t) => {
      if (statusFilter !== 'All') {
        const s = (t.status || '').toLowerCase().replace(/_/g, ' ');
        const f = statusFilter.toLowerCase().replace(/_/g, ' ');
        if (s !== f && !s.includes(f) && !f.includes(s)) return false;
      }
      if (tcFilter !== 'All' && t.tc_name !== tcFilter) return false;
      if (agentFilter !== 'All' && t.agent_name !== agentFilter) return false;
      if (reviewOnlyFilter && !t.flagged_for_review) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchAddress = t.property_address.toLowerCase().includes(q);
        const matchClient = t.client_name.toLowerCase().includes(q);
        const matchSisu = t.sisu_transaction_id && t.sisu_transaction_id.toLowerCase().includes(q);
        const matchOther = t.other_party_agent && t.other_party_agent.toLowerCase().includes(q);
        if (!matchAddress && !matchClient && !matchSisu && !matchOther) return false;
      }

      return true;
    });
  }, [tcEscrows, buyerEscrows, sellerEscrows, representationTab, statusFilter, tcFilter, agentFilter, reviewOnlyFilter, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const needsReview = tcEscrows.filter((t) => t.flagged_for_review).length;
    let manualMilestonesCount = 0;
    let totalMilestonesCount = 0;

    tcEscrows.forEach((t) => {
      t.milestones.forEach((m) => {
        totalMilestonesCount++;
        if (m.source === 'manual') manualMilestonesCount++;
      });
    });

    return {
      needsReview,
      totalEscrows: tcEscrows.length,
      buyerEscrows: buyerEscrows.length,
      sellerEscrows: sellerEscrows.length,
      manualMilestonesCount,
      totalMilestonesCount,
    };
  }, [tcEscrows, buyerEscrows, sellerEscrows]);

  if (!currentUser) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header & Coordinator Hub Bar */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-[#d97706]/15 border border-[#d97706]/30 text-[#d97706]">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-[#f8fafc]">
                Transaction Coordination Command Center
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30 uppercase">
                TC Workspace
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#94a3b8]">
              Manage contract-to-close Buyer and Seller escrows, audit Sisu sync, and track contract milestones in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Sisu Sync Button */}
            <button
              onClick={handleSyncSisu}
              disabled={isSyncing}
              className="px-3.5 py-2 rounded-xl bg-[#131826] hover:bg-[#1e293b] text-[#f8fafc] border border-[#334155] text-xs font-bold transition-all flex items-center gap-2 min-h-[40px]"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[#d97706] ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Sisu API'}</span>
            </button>

            {/* Sisu Batch CSV/JSON Import Button */}
            <button
              onClick={() => {
                setBatchImportSummary(null);
                setIsBatchImportModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500 text-purple-300 hover:text-[#0f172a] border border-purple-500/40 text-xs font-bold transition-all flex items-center gap-1.5 min-h-[40px]"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Import Sisu Batch (CSV/JSON)</span>
            </button>

            {/* Quick Add Escrow Button */}
            <button
              onClick={() => {
                setNewEscrowSide(representationTab === 'seller' ? 'seller' : 'buyer');
                setIsAddEscrowModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-[#0f172a] border border-sky-500/40 text-xs font-bold transition-all flex items-center gap-1.5 min-h-[40px]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ Add Escrow Deal</span>
            </button>

            {/* Dynamic Agent Update Email Button */}
            <button
              onClick={() => setIsEmailModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-[#0f172a] border border-emerald-500/40 text-xs font-bold transition-all flex items-center gap-1.5 min-h-[40px] shadow-sm active:scale-[0.98] cursor-pointer"
              title={
                agentFilter === 'All'
                  ? 'Send weekly file update email digests to all agents'
                  : `Send weekly file update email digest to ${agentFilter}`
              }
            >
              <Mail className="h-3.5 w-3.5 text-emerald-400" />
              <span>
                {agentFilter === 'All'
                  ? 'Send Email to All Agents'
                  : `Send Email to ${agentFilter} (${selectedAgentDealCount})`}
              </span>
            </button>

            {/* Friday Review Filter */}
            <button
              onClick={() => setReviewOnlyFilter(!reviewOnlyFilter)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all min-h-[40px] ${
                reviewOnlyFilter
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-md'
                  : 'bg-[#131826] text-[#94a3b8] border-[#334155] hover:text-[#f8fafc]'
              }`}
            >
              <Flag className={`h-3.5 w-3.5 ${reviewOnlyFilter ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span>Friday Review ({metrics.needsReview})</span>
            </button>
          </div>
        </div>

        {/* Sync Status Banner */}
        {syncStatusText && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span>{syncStatusText}</span>
          </div>
        )}

        {/* Workspace Tab Switcher Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#334155]">
          <div className="flex flex-wrap items-center bg-[#131826] p-1.5 rounded-2xl border border-[#334155] gap-1">
            {/* All Escrows Tab */}
            <button
              onClick={() => {
                setActiveSection('escrows');
                setRepresentationTab('all');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSection === 'escrows' && representationTab === 'all'
                  ? 'bg-sky-500 text-[#0f172a] shadow-lg'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>All Escrows ({metrics.totalEscrows})</span>
            </button>

            {/* Buyer Files Tab */}
            <button
              onClick={() => {
                setActiveSection('escrows');
                setRepresentationTab('buyer');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSection === 'escrows' && representationTab === 'buyer'
                  ? 'bg-indigo-500 text-[#0f172a] shadow-lg'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              <User className="h-4 w-4" />
              <span>Buyer Files ({metrics.buyerEscrows})</span>
            </button>

            {/* Seller Files (Pending Listings) Tab */}
            <button
              onClick={() => {
                setActiveSection('escrows');
                setRepresentationTab('seller');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSection === 'escrows' && representationTab === 'seller'
                  ? 'bg-[#d97706] text-[#0f172a] shadow-lg'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              <Home className="h-4 w-4" />
              <span>Seller Files ({metrics.sellerEscrows})</span>
            </button>

            {/* Admin User Management */}
            {currentUser.role === 'admin' && (
              <button
                onClick={() => setActiveSection('users')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeSection === 'users'
                    ? 'bg-emerald-500 text-[#0f172a] shadow-lg'
                    : 'text-[#94a3b8] hover:text-[#f8fafc]'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>User Allowlist & Access</span>
              </button>
            )}

            {/* Admin Sisu Task Mappings */}
            {currentUser.role === 'admin' && (
              <button
                onClick={() => setActiveSection('tasks')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeSection === 'tasks'
                    ? 'bg-amber-500 text-[#0f172a] shadow-lg'
                    : 'text-[#94a3b8] hover:text-[#f8fafc]'
                }`}
              >
                <ListChecks className="h-4 w-4" />
                <span>Sisu Task Mappings</span>
              </button>
            )}
          </div>

          <div className="text-xs text-[#94a3b8] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Real-Time Supabase Active</span>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#334155]/60">
          <div className="p-3 bg-[#131826] rounded-xl border border-[#334155]">
            <span className="text-[11px] text-[#94a3b8] block font-medium uppercase tracking-wider">
              Total Active Escrows
            </span>
            <span className="font-mono-code text-base sm:text-lg font-bold text-sky-400">
              {metrics.totalEscrows} Files
            </span>
          </div>

          <div className="p-3 bg-[#131826] rounded-xl border border-[#334155]">
            <span className="text-[11px] text-[#94a3b8] block font-medium uppercase tracking-wider">
              Buyer Files
            </span>
            <span className="font-mono-code text-base sm:text-lg font-bold text-indigo-400">
              {metrics.buyerEscrows} Files
            </span>
          </div>

          <div className="p-3 bg-[#131826] rounded-xl border border-[#334155]">
            <span className="text-[11px] text-[#94a3b8] block font-medium uppercase tracking-wider">
              Seller Files (Pending Listings)
            </span>
            <span className="font-mono-code text-base sm:text-lg font-bold text-[#d97706]">
              {metrics.sellerEscrows} Files
            </span>
          </div>

          <div className="p-3 bg-[#131826] rounded-xl border border-[#334155]">
            <span className="text-[11px] text-[#94a3b8] block font-medium uppercase tracking-wider">
              Friday Review Flags
            </span>
            <span className="font-mono-code text-base sm:text-lg font-bold text-amber-400">
              {metrics.needsReview} Flagged
            </span>
          </div>
        </div>
      </div>

      {/* Main Routed Area */}
      {activeSection === 'users' && currentUser.role === 'admin' ? (
        <AdminUserManagement />
      ) : activeSection === 'tasks' && currentUser.role === 'admin' ? (
        <AdminTaskMappings />
      ) : (
        <>
          {/* Search & Filter Toolbar */}
          <div className="bg-[#1e293b] p-4 rounded-2xl border border-[#334155] flex flex-wrap items-center justify-between gap-3 shadow-md">
            {/* Search */}
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search address, client, Sisu ID, agent..."
                className="w-full pl-10 pr-4 py-2 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] placeholder-[#94a3b8] focus:outline-none focus:border-[#d97706]"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-[#131826] border border-[#334155] rounded-xl text-xs font-semibold text-[#f8fafc] focus:outline-none focus:border-[#d97706] cursor-pointer"
              >
                <option value="All">All Statuses ({allStatusOptions.length})</option>
                {allStatusOptions.map((st) => (
                  <option key={st} value={st}>
                    {st.replace(/_/g, ' ').toUpperCase()}
                  </option>
                ))}
              </select>

              <select
                value={tcFilter}
                onChange={(e) => setTcFilter(e.target.value)}
                className="px-3 py-2 bg-[#131826] border border-[#334155] rounded-xl text-xs font-semibold text-[#f8fafc] focus:outline-none focus:border-[#d97706] cursor-pointer"
              >
                <option value="All">All Coordinators</option>
                {tcOptions.map((tc) => (
                  <option key={tc} value={tc}>
                    TC: {tc}
                  </option>
                ))}
              </select>

              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                className="px-3 py-2 bg-[#131826] border border-[#334155] rounded-xl text-xs font-semibold text-[#f8fafc] focus:outline-none focus:border-[#d97706] cursor-pointer"
              >
                <option value="All">All Agents</option>
                {agentOptions.map((a) => (
                  <option key={a} value={a}>
                    Agent: {a}
                  </option>
                ))}
              </select>

              {/* Quick-action email button beside agent filter */}
              <button
                onClick={() => setIsEmailModalOpen(true)}
                className="px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-[0.98] cursor-pointer"
                title={
                  agentFilter === 'All'
                    ? 'Send weekly file updates to all agents'
                    : `Send weekly file update to ${agentFilter}`
                }
              >
                <Mail className="h-3.5 w-3.5 text-emerald-400" />
                <span>
                  {agentFilter === 'All' ? 'Email All' : `Email ${agentFilter}`}
                </span>
              </button>
            </div>
          </div>

          {/* Main Content Container with Cards / Table View Toggle */}
          <div className="space-y-4">
            <div className="bg-[#1e293b] p-4 rounded-2xl border border-[#334155] flex items-center justify-between shadow-md">
              <div className="flex items-center gap-2">
                <h2 className="font-editorial text-lg font-bold text-[#f8fafc]">
                  {representationTab === 'all' && `All Active Escrows (${displayList.length})`}
                  {representationTab === 'buyer' && `Buyer Escrow Files (${displayList.length})`}
                  {representationTab === 'seller' && `Seller Escrows / Pending Listings (${displayList.length})`}
                </h2>
              </div>

              {/* View Switcher: Cards vs Table */}
              <div className="flex items-center gap-1 bg-[#131826] p-1 rounded-xl border border-[#334155]">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    viewMode === 'cards'
                      ? 'bg-[#d97706] text-[#0f172a] shadow-md'
                      : 'text-[#94a3b8] hover:text-[#f8fafc]'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>Cards</span>
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    viewMode === 'table'
                      ? 'bg-[#d97706] text-[#0f172a] shadow-md'
                      : 'text-[#94a3b8] hover:text-[#f8fafc]'
                  }`}
                >
                  <Table className="h-3.5 w-3.5" />
                  <span>Table</span>
                </button>
              </div>
            </div>

            {displayList.length === 0 ? (
              <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-12 text-center text-[#94a3b8] space-y-4 shadow-xl">
                <Building className="h-12 w-12 mx-auto text-[#94a3b8]/30" />
                <p className="font-bold text-[#f8fafc] text-lg">No active files found</p>
                <p className="text-xs text-[#94a3b8] max-w-md mx-auto">
                  {representationTab === 'seller'
                    ? 'No pending seller listings match your current filters. Click below to add an escrow deal or adjust your filters.'
                    : representationTab === 'buyer'
                    ? 'No pending buyer files match your current filters. Click below to add an escrow deal or adjust your filters.'
                    : 'No active contract-to-close escrow files match your current filters. Click below to add an escrow deal.'}
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setNewEscrowSide(representationTab === 'seller' ? 'seller' : 'buyer');
                      setIsAddEscrowModalOpen(true);
                    }}
                    className="px-5 py-2.5 bg-[#d97706] text-[#0f172a] rounded-xl font-bold text-xs hover:bg-[#b45309] transition-all shadow-md"
                  >
                    + Add New Escrow File
                  </button>
                </div>
              </div>
            ) : viewMode === 'cards' ? (
              /* CARDS GRID VIEW */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayList.map((tx) => {
                  const isUnderContract = tx.status === 'under_contract' || tx.status === 'pending';

                  return (
                    <div
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="bg-[#1e293b] border border-[#334155] hover:border-[#d97706]/60 rounded-3xl p-5 shadow-xl hover:shadow-2xl transition-all cursor-pointer group flex flex-col justify-between space-y-4 relative overflow-hidden"
                    >
                      {/* Top Header Strip */}
                      <div className="flex items-start justify-between gap-2 border-b border-[#334155]/60 pb-3">
                        <div className="space-y-1">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm ${
                              tx.status === 'under_contract'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : tx.status === 'pending'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                            }`}
                          >
                            {tx.status.replace(/_/g, ' ').toUpperCase()} • {tx.side.toUpperCase()} REP
                          </span>
                          <span className="text-[11px] text-[#94a3b8] font-mono-code block">
                            File ID: {tx.sisu_transaction_id || tx.id.substring(0, 8)}
                          </span>
                        </div>

                        {/* Review Flag */}
                        <button
                          onClick={(e) => handleToggleReviewFlag(tx.id, e)}
                          title={tx.flagged_for_review ? 'Flagged for Friday Review' : 'Flag for Friday Review'}
                          className={`p-2 rounded-xl border transition-all ${
                            tx.flagged_for_review
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm'
                              : 'bg-[#131826] text-slate-500 border-[#334155] hover:text-amber-400'
                          }`}
                        >
                          <Flag className={`h-4 w-4 ${tx.flagged_for_review ? 'fill-amber-400 text-amber-400' : ''}`} />
                        </button>
                      </div>

                      {/* Main Address Headline */}
                      <div className="space-y-1">
                        <h3 className="font-editorial text-lg font-bold text-[#f8fafc] group-hover:text-[#d97706] transition-colors line-clamp-2">
                          {tx.property_address}
                        </h3>
                        <p className="text-xs text-[#94a3b8] font-medium">
                          {tx.city}, {tx.state} {tx.zip}
                        </p>
                      </div>

                      {/* Client Info Block */}
                      <div className="bg-[#131826] p-3 rounded-2xl border border-[#334155]/60 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[#94a3b8] font-medium">Client:</span>
                          <span className="font-bold text-[#f8fafc]">{tx.client_name}</span>
                        </div>
                        {tx.client_phone && (
                          <div className="flex items-center justify-between">
                            <span className="text-[#94a3b8] font-medium">Phone:</span>
                            <a
                              href={`tel:${tx.client_phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="font-mono-code text-sky-400 hover:underline flex items-center gap-1"
                            >
                              <Phone className="h-3 w-3" />
                              <span>{tx.client_phone}</span>
                            </a>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-1 border-t border-[#334155]/40 text-[11px]">
                          <span className="text-sky-400 font-semibold">TC: {tx.tc_name}</span>
                          <span className="text-[#94a3b8] font-medium">Agent: {tx.agent_name}</span>
                        </div>
                      </div>

                      {/* Milestones Strip */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-wider block">
                          Escrow Milestone Progress:
                        </span>
                        <MilestoneDotSequence milestones={tx.milestones} onMilestoneClick={() => setSelectedTx(tx)} />
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-2 border-t border-[#334155]/60 flex items-center justify-between gap-2">
                        <span className="text-xs text-[#94a3b8] font-mono-code">
                          {tx.target_closing_date ? `Close: ${tx.target_closing_date}` : tx.contract_date ? `Contract: ${tx.contract_date}` : 'Active File'}
                        </span>
                        <button
                          onClick={() => setSelectedTx(tx)}
                          className="px-3.5 py-1.5 rounded-xl bg-[#d97706]/15 hover:bg-[#d97706] text-[#d97706] hover:text-[#0f172a] border border-[#d97706]/30 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Inspect File</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TABLE VIEW */
              <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-[#131826] text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider border-b border-[#334155]">
                      <tr>
                        <th className="py-3.5 px-3 text-center">Review</th>
                        <th className="py-3.5 px-4">Property Address</th>
                        <th className="py-3.5 px-4">Client</th>
                        <th className="py-3.5 px-3">Status / Side</th>
                        <th className="py-3.5 px-4">Milestones</th>
                        <th className="py-3.5 px-4">Assigned TC / Agent</th>
                        <th className="py-3.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334155]/60">
                      {displayList.map((tx) => (
                        <tr
                          key={tx.id}
                          onClick={() => setSelectedTx(tx)}
                          className="hover:bg-[#131826]/60 cursor-pointer transition-colors group"
                        >
                          <td className="py-3.5 px-3 text-center" onClick={(e) => handleToggleReviewFlag(tx.id, e)}>
                            <button
                              className={`p-1.5 rounded-lg border transition-all ${
                                tx.flagged_for_review
                                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm'
                                  : 'bg-[#131826] text-slate-500 border-[#334155] hover:text-amber-400'
                              }`}
                            >
                              <Flag className={`h-4 w-4 ${tx.flagged_for_review ? 'fill-amber-400 text-amber-400' : ''}`} />
                            </button>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-editorial font-bold text-sm text-[#f8fafc] group-hover:text-[#d97706] transition-colors block">
                              {tx.property_address}
                            </span>
                            <span className="text-xs text-[#94a3b8]">
                              {tx.city}, {tx.state} • <strong className="text-slate-400 font-mono-code">{tx.sisu_transaction_id || tx.id.substring(0, 8)}</strong>
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-medium text-[#f8fafc] block">{tx.client_name}</span>
                            {tx.client_phone && <span className="text-xs text-[#94a3b8] font-mono-code">{tx.client_phone}</span>}
                          </td>

                          <td className="py-3.5 px-3">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-amber-500/10 text-amber-400 border-amber-500/30">
                              {tx.status.replace(/_/g, ' ').toUpperCase()} ({tx.side.toUpperCase()})
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <MilestoneDotSequence milestones={tx.milestones} onMilestoneClick={() => setSelectedTx(tx)} />
                          </td>

                          <td className="py-3.5 px-4 text-xs">
                            <span className="text-sky-400 font-bold block">TC: {tx.tc_name}</span>
                            <span className="text-[#94a3b8] block">Agent: {tx.agent_name}</span>
                          </td>

                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedTx(tx)}
                              className="px-3 py-1.5 rounded-xl bg-[#d97706]/15 hover:bg-[#d97706] text-[#d97706] hover:text-[#0f172a] border border-[#d97706]/30 text-xs font-bold transition-all ml-auto"
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Escrow Deal Modal (TC) */}
      {isAddEscrowModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1e293b] border border-[#334155] rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#334155] pb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/40">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-editorial text-xl font-bold text-[#f8fafc]">
                    New Escrow Deal Intake (TC)
                  </h3>
                  <p className="text-xs text-[#94a3b8]">
                    Add a contract-to-close file with automatic milestone timeline generation.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddEscrowModalOpen(false)}
                className="p-1 rounded-lg text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#334155]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEscrow} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1">
                  Property Address *
                </label>
                <input
                  type="text"
                  required
                  value={newEscrowAddress}
                  onChange={(e) => setNewEscrowAddress(e.target.value)}
                  placeholder="e.g. 500 N Michigan Ave, Unit 1204"
                  className="w-full px-3.5 py-2.5 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1">City</label>
                  <input
                    type="text"
                    value={newEscrowCity}
                    onChange={(e) => setNewEscrowCity(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1">
                    Representation Side
                  </label>
                  <select
                    value={newEscrowSide}
                    onChange={(e) => setNewEscrowSide(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-xs font-bold text-[#f8fafc] focus:outline-none focus:border-sky-500"
                  >
                    <option value="buyer">Buyer Representation</option>
                    <option value="seller">Seller Representation</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={newEscrowClient}
                    onChange={(e) => setNewEscrowClient(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1">
                    Client Phone
                  </label>
                  <input
                    type="text"
                    value={newEscrowClientPhone}
                    onChange={(e) => setNewEscrowClientPhone(e.target.value)}
                    placeholder="(312) 555-0100"
                    className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1">
                    Contract Date
                  </label>
                  <input
                    type="date"
                    value={newEscrowContractDate}
                    onChange={(e) => setNewEscrowContractDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-xs text-[#f8fafc] focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1">
                    Target Closing Date
                  </label>
                  <input
                    type="date"
                    value={newEscrowClosingDate}
                    onChange={(e) => setNewEscrowClosingDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-xs text-[#f8fafc] focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-amber-400 uppercase mb-1">
                    Lead Team Agent
                  </label>
                  <select
                    value={newEscrowAgent}
                    onChange={(e) => setNewEscrowAgent(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-xs font-semibold text-[#f8fafc] focus:outline-none focus:border-sky-500"
                  >
                    <option value="">-- Select Team Agent --</option>
                    {allAgentProfiles.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-sky-400 uppercase mb-1">
                    Assigned TC / Coordinator
                  </label>
                  <select
                    value={newEscrowTc}
                    onChange={(e) => setNewEscrowTc(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-xs font-semibold text-[#f8fafc] focus:outline-none focus:border-sky-500"
                  >
                    <option value="">-- Unassigned TC --</option>
                    {allOpsUsers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#334155]">
                <button
                  type="button"
                  onClick={() => setIsAddEscrowModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#94a3b8] hover:text-[#f8fafc]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-[#0f172a] text-xs font-bold transition-all shadow-lg"
                >
                  {isSubmitting ? 'Saving...' : 'Create Escrow Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* Sisu Batch CSV/JSON Import Modal */}
      {isBatchImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-6 w-full max-w-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#334155]">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                  <Upload className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-bold text-[#f8fafc]">
                  Import Sisu Batch (CSV or JSON)
                </h3>
              </div>
              <button
                onClick={() => setIsBatchImportModalOpen(false)}
                className="p-1 rounded-lg text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#334155]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-[#94a3b8]">
              Paste your raw Sisu JSON payload, webhooks payload, or CSV exported rows below. The system will automatically normalize property addresses, client contacts, assigned team members, and status codes.
            </p>

            {batchImportSummary && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                <span>{batchImportSummary}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1">
                CSV Lines or JSON Payload *
              </label>
              <textarea
                rows={10}
                value={batchImportText}
                onChange={(e) => setBatchImportText(e.target.value)}
                placeholder={`Example CSV:\nproperty_address,client_name,city,status\n101 Oak Street,John Doe,Waynesville,under_contract\n\nOr paste Sisu JSON array...`}
                className="w-full p-3 bg-[#131826] border border-[#334155] rounded-xl text-xs font-mono text-[#f8fafc] focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#334155]">
              <button
                type="button"
                onClick={() => setIsBatchImportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#94a3b8] hover:text-[#f8fafc]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleRunBatchImport}
                disabled={isBatchImporting || !batchImportText.trim()}
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                <span>{isBatchImporting ? 'Processing Import...' : 'Execute Batch Import'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedTx && (
        <OpsTransactionDetailModal
          transaction={selectedTx}
          onClose={() => setSelectedTx(null)}
          onSave={handleSaveTransaction}
        />
      )}

      {/* Interactive Agent Update Email Dispatch Modal */}
      {isEmailModalOpen && (
        <AgentDigestEmailModal
          agentName={agentFilter}
          agentEmail={selectedAgentEmail}
          transactions={
            agentFilter === 'All'
              ? transactions
              : transactions.filter(
                  (t) => (t.agent_name || '').toLowerCase() === agentFilter.toLowerCase()
                )
          }
          allAgentProfiles={allAgentProfiles}
          onClose={() => setIsEmailModalOpen(false)}
        />
      )}
    </div>
  );
};
