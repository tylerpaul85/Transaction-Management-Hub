import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../integrations/supabase/client';
import { OpsTransaction, OpsMilestone, ALL_MILESTONES_CONFIG } from '../types/ops';
import { MilestoneDotSequence } from '../components/MilestoneDotSequence';
import { OpsTransactionDetailModal } from '../components/OpsTransactionDetailModal';
import { AdminUserManagement } from '../components/AdminUserManagement';
import {
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
} from 'lucide-react';

export const OpsDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<OpsTransaction[]>([]);
  const [selectedTx, setSelectedTx] = useState<OpsTransaction | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusText, setSyncStatusText] = useState<string | null>(null);

  // Main Dashboard Tab: 'tc_escrows' | 'lc_listings' | 'all_files' | 'users'
  const [activeSection, setActiveSection] = useState<'tc_escrows' | 'lc_listings' | 'all_files' | 'users'>(
    currentUser?.role === 'listing_coordinator' ? 'lc_listings' : 'tc_escrows'
  );

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [tcFilter, setTcFilter] = useState<string>('All');
  const [agentFilter, setAgentFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [reviewOnlyFilter, setReviewOnlyFilter] = useState<boolean>(false);

  // Quick Add Modals
  const [isAddEscrowModalOpen, setIsAddEscrowModalOpen] = useState(false);
  const [isAddListingModalOpen, setIsAddListingModalOpen] = useState(false);

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

  // Form states for New Listing (LC)
  const [newListingAddress, setNewListingAddress] = useState('');
  const [newListingCity, setNewListingCity] = useState('Waynesville');
  const [newListingState, setNewListingState] = useState('MO');
  const [newListingPrice, setNewListingPrice] = useState('');
  const [newListingMls, setNewListingMls] = useState('');
  const [newListingStatus, setNewListingStatus] = useState<'pre_listing' | 'coming_soon' | 'active'>('active');
  const [newListingClient, setNewListingClient] = useState('');
  const [newListingClientPhone, setNewListingClientPhone] = useState('');
  const [newListingDate, setNewListingDate] = useState('');
  const [newListingAgent, setNewListingAgent] = useState('');
  const [newListingPhotoStatus, setNewListingPhotoStatus] = useState<'pending' | 'scheduled' | 'completed'>('scheduled');

  const loadLiveTransactions = async () => {
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
        .limit(10000);

      if (error) {
        console.warn('Could not fetch Supabase transactions:', error);
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
            days_on_market: t.days_on_market || (t.contract_date ? 14 : 7),
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
      await loadLiveTransactions();
    } catch (err) {
      console.error('Failed to create escrow transaction:', err);
      alert('Could not save transaction. Check console for details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Listing (LC)
  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListingAddress.trim()) return;

    setIsSubmitting(true);
    try {
      const numericPrice = parseFloat(newListingPrice.replace(/[^0-9.]/g, '')) || null;

      const { error: txErr } = await (supabase.from('transactions') as any).insert({
        property_address: newListingAddress,
        city: newListingCity,
        side: 'seller',
        status: newListingStatus,
        client_name: newListingClient || 'Property Seller',
        client_phone: newListingClientPhone || null,
        price: numericPrice,
        contract_date: newListingDate || new Date().toISOString().split('T')[0],
      });

      if (txErr) throw txErr;

      setIsAddListingModalOpen(false);
      setNewListingAddress('');
      setNewListingPrice('');
      setNewListingMls('');
      setNewListingClient('');
      setNewListingClientPhone('');
      await loadLiveTransactions();
    } catch (err) {
      console.error('Failed to create listing:', err);
      alert('Could not save listing. Check console for details.');
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

  const handleSaveTransaction = (updatedTx: OpsTransaction) => {
    setTransactions((prev) => prev.map((t) => (t.id === updatedTx.id ? updatedTx : t)));
    setSelectedTx(updatedTx);
  };

  // Distinct Filter Options
  const tcOptions = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => { if (t.tc_name) set.add(t.tc_name); });
    return Array.from(set).sort();
  }, [transactions]);

  const agentOptions = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => { if (t.agent_name) set.add(t.agent_name); });
    return Array.from(set).sort();
  }, [transactions]);

  const allStatusOptions = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => { if (t.status) set.add(t.status); });
    return Array.from(set).sort();
  }, [transactions]);

  // Section Segmented Lists
  const tcEscrows = useMemo(() => {
    return transactions.filter((t) => {
      const s = (t.status || '').toLowerCase().replace(/_/g, ' ');
      return (
        s.includes('under contract') ||
        s.includes('pending') ||
        s.includes('escrow') ||
        s.includes('close') ||
        s.includes('needed') ||
        s.includes('offer') ||
        Boolean(t.contract_date && !s.includes('closed'))
      );
    });
  }, [transactions]);

  const lcListings = useMemo(() => {
    return transactions.filter((t) => {
      const s = (t.status || '').toLowerCase().replace(/_/g, ' ');
      const isSeller = (t.side || '').toLowerCase() === 'seller';
      return (
        isSeller ||
        s.includes('listing') ||
        s.includes('active') ||
        s.includes('signed') ||
        s.includes('set') ||
        s.includes('met') ||
        s.includes('showing') ||
        s.includes('pre') ||
        s.includes('coming') ||
        s.includes('pipeline')
      );
    });
  }, [transactions]);

  // Active Filtered List based on selected Tab
  const displayList = useMemo(() => {
    let baseList = transactions;
    if (activeSection === 'tc_escrows') baseList = tcEscrows;
    else if (activeSection === 'lc_listings') baseList = lcListings;

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
  }, [transactions, activeSection, tcEscrows, lcListings, statusFilter, tcFilter, agentFilter, reviewOnlyFilter, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const needsReview = transactions.filter((t) => t.flagged_for_review).length;
    const totalEscrows = tcEscrows.length;
    const totalListings = lcListings.length;
    let manualMilestonesCount = 0;
    let totalMilestonesCount = 0;

    transactions.forEach((t) => {
      t.milestones.forEach((m) => {
        totalMilestonesCount++;
        if (m.source === 'manual') manualMilestonesCount++;
      });
    });

    return {
      needsReview,
      totalEscrows,
      totalListings,
      manualMilestonesCount,
      totalMilestonesCount,
    };
  }, [transactions, tcEscrows, lcListings]);

  if (!currentUser) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header & Coordinator Hub Bar */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-[#d97706]/15 border border-[#d97706]/30 text-[#d97706]">
                <Settings className="h-4 w-4" />
              </span>
              <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-[#f8fafc]">
                Operations & Coordination Command Center
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30 uppercase">
                {currentUser.role.replace('_', ' ')} View
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#94a3b8]">
              Manage live TC escrows and LC listing pipelines, audit Sisu sync, and track contract milestones in real time.
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
              <span>{isSyncing ? 'Syncing...' : 'Sync Sisu Deals'}</span>
            </button>

            {/* Quick Add Buttons */}
            <button
              onClick={() => setIsAddEscrowModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500 text-sky-300 hover:text-[#0f172a] border border-sky-500/40 text-xs font-bold transition-all flex items-center gap-1.5 min-h-[40px]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ Add Escrow (TC)</span>
            </button>

            <button
              onClick={() => setIsAddListingModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#d97706]/20 hover:bg-[#d97706] text-[#d97706] hover:text-[#0f172a] border border-[#d97706]/40 text-xs font-bold transition-all flex items-center gap-1.5 min-h-[40px]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ Add Listing (LC)</span>
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

        {/* Coordinator Workspace Tab Switcher Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#334155]">
          <div className="flex items-center bg-[#131826] p-1.5 rounded-2xl border border-[#334155] gap-1">
            {/* TC Tab */}
            <button
              onClick={() => setActiveSection('tc_escrows')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSection === 'tc_escrows'
                  ? 'bg-sky-500 text-[#0f172a] shadow-lg'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>TC: Under-Contract Escrows ({metrics.totalEscrows})</span>
            </button>

            {/* LC Tab */}
            <button
              onClick={() => setActiveSection('lc_listings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSection === 'lc_listings'
                  ? 'bg-[#d97706] text-[#0f172a] shadow-lg'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              <Home className="h-4 w-4" />
              <span>LC: Current Listings ({metrics.totalListings})</span>
            </button>

            {/* All Files Tab */}
            <button
              onClick={() => setActiveSection('all_files')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSection === 'all_files'
                  ? 'bg-[#334155] text-[#f8fafc] shadow-lg'
                  : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              <Layers className="h-4 w-4 text-slate-300" />
              <span>All Master Files ({transactions.length})</span>
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
              TC Active Escrows
            </span>
            <span className="font-mono-code text-base sm:text-lg font-bold text-sky-400">
              {metrics.totalEscrows} Files
            </span>
          </div>

          <div className="p-3 bg-[#131826] rounded-xl border border-[#334155]">
            <span className="text-[11px] text-[#94a3b8] block font-medium uppercase tracking-wider">
              LC Current Listings
            </span>
            <span className="font-mono-code text-base sm:text-lg font-bold text-[#d97706]">
              {metrics.totalListings} Listings
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

          <div className="p-3 bg-[#131826] rounded-xl border border-[#334155]">
            <span className="text-[11px] text-[#94a3b8] block font-medium uppercase tracking-wider">
              Provenance Protection
            </span>
            <span className="font-mono-code text-base sm:text-lg font-bold text-slate-300">
              {metrics.manualMilestonesCount} Manual Protected
            </span>
          </div>
        </div>
      </div>

      {/* Main Routed Area */}
      {activeSection === 'users' && currentUser.role === 'admin' ? (
        <AdminUserManagement />
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
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-[#334155] bg-[#131826] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-editorial text-base font-bold text-[#f8fafc]">
                  {activeSection === 'tc_escrows' && `TC Escrows Under Contract (${displayList.length})`}
                  {activeSection === 'lc_listings' && `LC Listings Pipeline (${displayList.length})`}
                  {activeSection === 'all_files' && `Master Deals (${displayList.length})`}
                </h2>
              </div>
              <span className="text-xs text-[#94a3b8]">
                Click any row to open the complete details & milestone sheet
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#131826]/70 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider border-b border-[#334155]">
                  <tr>
                    <th className="py-3.5 px-3 text-center">Review</th>
                    <th className="py-3.5 px-4">Property Address</th>
                    <th className="py-3.5 px-4">Client</th>
                    <th className="py-3.5 px-3">Status / Side</th>
                    {activeSection === 'lc_listings' ? (
                      <>
                        <th className="py-3.5 px-3">Listing Price</th>
                        <th className="py-3.5 px-3">MLS / Photos</th>
                        <th className="py-3.5 px-3">DOM</th>
                      </>
                    ) : (
                      <>
                        <th className="py-3.5 px-3">Contract Date</th>
                        <th className="py-3.5 px-4">
                          <div className="flex items-center gap-1">
                            <span>Milestones</span>
                            <span className="text-[10px] text-slate-500 font-mono-code font-normal">
                              (EMD → INSP → APP → FIN → TITLE → CTC → CLOSE)
                            </span>
                          </div>
                        </th>
                      </>
                    )}
                    <th className="py-3.5 px-4">Assigned TC / Agent</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]/60">
                  {displayList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-[#94a3b8]">
                        <div className="max-w-md mx-auto space-y-3">
                          <Building className="h-10 w-10 mx-auto text-[#94a3b8]/30" />
                          <p className="font-bold text-[#f8fafc] text-base">No active records found</p>
                          <p className="text-xs text-[#94a3b8]">
                            {activeSection === 'lc_listings'
                              ? 'No seller listings are currently in the database. Add a new listing below or sync with Sisu.'
                              : 'No contract-to-close escrow files found. Add an under-contract deal or sync with Sisu.'}
                          </p>
                          <div className="flex items-center justify-center gap-3 pt-2">
                            {activeSection === 'lc_listings' ? (
                              <button
                                onClick={() => setIsAddListingModalOpen(true)}
                                className="px-4 py-2 bg-[#d97706] text-[#0f172a] rounded-xl font-bold text-xs hover:bg-[#b45309] transition-all"
                              >
                                + Add First Listing
                              </button>
                            ) : (
                              <button
                                onClick={() => setIsAddEscrowModalOpen(true)}
                                className="px-4 py-2 bg-sky-500 text-[#0f172a] rounded-xl font-bold text-xs hover:bg-sky-400 transition-all"
                              >
                                + Add First Escrow Deal
                              </button>
                            )}
                            <button
                              onClick={handleSyncSisu}
                              className="px-4 py-2 bg-[#131826] border border-[#334155] text-[#f8fafc] rounded-xl font-bold text-xs hover:bg-[#1e293b] transition-all"
                            >
                              Sync Sisu Deals
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayList.map((tx) => (
                      <tr
                        key={tx.id}
                        onClick={() => setSelectedTx(tx)}
                        className="hover:bg-[#131826]/60 cursor-pointer transition-colors group"
                      >
                        {/* Friday Review Flag */}
                        <td className="py-3.5 px-3 text-center" onClick={(e) => handleToggleReviewFlag(tx.id, e)}>
                          <button
                            title={
                              tx.flagged_for_review
                                ? 'Flagged for Friday double-check review'
                                : 'Click to flag for Friday review'
                            }
                            className={`p-1.5 rounded-lg border transition-all ${
                              tx.flagged_for_review
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm'
                                : 'bg-[#131826] text-slate-500 border-[#334155] hover:text-amber-400'
                            }`}
                          >
                            <Flag
                              className={`h-4 w-4 ${
                                tx.flagged_for_review ? 'fill-amber-400 text-amber-400' : ''
                              }`}
                            />
                          </button>
                        </td>

                        {/* Property Address */}
                        <td className="py-3.5 px-4">
                          <span className="font-editorial font-bold text-sm text-[#f8fafc] group-hover:text-[#d97706] transition-colors block">
                            {tx.property_address}
                          </span>
                          <span className="text-xs text-[#94a3b8]">
                            {tx.city}, {tx.state || 'IL'} •{' '}
                            <strong className="text-slate-400 font-mono-code">
                              {tx.sisu_transaction_id || 'MSREG Hub Live'}
                            </strong>
                          </span>
                        </td>

                        {/* Client Name & Phone */}
                        <td className="py-3.5 px-4">
                          <span className="font-medium text-[#f8fafc] block">{tx.client_name}</span>
                          {tx.client_phone && (
                            <span className="text-xs text-[#94a3b8] font-mono-code">
                              {tx.client_phone}
                            </span>
                          )}
                        </td>

                        {/* Side / Status */}
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                tx.side === 'buyer'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : 'bg-[#d97706]/15 text-[#d97706] border-[#d97706]/30'
                              }`}
                            >
                              {tx.side} Rep
                            </span>
                            <span className="text-[11px] text-[#94a3b8] capitalize">
                              {tx.status.replace('_', ' ')}
                            </span>
                          </div>
                        </td>

                        {/* LC Columns vs TC Columns */}
                        {activeSection === 'lc_listings' ? (
                          <>
                            <td className="py-3.5 px-3 font-mono-code text-xs text-emerald-400 font-bold">
                              {tx.price
                                ? `$${tx.price.toLocaleString()}`
                                : tx.list_price
                                ? `$${tx.list_price.toLocaleString()}`
                                : '—'}
                            </td>
                            <td className="py-3.5 px-3 text-xs">
                              <span className="text-[#f8fafc] font-mono-code block">
                                MLS: {tx.mls_number || 'Pending'}
                              </span>
                              <span className="text-[11px] text-sky-400">
                                Photos: {tx.photography_status || 'Scheduled'}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 font-mono-code text-xs text-[#94a3b8]">
                              {tx.days_on_market !== undefined ? `${tx.days_on_market}d` : '—'}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3.5 px-3 font-mono-code text-xs text-[#f8fafc]">
                              {tx.contract_date || '—'}
                            </td>
                            <td className="py-3.5 px-4">
                              <MilestoneDotSequence
                                milestones={tx.milestones}
                                onMilestoneClick={() => setSelectedTx(tx)}
                              />
                            </td>
                          </>
                        )}

                        {/* Assigned TC / Agent */}
                        <td className="py-3.5 px-4">
                          <div className="text-xs">
                            <span className="text-sky-400 font-bold block">TC: {tx.tc_name}</span>
                            <span className="text-[#94a3b8] block">Agent: {tx.agent_name}</span>
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedTx(tx)}
                            className="px-3 py-1.5 rounded-xl bg-[#d97706]/15 hover:bg-[#d97706] text-[#d97706] hover:text-[#0f172a] border border-[#d97706]/30 text-xs font-bold transition-all flex items-center gap-1.5 ml-auto"
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span>Edit Sheet</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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

      {/* Add Listing Modal (LC) */}
      {isAddListingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1e293b] border border-[#334155] rounded-3xl w-full max-w-xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#334155] pb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-[#d97706]/20 text-[#d97706] border border-[#d97706]/40">
                  <Home className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-editorial text-xl font-bold text-[#f8fafc]">
                    New Listing Pipeline Intake (LC)
                  </h3>
                  <p className="text-xs text-[#94a3b8]">
                    Add a new property listing for listing coordination, photography, and MLS entry.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddListingModalOpen(false)}
                className="p-1 rounded-lg text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#334155]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateListing} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1">
                  Property Address *
                </label>
                <input
                  type="text"
                  required
                  value={newListingAddress}
                  onChange={(e) => setNewListingAddress(e.target.value)}
                  placeholder="e.g. 1428 N State Parkway"
                  className="w-full px-3.5 py-2.5 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1">
                    Listing Price ($)
                  </label>
                  <input
                    type="text"
                    value={newListingPrice}
                    onChange={(e) => setNewListingPrice(e.target.value)}
                    placeholder="e.g. 1,450,000"
                    className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1">
                    Listing Status
                  </label>
                  <select
                    value={newListingStatus}
                    onChange={(e) => setNewListingStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-xs font-bold text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                  >
                    <option value="active">Active Listing</option>
                    <option value="coming_soon">Coming Soon</option>
                    <option value="pre_listing">Pre-Listing / Preparation</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1">
                    Seller Client Name
                  </label>
                  <input
                    type="text"
                    value={newListingClient}
                    onChange={(e) => setNewListingClient(e.target.value)}
                    placeholder="e.g. Harrison Vanderbilt"
                    className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1">
                    Client Phone
                  </label>
                  <input
                    type="text"
                    value={newListingClientPhone}
                    onChange={(e) => setNewListingClientPhone(e.target.value)}
                    placeholder="(312) 555-7000"
                    className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1">
                    Listing Date
                  </label>
                  <input
                    type="date"
                    value={newListingDate}
                    onChange={(e) => setNewListingDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-xs text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1">
                    Photography Status
                  </label>
                  <select
                    value={newListingPhotoStatus}
                    onChange={(e) => setNewListingPhotoStatus(e.target.value as any)}
                    className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-xs font-bold text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                  >
                    <option value="scheduled">Photography Scheduled</option>
                    <option value="completed">Photos Completed / Edited</option>
                    <option value="pending">Pending Staging</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#334155]">
                <button
                  type="button"
                  onClick={() => setIsAddListingModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#94a3b8] hover:text-[#f8fafc]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-[#d97706] hover:bg-[#b45309] text-[#0f172a] text-xs font-bold transition-all shadow-lg"
                >
                  {isSubmitting ? 'Saving...' : 'Add Listing to Pipeline'}
                </button>
              </div>
            </form>
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
    </div>
  );
};
