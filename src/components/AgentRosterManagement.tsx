import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../integrations/supabase/client';
import {
  Users,
  Search,
  RefreshCw,
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  UserX,
  UserCheck,
  Shield,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  FileSpreadsheet,
  Briefcase,
  X,
  Loader2,
} from 'lucide-react';
import { syncGoogleRosterToSupabase, GOOGLE_ROSTER_SHEET_URL } from '../utils/googleRosterSync';

export interface AgentRecord {
  id: string;
  profile_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  role: string | null;
  category: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface AgentRosterManagementProps {
  onAgentSelect?: (agentName: string) => void;
}

export const AgentRosterManagement: React.FC<AgentRosterManagementProps> = ({ onAgentSelect }) => {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [dealCounts, setDealCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Add/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingAgent, setEditingAgent] = useState<AgentRecord | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    category: 'Buyer Specialist',
    active: true,
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Delete Confirmation State
  const [deleteCandidate, setDeleteCandidate] = useState<AgentRecord | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  };

  const loadAgentsAndDeals = async () => {
    setLoading(true);
    try {
      // Fetch agents
      const { data: agentsData, error: agentsErr } = await (supabase.from('agents') as any)
        .select('*')
        .order('name');

      if (agentsErr) throw agentsErr;
      setAgents(agentsData || []);

      // Fetch transaction counts per agent
      const { data: txData } = await (supabase.from('transactions') as any)
        .select('id, listing_agent_id, selling_agent_id')
        .not('status', 'in', '("closed","terminated","lost","Lost")');

      if (txData) {
        const counts: Record<string, number> = {};
        txData.forEach((tx: any) => {
          if (tx.listing_agent_id) {
            counts[tx.listing_agent_id] = (counts[tx.listing_agent_id] || 0) + 1;
          }
          if (tx.selling_agent_id && tx.selling_agent_id !== tx.listing_agent_id) {
            counts[tx.selling_agent_id] = (counts[tx.selling_agent_id] || 0) + 1;
          }
        });
        setDealCounts(counts);
      }
    } catch (err: any) {
      console.error('Error loading roster:', err);
      showToast(err.message || 'Failed to load agent roster', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgentsAndDeals();
  }, []);

  const handleSyncGoogleSheet = async () => {
    setIsSyncing(true);
    try {
      const result = await syncGoogleRosterToSupabase();
      if (result.errors.length > 0) {
        showToast(
          `Synced with warnings: Updated ${result.updated}, Added ${result.inserted}. Errors: ${result.errors[0]}`,
          'error'
        );
      } else {
        showToast(
          `Google Sheet Roster synced successfully! Updated ${result.updated} agents, added ${result.inserted} new agents, synced ${result.transactionsUpdated} transactions.`,
          'success'
        );
      }
      await loadAgentsAndDeals();
    } catch (err: any) {
      showToast(err.message || 'Failed to sync with Google Sheet', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleOpenAddModal = () => {
    setModalMode('add');
    setEditingAgent(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'STR Agent',
      category: 'Buyer Specialist',
      active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (agent: AgentRecord) => {
    setModalMode('edit');
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      email: agent.email,
      phone: agent.phone || '',
      role: agent.role || '',
      category: agent.category || 'Buyer Specialist',
      active: agent.active,
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      showToast('Name and email are required.', 'error');
      return;
    }

    const emailNorm = formData.email.trim().toLowerCase();
    setFormSubmitting(true);

    try {
      if (modalMode === 'add') {
        const { data, error } = await (supabase.from('agents') as any).insert({
          name: formData.name.trim(),
          email: emailNorm,
          phone: formData.phone.trim() || null,
          role: formData.role.trim() || null,
          category: formData.category,
          active: formData.active,
        }).select().single();

        if (error) throw error;
        showToast(`Agent "${formData.name}" added successfully.`);
        setAgents((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      } else if (editingAgent) {
        const { error } = await (supabase.from('agents') as any)
          .update({
            name: formData.name.trim(),
            email: emailNorm,
            phone: formData.phone.trim() || null,
            role: formData.role.trim() || null,
            category: formData.category,
            active: formData.active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingAgent.id);

        if (error) throw error;
        showToast(`Agent "${formData.name}" updated successfully.`);

        setAgents((prev) =>
          prev.map((a) =>
            a.id === editingAgent.id
              ? {
                  ...a,
                  name: formData.name.trim(),
                  email: emailNorm,
                  phone: formData.phone.trim() || null,
                  role: formData.role.trim() || null,
                  category: formData.category,
                  active: formData.active,
                }
              : a
          )
        );
      }
      setIsModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Error saving agent.', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleActive = async (agent: AgentRecord) => {
    const nextStatus = !agent.active;
    try {
      await (supabase.from('agents') as any)
        .update({ active: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', agent.id);

      setAgents((prev) =>
        prev.map((a) => (a.id === agent.id ? { ...a, active: nextStatus } : a))
      );
      showToast(`${agent.name} is now marked as ${nextStatus ? 'Active' : 'Inactive'}.`);
    } catch (err: any) {
      showToast(err.message || 'Failed to update agent status', 'error');
    }
  };

  const handleDeleteAgent = async () => {
    if (!deleteCandidate) return;
    try {
      const { error } = await (supabase.from('agents') as any)
        .delete()
        .eq('id', deleteCandidate.id);

      if (error) throw error;
      setAgents((prev) => prev.filter((a) => a.id !== deleteCandidate.id));
      showToast(`Agent "${deleteCandidate.name}" removed.`);
      setDeleteCandidate(null);
    } catch (err: any) {
      showToast(err.message || 'Cannot delete agent with active deals. Mark inactive instead.', 'error');
      setDeleteCandidate(null);
    }
  };

  // Categories list
  const categories = ['All', 'Buyer Specialist', 'Listing Specialist', 'Operations', 'Hybrid Agent', 'Owner'];

  // Filtered agents
  const filteredAgents = useMemo(() => {
    return agents.filter((a) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = a.name.toLowerCase().includes(q);
        const matchEmail = a.email.toLowerCase().includes(q);
        const matchPhone = (a.phone || '').toLowerCase().includes(q);
        const matchRole = (a.role || '').toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchRole) return false;
      }

      // Category
      if (selectedCategory !== 'All') {
        if (a.category !== selectedCategory && !(a.role || '').toLowerCase().includes(selectedCategory.toLowerCase())) {
          return false;
        }
      }

      // Status
      if (statusFilter === 'active' && !a.active) return false;
      if (statusFilter === 'inactive' && a.active) return false;

      return true;
    });
  }, [agents, searchQuery, selectedCategory, statusFilter]);

  // Overall metrics
  const activeCount = useMemo(() => agents.filter((a) => a.active).length, [agents]);
  const totalDealsAcrossAll = useMemo(
    () => Object.values(dealCounts).reduce((sum, count) => sum + count, 0),
    [dealCounts]
  );

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-xl text-sm ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{toast.text}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-xs hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Hero Header & Action Bar */}
      <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#d97706]/20 border border-[#d97706]/40 flex items-center justify-center text-[#d97706]">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#f8fafc] tracking-tight">Agent Directory & Roster</h1>
              <p className="text-xs text-[#94a3b8] mt-0.5">
                Official agent roster and verified email recipients synchronized with MSREG Office Roster.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* External Sheet Link */}
          <a
            href={GOOGLE_ROSTER_SHEET_URL.replace('/gviz/tq?tqx=out:csv&sheet=full%20office%20roster', '/edit')}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 rounded-xl bg-[#131826] hover:bg-[#1a2333] text-[#94a3b8] hover:text-[#f8fafc] border border-[#334155] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Open Live Google Sheet Roster in new tab"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
            <span>Open Google Sheet</span>
            <ExternalLink className="h-3 w-3 text-slate-500 ml-0.5" />
          </a>

          {/* Sync from Google Sheet Button */}
          <button
            onClick={handleSyncGoogleSheet}
            disabled={isSyncing}
            className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-[#0f172a] border border-emerald-500/40 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
            title="Pull the latest emails, phones, and additions directly from Google Sheet"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing Roster...' : 'Sync from Google Sheet'}</span>
          </button>

          {/* Add Agent Button */}
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 rounded-xl bg-[#d97706] hover:bg-amber-500 text-[#0f172a] font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            <span>+ Add Agent</span>
          </button>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#1e293b] p-4 rounded-xl border border-[#334155]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] block">Total Agents</span>
          <span className="font-mono-code text-2xl font-black text-[#f8fafc]">{agents.length}</span>
        </div>
        <div className="bg-[#1e293b] p-4 rounded-xl border border-[#334155]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] block">Active Agents</span>
          <span className="font-mono-code text-2xl font-black text-emerald-400">{activeCount}</span>
        </div>
        <div className="bg-[#1e293b] p-4 rounded-xl border border-[#334155]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] block">Active Escrow Deals</span>
          <span className="font-mono-code text-2xl font-black text-sky-400">{totalDealsAcrossAll}</span>
        </div>
        <div className="bg-[#1e293b] p-4 rounded-xl border border-[#334155]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] block">Filtered Results</span>
          <span className="font-mono-code text-2xl font-black text-amber-400">{filteredAgents.length}</span>
        </div>
      </div>

      {/* Search & Category Filter Ribbon */}
      <div className="bg-[#1e293b] p-4 rounded-2xl border border-[#334155] space-y-3 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by agent name, verified email, phone, or role..."
              className="w-full pl-10 pr-4 py-2 bg-[#131826] border border-[#334155] rounded-xl text-sm text-[#f8fafc] placeholder-[#94a3b8] focus:outline-none focus:border-[#d97706]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#f8fafc] text-xs cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-[#131826] p-1 rounded-xl border border-[#334155]">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'all' ? 'bg-[#d97706] text-[#0f172a]' : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'active' ? 'bg-emerald-500 text-[#0f172a]' : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('inactive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'inactive' ? 'bg-slate-700 text-slate-200' : 'text-[#94a3b8] hover:text-[#f8fafc]'
              }`}
            >
              Inactive
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#334155]">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                  : 'bg-[#131826] text-[#94a3b8] border border-[#334155] hover:text-[#f8fafc]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Agents Table / Cards */}
      {loading ? (
        <div className="bg-[#1e293b] p-12 rounded-2xl border border-[#334155] text-center text-[#94a3b8]">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#d97706] mb-3" />
          <p className="text-sm font-semibold">Loading agent directory...</p>
        </div>
      ) : filteredAgents.length === 0 ? (
        <div className="bg-[#1e293b] p-12 rounded-2xl border border-[#334155] text-center">
          <Users className="h-10 w-10 mx-auto text-[#64748b] mb-3" />
          <h3 className="text-base font-bold text-[#f8fafc]">No Agents Found</h3>
          <p className="text-xs text-[#94a3b8] mt-1 max-w-sm mx-auto">
            No agents matched your current filter criteria. Try clearing your search or click "Sync from Google Sheet".
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setStatusFilter('all');
            }}
            className="mt-4 px-4 py-2 bg-[#131826] hover:bg-[#334155] text-xs font-bold text-sky-400 rounded-xl border border-[#334155] cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="bg-[#1e293b] rounded-2xl border border-[#334155] overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#cbd5e1]">
              <thead className="bg-[#131826] text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] border-b border-[#334155]">
                <tr>
                  <th className="px-5 py-3.5">Agent Name</th>
                  <th className="px-5 py-3.5">Verified Email (Recipient)</th>
                  <th className="px-5 py-3.5">Role / Department</th>
                  <th className="px-5 py-3.5">Phone</th>
                  <th className="px-5 py-3.5 text-center">Active Deals</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]">
                {filteredAgents.map((agent) => {
                  const dealCount = dealCounts[agent.id] || 0;
                  const initials = agent.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr key={agent.id} className="hover:bg-[#1e293b]/60 transition-colors group">
                      {/* Name & Initials */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/30 to-[#d97706]/40 border border-[#d97706]/50 flex items-center justify-center font-bold text-xs text-[#f8fafc]">
                            {initials}
                          </div>
                          <div>
                            <span className="font-bold text-[#f8fafc] block">{agent.name}</span>
                            {agent.category && (
                              <span className="text-[10px] text-[#94a3b8] block">{agent.category}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono-code text-xs text-sky-300 font-medium">
                            {agent.email}
                          </span>
                          <button
                            onClick={() => handleCopyEmail(agent.email)}
                            className="p-1 hover:bg-[#131826] rounded text-[#94a3b8] hover:text-[#f8fafc] transition-all cursor-pointer"
                            title="Copy email"
                          >
                            {copiedEmail === agent.email ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#131826] border border-[#334155] text-[#94a3b8]">
                          {agent.role || 'Agent'}
                        </span>
                      </td>

                      {/* Phone */}
                      <td className="px-5 py-3.5 font-mono-code text-xs text-[#94a3b8]">
                        {agent.phone ? (
                          <a
                            href={`tel:${agent.phone.replace(/[^0-9]/g, '')}`}
                            className="hover:text-[#f8fafc] hover:underline"
                          >
                            {agent.phone}
                          </a>
                        ) : (
                          <span className="text-[#64748b]">—</span>
                        )}
                      </td>

                      {/* Active Deals Count */}
                      <td className="px-5 py-3.5 text-center">
                        {dealCount > 0 ? (
                          <button
                            onClick={() => onAgentSelect && onAgentSelect(agent.name)}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500 hover:text-[#0f172a] transition-all cursor-pointer"
                            title={`View ${dealCount} active escrows for ${agent.name}`}
                          >
                            {dealCount} {dealCount === 1 ? 'Deal' : 'Deals'}
                          </button>
                        ) : (
                          <span className="text-xs text-[#64748b] font-mono-code">0</span>
                        )}
                      </td>

                      {/* Active Status */}
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => handleToggleActive(agent)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold cursor-pointer transition-all ${
                            agent.active
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500 hover:text-[#0f172a]'
                              : 'bg-slate-700/50 text-slate-400 border border-slate-600 hover:bg-slate-700'
                          }`}
                          title={`Click to ${agent.active ? 'deactivate' : 'reactivate'}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              agent.active ? 'bg-emerald-400' : 'bg-slate-500'
                            }`}
                          ></span>
                          <span>{agent.active ? 'Active' : 'Inactive'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditModal(agent)}
                            className="p-1.5 rounded-lg hover:bg-[#131826] text-[#94a3b8] hover:text-[#f8fafc] border border-transparent hover:border-[#334155] transition-all cursor-pointer"
                            title="Edit Agent Information"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteCandidate(agent)}
                            className="p-1.5 rounded-lg hover:bg-rose-950/40 text-[#94a3b8] hover:text-rose-400 border border-transparent hover:border-rose-800/40 transition-all cursor-pointer"
                            title="Delete / Remove Agent"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Agent Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090d16]/80 backdrop-blur-sm">
          <div className="bg-[#1e293b] border border-[#334155] rounded-2xl w-full max-w-md shadow-2xl p-6 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-4 top-4 text-[#94a3b8] hover:text-[#f8fafc] cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-[#f8fafc] mb-1">
              {modalMode === 'add' ? 'Add New Agent' : `Edit Agent: ${editingAgent?.name}`}
            </h3>
            <p className="text-xs text-[#94a3b8] mb-5">
              {modalMode === 'add'
                ? 'Add an agent to the directory with their official recipient email.'
                : 'Update name, verified email address, role, or contact phone.'}
            </p>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#cbd5e1] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Jane Doe"
                  className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-sm text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#cbd5e1] mb-1">
                  Verified Email (Digest Recipient) *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. jane@mattsmithrealestategroup.com"
                  className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-sm text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                />
                <span className="text-[10px] text-[#94a3b8] mt-0.5 block">
                  All transaction notifications and digest emails will be sent to this verified address.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#cbd5e1] mb-1">Role / Title</label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="e.g. STR Agent"
                    className="w-full px-3 py-2 bg-[#131826] border border-[#334155] rounded-xl text-sm text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#cbd5e1] mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-[#131826] border border-[#334155] rounded-xl text-sm text-[#f8fafc] focus:outline-none focus:border-[#d97706] cursor-pointer"
                  >
                    <option value="Buyer Specialist">Buyer Specialist</option>
                    <option value="Listing Specialist">Listing Specialist</option>
                    <option value="Operations">Operations</option>
                    <option value="Hybrid Agent">Hybrid Agent</option>
                    <option value="Owner">Owner</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#cbd5e1] mb-1">Cell Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. 573-555-1234"
                  className="w-full px-3.5 py-2 bg-[#131826] border border-[#334155] rounded-xl text-sm text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="agentActiveCheck"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 rounded border-[#334155] text-[#d97706] focus:ring-0 focus:ring-offset-0 bg-[#131826] cursor-pointer"
                />
                <label htmlFor="agentActiveCheck" className="text-xs font-medium text-[#cbd5e1] cursor-pointer">
                  Active Agent (eligible for deal assignment and weekly digests)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#334155]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-[#131826] hover:bg-[#334155] text-[#94a3b8] hover:text-[#f8fafc] rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-[#d97706] hover:bg-amber-500 text-[#0f172a] rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : modalMode === 'add' ? 'Add Agent' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090d16]/80 backdrop-blur-sm">
          <div className="bg-[#1e293b] border border-rose-500/40 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto mb-3">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-[#f8fafc]">Delete Agent?</h3>
            <p className="text-xs text-[#94a3b8] mt-1.5">
              Are you sure you want to remove <strong>{deleteCandidate.name}</strong> ({deleteCandidate.email})?
              If this agent has historical transactions, it is recommended to toggle them to <strong>Inactive</strong> instead.
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <button
                onClick={() => setDeleteCandidate(null)}
                className="px-4 py-2 bg-[#131826] hover:bg-[#334155] text-xs font-bold text-[#94a3b8] rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAgent}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white rounded-xl cursor-pointer"
              >
                Delete Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
