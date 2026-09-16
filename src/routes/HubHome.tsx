import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTransactions } from '../context/TransactionContext';
import {
  Database,
  Shield,
  Table,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  Users,
  FileSpreadsheet,
  Clock,
  KeyRound,
} from 'lucide-react';

interface HubHomeProps {
  onNavigate: (path: string) => void;
}

export const HubHome: React.FC<HubHomeProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { transactions } = useTransactions();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero Welcome & Overview */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-[#d97706]/15 text-[#d97706] border border-[#d97706]/30">
            <Database className="h-3.5 w-3.5" />
            <span>Supabase Data Layer & Access Control Initialized</span>
          </div>

          <h1 className="font-editorial text-2xl sm:text-4xl font-bold text-[#f8fafc] leading-tight">
            MSREG Transaction Management Module
          </h1>

          <p className="text-sm sm:text-base text-[#94a3b8] leading-relaxed">
            Data layer, PostgreSQL schema, enum types, Row-Level Security (RLS) policies, and
            role-based auth route guards are ready for the MSREG Marketing Hub.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('/my-deals')}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg transition-all"
            >
              <span>Test /my-deals (Agent Route)</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => onNavigate('/ops')}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg transition-all"
            >
              <span>Test /ops (Operations Route)</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Schema & Table Structure Overview */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Table className="h-5 w-5 text-[#d97706]" />
          <h2 className="font-editorial text-xl font-bold text-[#f8fafc]">
            1. Supabase Database Tables & Enums
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Table 1: agents */}
          <div className="p-5 bg-[#1e293b] border border-[#334155] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono-code text-sm font-bold text-[#d97706]">public.agents</span>
              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                RLS Active
              </span>
            </div>
            <p className="text-xs text-[#94a3b8]">
              Stores agent roster, contact details, profile mapping, and Sisu integration IDs.
            </p>
            <div className="p-3 bg-[#131826] rounded-xl font-mono-code text-xs text-[#f8fafc] space-y-1">
              <div>• id (UUID, PK)</div>
              <div>• profile_id (UUID, FK → profiles.id)</div>
              <div>• name (TEXT) & email (TEXT, UNIQUE)</div>
              <div>• phone (TEXT) & sisu_agent_id (TEXT)</div>
              <div>• active (BOOLEAN, default true)</div>
            </div>
          </div>

          {/* Table 2: ops_users */}
          <div className="p-5 bg-[#1e293b] border border-[#334155] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono-code text-sm font-bold text-[#d97706]">
                public.ops_users
              </span>
              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                RLS Active
              </span>
            </div>
            <p className="text-xs text-[#94a3b8]">
              Transaction coordinators, listing coordinators, and administrative staff.
            </p>
            <div className="p-3 bg-[#131826] rounded-xl font-mono-code text-xs text-[#f8fafc] space-y-1">
              <div>• id (UUID, PK)</div>
              <div>• profile_id (UUID, FK → profiles.id)</div>
              <div>• name (TEXT) & email (TEXT, UNIQUE)</div>
              <div>• role (ENUM: 'tc' | 'listing_coordinator' | 'admin')</div>
            </div>
          </div>

          {/* Table 3: transactions */}
          <div className="p-5 bg-[#1e293b] border border-[#334155] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono-code text-sm font-bold text-[#d97706]">
                public.transactions
              </span>
              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                RLS Active
              </span>
            </div>
            <p className="text-xs text-[#94a3b8]">
              Contract-to-close records, property addresses, client info, and dual agent links.
            </p>
            <div className="p-3 bg-[#131826] rounded-xl font-mono-code text-xs text-[#f8fafc] space-y-1">
              <div>• id (UUID, PK) & sisu_transaction_id (TEXT)</div>
              <div>• status, property_address, city, side</div>
              <div>• client_name, client_phone, other_party_name</div>
              <div>• listing_agent_id (FK → agents.id)</div>
              <div>• selling_agent_id (FK → agents.id)</div>
              <div>• assigned_tc_id (FK → ops_users.id)</div>
              <div>• contract_date, created_at, updated_at</div>
            </div>
          </div>

          {/* Table 4: milestones */}
          <div className="p-5 bg-[#1e293b] border border-[#334155] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono-code text-sm font-bold text-[#d97706]">
                public.milestones
              </span>
              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                RLS Active
              </span>
            </div>
            <p className="text-xs text-[#94a3b8]">
              Standardized milestone checklist with target/actual dates and sources.
            </p>
            <div className="p-3 bg-[#131826] rounded-xl font-mono-code text-xs text-[#f8fafc] space-y-1">
              <div>• id (UUID, PK)</div>
              <div>• transaction_id (FK → transactions.id)</div>
              <div>
                • milestone_type (ENUM: earnest_money, inspection_ordered,
                inspection_notice_sent, inspection_10day, sale_contingency,
                financing_contingency, appraisal_ordered, appraisal_received,
                appraisal_satisfied, title, walk_through, ctc, closing)
              </div>
              <div>• target_date, actual_date</div>
              <div>• status (ENUM: pending, ordered, notice_sent, satisfied, waived, na)</div>
              <div>• source (ENUM: 'sisu' | 'manual')</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row Level Security Policy Matrix */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-400" />
          <h2 className="font-editorial text-xl font-bold text-[#f8fafc]">
            2. Row-Level Security (RLS) Policy Matrix
          </h2>
        </div>

        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#131826] text-[#94a3b8] uppercase text-[11px] font-semibold border-b border-[#334155]">
              <tr>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Transactions Access</th>
                <th className="py-3.5 px-4">Milestones Access</th>
                <th className="py-3.5 px-4">Agents & Ops Admin</th>
                <th className="py-3.5 px-4">Route Guard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]/60 text-xs">
              <tr>
                <td className="py-3.5 px-4 font-bold text-emerald-400">agent</td>
                <td className="py-3.5 px-4 text-[#f8fafc]">
                  SELECT only own deals (where listing_agent_id or selling_agent_id = me)
                </td>
                <td className="py-3.5 px-4 text-[#f8fafc]">
                  SELECT (read-only) milestones on own deals
                </td>
                <td className="py-3.5 px-4 text-[#94a3b8]">Read agents list</td>
                <td className="py-3.5 px-4 font-mono-code text-emerald-400">/my-deals only</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold text-sky-400">tc</td>
                <td className="py-3.5 px-4 text-[#f8fafc]">
                  SELECT, INSERT, UPDATE on ALL transactions
                </td>
                <td className="py-3.5 px-4 text-[#f8fafc]">
                  SELECT, INSERT, UPDATE, DELETE on ALL milestones
                </td>
                <td className="py-3.5 px-4 text-[#94a3b8]">Read agents & ops</td>
                <td className="py-3.5 px-4 font-mono-code text-sky-400">/ops</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold text-indigo-400">listing_coordinator</td>
                <td className="py-3.5 px-4 text-[#f8fafc]">
                  SELECT, INSERT, UPDATE on ALL transactions
                </td>
                <td className="py-3.5 px-4 text-[#f8fafc]">
                  SELECT, INSERT, UPDATE, DELETE on ALL milestones
                </td>
                <td className="py-3.5 px-4 text-[#94a3b8]">Read agents & ops</td>
                <td className="py-3.5 px-4 font-mono-code text-indigo-400">/ops</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-bold text-rose-400">admin</td>
                <td className="py-3.5 px-4 text-[#f8fafc]">
                  Full CRUD + DELETE on ALL transactions
                </td>
                <td className="py-3.5 px-4 text-[#f8fafc]">
                  Full CRUD + DELETE on ALL milestones
                </td>
                <td className="py-3.5 px-4 text-emerald-400 font-semibold">
                  Full CRUD on agents & ops_users
                </td>
                <td className="py-3.5 px-4 font-mono-code text-rose-400">/ops + /admin</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
