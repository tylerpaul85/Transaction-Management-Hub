import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { OpsTransaction, OpsMilestone } from '../types/ops';
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
} from 'lucide-react';

const SEED_OPS_TRANSACTIONS: OpsTransaction[] = [
  {
    id: 't1111111-1111-1111-1111-111111111111',
    sisu_transaction_id: 'SISU-TRX-8901',
    status: 'under_contract',
    property_address: '2100 N Lincoln Park West, Unit 18A',
    city: 'Chicago',
    state: 'IL',
    zip: '60614',
    side: 'buyer',
    client_name: 'Dr. Marcus Vance & Elena Rostova',
    client_phone: '(312) 555-8921',
    client_email: 'mvance@northwestern.edu',
    other_party_name: 'Vanderbilt Trust',
    other_party_agent: 'Victoria Sterling',
    other_party_phone: '(312) 555-4478',
    other_party_brokerage: 'Jameson Sotheby’s Int. Realty',
    listing_agent_id: null,
    selling_agent_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    assigned_tc_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    agent_name: 'Tyler Miller',
    agent_email: 'tyler.agent@msreg.com',
    tc_name: 'Sarah Jenkins',
    tc_email: 'sarah.tc@msreg.com',
    contract_date: '2026-09-08',
    target_closing_date: '2026-10-15',
    flagged_for_review: true, // Needs Friday review
    created_at: '2026-09-08 10:00:00',
    updated_at: '2026-09-16 16:45:00',
    milestones: [
      {
        id: 'm-101',
        transaction_id: 't1111111-1111-1111-1111-111111111111',
        milestone_type: 'earnest_money',
        target_date: '2026-09-11',
        actual_date: '2026-09-10',
        status: 'satisfied',
        source: 'sisu',
        notes: 'Initial $50k wire confirmed by Chicago Title.',
        updated_at: '2026-09-10 11:00:00',
      },
      {
        id: 'm-102',
        transaction_id: 't1111111-1111-1111-1111-111111111111',
        milestone_type: 'inspection_ordered',
        target_date: '2026-09-12',
        actual_date: '2026-09-11',
        status: 'satisfied',
        source: 'sisu',
        notes: 'Home inspection scheduled with Elite Inspection Group.',
        updated_at: '2026-09-11 14:00:00',
      },
      {
        id: 'm-103',
        transaction_id: 't1111111-1111-1111-1111-111111111111',
        milestone_type: 'inspection_notice_sent',
        target_date: '2026-09-16',
        actual_date: '2026-09-15',
        status: 'notice_sent',
        source: 'manual',
        notes: 'Inspection report and repair amendment delivered to seller attorney.',
        updated_at: '2026-09-15 16:45:00',
      },
      {
        id: 'm-104',
        transaction_id: 't1111111-1111-1111-1111-111111111111',
        milestone_type: 'inspection_10day',
        target_date: '2026-09-22',
        actual_date: null,
        status: 'pending',
        source: 'manual', // Manual extension!
        notes: 'Attorney negotiated 4-day inspection extension with seller.',
        updated_at: '2026-09-16 16:45:00',
      },
      {
        id: 'm-105',
        transaction_id: 't1111111-1111-1111-1111-111111111111',
        milestone_type: 'financing_contingency',
        target_date: '2026-10-06',
        actual_date: null,
        status: 'pending',
        source: 'sisu',
        notes: 'JPMorgan Chase loan commitment deadline.',
        updated_at: '2026-09-08 10:00:00',
      },
      {
        id: 'm-106',
        transaction_id: 't1111111-1111-1111-1111-111111111111',
        milestone_type: 'appraisal_satisfied',
        target_date: '2026-09-29',
        actual_date: null,
        status: 'pending',
        source: 'sisu',
        notes: 'Appraisal condition clearance.',
        updated_at: '2026-09-08 10:00:00',
      },
      {
        id: 'm-107',
        transaction_id: 't1111111-1111-1111-1111-111111111111',
        milestone_type: 'title',
        target_date: '2026-09-22',
        actual_date: null,
        status: 'pending',
        source: 'sisu',
        notes: 'Chicago Title commitment Schedule B review.',
        updated_at: '2026-09-08 10:00:00',
      },
      {
        id: 'm-108',
        transaction_id: 't1111111-1111-1111-1111-111111111111',
        milestone_type: 'ctc',
        target_date: '2026-10-09',
        actual_date: null,
        status: 'pending',
        source: 'sisu',
        notes: 'Target Clear-To-Close.',
        updated_at: '2026-09-08 10:00:00',
      },
      {
        id: 'm-109',
        transaction_id: 't1111111-1111-1111-1111-111111111111',
        milestone_type: 'closing',
        target_date: '2026-10-15',
        actual_date: null,
        status: 'pending',
        source: 'sisu',
        notes: 'Scheduled settlement at Chicago Title.',
        updated_at: '2026-09-08 10:00:00',
      },
    ],
  },
  {
    id: 't2222222-2222-2222-2222-222222222222',
    sisu_transaction_id: 'SISU-TRX-8902',
    status: 'active',
    property_address: '1428 N State Parkway',
    city: 'Chicago',
    state: 'IL',
    zip: '60610',
    side: 'seller',
    client_name: 'Harrison & Claire Vanderbilt',
    client_phone: '(312) 555-7001',
    other_party_name: 'Jonathan Sterling',
    other_party_agent: 'Alexander Wright',
    other_party_phone: '(312) 555-9832',
    other_party_brokerage: '@properties Christie’s Int.',
    listing_agent_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    selling_agent_id: null,
    assigned_tc_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    agent_name: 'Sophia Montgomery',
    tc_name: 'Sarah Jenkins',
    contract_date: '2026-08-20',
    target_closing_date: '2026-09-22',
    flagged_for_review: false,
    reviewed_at: '2026-09-12 11:30:00',
    reviewed_by: 'Sarah Jenkins (TC)',
    created_at: '2026-08-20 14:30:00',
    updated_at: '2026-09-14 09:30:00',
    milestones: [
      {
        id: 'm-201',
        transaction_id: 't2222222-2222-2222-2222-222222222222',
        milestone_type: 'earnest_money',
        target_date: '2026-08-24',
        actual_date: '2026-08-22',
        status: 'satisfied',
        source: 'sisu',
        notes: 'Earnest money $100k verified.',
        updated_at: '2026-08-22 10:00:00',
      },
      {
        id: 'm-202',
        transaction_id: 't2222222-2222-2222-2222-222222222222',
        milestone_type: 'inspection_10day',
        target_date: '2026-08-30',
        actual_date: '2026-08-29',
        status: 'satisfied',
        source: 'manual',
        notes: 'Inspection repair credit agreed at $4,500.',
        updated_at: '2026-08-29 15:00:00',
      },
      {
        id: 'm-203',
        transaction_id: 't2222222-2222-2222-2222-222222222222',
        milestone_type: 'appraisal_satisfied',
        target_date: '2026-09-08',
        actual_date: '2026-09-07',
        status: 'satisfied',
        source: 'sisu',
        notes: 'Appraised at full contract value of $3,850,000.',
        updated_at: '2026-09-07 16:00:00',
      },
      {
        id: 'm-204',
        transaction_id: 't2222222-2222-2222-2222-222222222222',
        milestone_type: 'financing_contingency',
        target_date: '2026-09-14',
        actual_date: '2026-09-13',
        status: 'satisfied',
        source: 'sisu',
        notes: 'Full loan commitment granted.',
        updated_at: '2026-09-13 14:00:00',
      },
      {
        id: 'm-205',
        transaction_id: 't2222222-2222-2222-2222-222222222222',
        milestone_type: 'title',
        target_date: '2026-09-10',
        actual_date: '2026-09-10',
        status: 'satisfied',
        source: 'sisu',
        notes: 'First American Title cleared all liens.',
        updated_at: '2026-09-10 11:00:00',
      },
      {
        id: 'm-206',
        transaction_id: 't2222222-2222-2222-2222-222222222222',
        milestone_type: 'ctc',
        target_date: '2026-09-14',
        actual_date: '2026-09-14',
        status: 'satisfied',
        source: 'sisu',
        notes: 'Clear To Close delivered.',
        updated_at: '2026-09-14 09:30:00',
      },
      {
        id: 'm-207',
        transaction_id: 't2222222-2222-2222-2222-222222222222',
        milestone_type: 'closing',
        target_date: '2026-09-22',
        actual_date: null,
        status: 'pending',
        source: 'sisu',
        notes: 'Settlement at First American Title.',
        updated_at: '2026-08-20 14:30:00',
      },
    ],
  },
  {
    id: 't3333333-3333-3333-3333-333333333333',
    sisu_transaction_id: 'SISU-TRX-8903',
    status: 'pending',
    property_address: '450 E Waterside Drive, Penthouse 4201',
    city: 'Chicago',
    state: 'IL',
    zip: '60601',
    side: 'buyer',
    client_name: 'Liam & Vivienne Sterling',
    client_phone: '(312) 555-3211',
    other_party_name: 'Waterside Holdings LLC',
    other_party_agent: 'Erika Thorne',
    other_party_phone: '(312) 555-6677',
    other_party_brokerage: 'Compass Real Estate',
    listing_agent_id: null,
    selling_agent_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    assigned_tc_id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    agent_name: 'Tyler Miller',
    tc_name: 'Sarah Jenkins',
    contract_date: '2026-09-12',
    target_closing_date: '2026-10-28',
    flagged_for_review: true, // Needs Friday review
    created_at: '2026-09-12 09:15:00',
    updated_at: '2026-09-16 09:15:00',
    milestones: [
      {
        id: 'm-301',
        transaction_id: 't3333333-3333-3333-3333-333333333333',
        milestone_type: 'earnest_money',
        target_date: '2026-09-17',
        actual_date: null,
        status: 'pending',
        source: 'sisu',
        notes: 'Initial wire instructions issued.',
        updated_at: '2026-09-12 09:15:00',
      },
      {
        id: 'm-302',
        transaction_id: 't3333333-3333-3333-3333-333333333333',
        milestone_type: 'inspection_ordered',
        target_date: '2026-09-18',
        actual_date: '2026-09-15',
        status: 'ordered',
        source: 'manual',
        notes: 'Inspector booked for Friday.',
        updated_at: '2026-09-15 11:00:00',
      },
      {
        id: 'm-303',
        transaction_id: 't3333333-3333-3333-3333-333333333333',
        milestone_type: 'inspection_10day',
        target_date: '2026-09-24',
        actual_date: null,
        status: 'pending',
        source: 'sisu',
        notes: '10-day period begins upon mutual acceptance.',
        updated_at: '2026-09-12 09:15:00',
      },
      {
        id: 'm-304',
        transaction_id: 't3333333-3333-3333-3333-333333333333',
        milestone_type: 'financing_contingency',
        target_date: '2026-10-18',
        actual_date: null,
        status: 'pending',
        source: 'sisu',
        notes: 'Mortgage commitment due.',
        updated_at: '2026-09-12 09:15:00',
      },
      {
        id: 'm-305',
        transaction_id: 't3333333-3333-3333-3333-333333333333',
        milestone_type: 'closing',
        target_date: '2026-10-28',
        actual_date: null,
        status: 'pending',
        source: 'sisu',
        notes: 'Target closing date.',
        updated_at: '2026-09-12 09:15:00',
      },
    ],
  },
];

export const OpsDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<OpsTransaction[]>(SEED_OPS_TRANSACTIONS);
  const [selectedTx, setSelectedTx] = useState<OpsTransaction | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [tcFilter, setTcFilter] = useState<string>('All');
  const [agentFilter, setAgentFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [reviewOnlyFilter, setReviewOnlyFilter] = useState<boolean>(false);
  const [opsTab, setOpsTab] = useState<'transactions' | 'users'>('transactions');

  // Toggle Friday review flag
  const handleToggleReviewFlag = (txId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id !== txId) return t;
        const nextFlag = !t.flagged_for_review;
        return {
          ...t,
          flagged_for_review: nextFlag,
          reviewed_at: nextFlag ? new Date().toISOString() : null,
          reviewed_by: nextFlag ? `${currentUser.fullName} (${currentUser.role.toUpperCase()})` : null,
          updated_at: new Date().toISOString(),
        };
      })
    );
  };

  const handleSaveTransaction = (updatedTx: OpsTransaction) => {
    setTransactions((prev) => prev.map((t) => (t.id === updatedTx.id ? updatedTx : t)));
    setSelectedTx(updatedTx);
  };

  // Distinct Filter Options
  const tcOptions = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => set.add(t.tc_name));
    return Array.from(set);
  }, [transactions]);

  const agentOptions = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => set.add(t.agent_name));
    return Array.from(set);
  }, [transactions]);

  // Filtered List
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (statusFilter !== 'All' && t.status !== statusFilter) return false;
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
  }, [transactions, statusFilter, tcFilter, agentFilter, reviewOnlyFilter, searchQuery]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const needsReview = transactions.filter((t) => t.flagged_for_review).length;
    const totalActive = transactions.filter((t) => t.status !== 'closed').length;
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
      totalActive,
      manualMilestonesCount,
      totalMilestonesCount,
    };
  }, [transactions]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Dashboard Top Header & Metrics */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400">
                <Settings className="h-4 w-4" />
              </span>
              <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-[#f8fafc]">
                Operations & TC Command Center
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30 uppercase">
                {currentUser.role} View
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#94a3b8]">
              Manage contract-to-close files, verify milestone sequences, and audit Sisu vs Manual
              data provenance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Admin-only Tab Switcher */}
            {currentUser.role === 'admin' && (
              <div className="flex items-center bg-[#131826] p-1 rounded-2xl border border-[#334155]">
                <button
                  onClick={() => setOpsTab('transactions')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
                    opsTab === 'transactions'
                      ? 'bg-[#1e293b] text-[#f8fafc] border border-[#334155] shadow-md'
                      : 'text-[#94a3b8] hover:text-[#f8fafc]'
                  }`}
                >
                  <Building className="h-4 w-4 text-[#d97706]" />
                  <span>Escrow Files</span>
                </button>
                <button
                  onClick={() => setOpsTab('users')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] ${
                    opsTab === 'users'
                      ? 'bg-[#1e293b] text-[#f8fafc] border border-[#334155] shadow-md'
                      : 'text-[#94a3b8] hover:text-[#f8fafc]'
                  }`}
                >
                  <Users className="h-4 w-4 text-emerald-400" />
                  <span>User Allowlist & Access</span>
                </button>
              </div>
            )}

            <button
              onClick={() => setReviewOnlyFilter(!reviewOnlyFilter)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all min-h-[44px] ${
                reviewOnlyFilter
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-md'
                  : 'bg-[#131826] text-[#94a3b8] border-[#334155] hover:text-[#f8fafc]'
              }`}
            >
              <Flag className={`h-4 w-4 ${reviewOnlyFilter ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span>
                {reviewOnlyFilter ? 'Showing Friday Review Only' : 'Friday Review Queue'}
              </span>
              {metrics.needsReview > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-[#0f172a] text-[10px] font-bold">
                  {metrics.needsReview}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#334155]/60">
          <div className="p-3 bg-[#131826] rounded-xl border border-[#334155]">
            <span className="text-[11px] text-[#94a3b8] block font-medium uppercase tracking-wider">
              Active Escrows
            </span>
            <span className="font-mono-code text-base sm:text-lg font-bold text-[#f8fafc]">
              {metrics.totalActive} Deals
            </span>
          </div>

          <div className="p-3 bg-[#131826] rounded-xl border border-[#334155]">
            <span className="text-[11px] text-[#94a3b8] block font-medium uppercase tracking-wider">
              Friday Review Flagged
            </span>
            <span className="font-mono-code text-base sm:text-lg font-bold text-amber-400">
              {metrics.needsReview} Files
            </span>
          </div>

          <div className="p-3 bg-[#131826] rounded-xl border border-[#334155]">
            <span className="text-[11px] text-[#94a3b8] block font-medium uppercase tracking-wider">
              Sisu Synced Milestones
            </span>
            <span className="font-mono-code text-base sm:text-lg font-bold text-slate-300">
              {metrics.totalMilestonesCount - metrics.manualMilestonesCount} /{' '}
              {metrics.totalMilestonesCount}
            </span>
          </div>

          <div className="p-3 bg-[#131826] rounded-xl border border-[#334155]">
            <span className="text-[11px] text-[#94a3b8] block font-medium uppercase tracking-wider">
              Manual Edit Protected
            </span>
            <span className="font-mono-code text-base sm:text-lg font-bold text-sky-400">
              {metrics.manualMilestonesCount} Fields
            </span>
          </div>
        </div>
      </div>

      {/* Render Admin User Management when tab is 'users' */}
      {opsTab === 'users' && currentUser.role === 'admin' ? (
        <AdminUserManagement />
      ) : (
        <>

      {/* Filter Toolbar */}
      <div className="bg-[#1e293b] p-4 rounded-2xl border border-[#334155] flex flex-wrap items-center justify-between gap-3 shadow-md">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search address, client, Sisu ID, co-op agent..."
            className="w-full pl-10 pr-4 py-2 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] placeholder-[#94a3b8] focus:outline-none focus:border-[#d97706]"
          />
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-[#131826] border border-[#334155] rounded-xl text-xs font-semibold text-[#f8fafc] focus:outline-none focus:border-[#d97706] cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="under_contract">Under Contract</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="closed">Closed</option>
          </select>

          {/* TC Filter */}
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

          {/* Agent Filter */}
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

      {/* Main Transactions Table */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#334155] bg-[#131826] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-editorial text-base font-bold text-[#f8fafc]">
              Active Transactions ({filteredTransactions.length})
            </h2>
          </div>
          <span className="text-xs text-[#94a3b8]">
            Click any row to open the full standardized sheet
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#131826]/70 text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider border-b border-[#334155]">
              <tr>
                <th className="py-3.5 px-3 text-center">Review</th>
                <th className="py-3.5 px-4">Property Address</th>
                <th className="py-3.5 px-4">Client Name</th>
                <th className="py-3.5 px-3">Side</th>
                <th className="py-3.5 px-3">Contract Date</th>
                <th className="py-3.5 px-4">
                  <div className="flex items-center gap-1">
                    <span>Milestone Sequence</span>
                    <span className="text-[10px] text-slate-500 font-mono-code font-normal">
                      (EMD → INSP → APP → FIN → TITLE → CTC → CLOSE)
                    </span>
                  </div>
                </th>
                <th className="py-3.5 px-4">Assigned TC / Agent</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]/60">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#94a3b8]">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="hover:bg-[#131826]/60 cursor-pointer transition-colors group"
                  >
                    {/* Friday Review Flag Button */}
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
                          {tx.sisu_transaction_id || 'Local File'}
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

                    {/* Side */}
                    <td className="py-3.5 px-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${
                          tx.side === 'buyer'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-[#d97706]/15 text-[#d97706] border-[#d97706]/30'
                        }`}
                      >
                        {tx.side}
                      </span>
                    </td>

                    {/* Contract Date */}
                    <td className="py-3.5 px-3 font-mono-code text-xs text-[#f8fafc]">
                      {tx.contract_date || '—'}
                    </td>

                    {/* Compact Milestone Sequence */}
                    <td className="py-3.5 px-4">
                      <MilestoneDotSequence
                        milestones={tx.milestones}
                        onMilestoneClick={() => setSelectedTx(tx)}
                      />
                    </td>

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
