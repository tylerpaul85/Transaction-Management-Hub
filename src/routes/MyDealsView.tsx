import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
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

const SEED_AGENT_TRANSACTIONS: OpsTransaction[] = [
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
    flagged_for_review: true,
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
        source: 'manual',
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
    flagged_for_review: true,
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

export const MyDealsView: React.FC = () => {
  const { currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTxId, setExpandedTxId] = useState<string | null>(
    't1111111-1111-1111-1111-111111111111' // default expand first
  );

  // Filter deals to only this agent (enforced by RLS)
  const myDeals = useMemo(() => {
    return SEED_AGENT_TRANSACTIONS.filter((t) => {
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
  }, [currentUser, searchQuery]);

  const toggleExpand = (txId: string) => {
    setExpandedTxId((prev) => (prev === txId ? null : txId));
  };

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
