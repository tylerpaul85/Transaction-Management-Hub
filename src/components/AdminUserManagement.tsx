import React, { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { AppRole, DbProfile } from '../types/database.types';
import {
  UserPlus,
  Shield,
  UserCheck,
  UserX,
  Mail,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Trash2,
  Edit3,
  Users,
  ShieldAlert,
  Send,
  UserCog,
  Check,
  Building,
  Filter,
} from 'lucide-react';

const ROLE_CONFIG: Record<
  AppRole,
  {
    label: string;
    shortLabel: string;
    badgeClass: string;
    description: string;
  }
> = {
  agent: {
    label: 'Real Estate Agent',
    shortLabel: 'Agent',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    description: 'Read & interactive access to My Deals roadmap and client milestone digest',
  },
  tc: {
    label: 'Transaction Coordinator',
    shortLabel: 'TC',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    description: 'Full live editor access to the Ops Escrow Pipeline & contingency matrix',
  },
  listing_coordinator: {
    label: 'Listing Coordinator',
    shortLabel: 'LC',
    badgeClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    description: 'Listing & pre-closing operations manager across seller transactions',
  },
  admin: {
    label: 'System Administrator',
    shortLabel: 'Admin',
    badgeClass: 'bg-amber-400/20 text-amber-400 border-amber-400/40',
    description: 'Master access: user allowlists, Sisu sync reconciliation & system settings',
  },
};

export const AdminUserManagement: React.FC = () => {
  const [profiles, setProfiles] = useState<DbProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AppRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deactivated'>('all');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<DbProfile | null>(null);
  const [profileToDelete, setProfileToDelete] = useState<DbProfile | null>(null);

  // Add User Form State
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    role: AppRole;
    agentId: string;
    opsUserId: string;
  }>({
    name: '',
    email: '',
    role: 'agent',
    agentId: '',
    opsUserId: '',
  });

  // Edit User Form State
  const [editFormData, setEditFormData] = useState<{
    name: string;
    email: string;
    role: AppRole;
    active: boolean;
  }>({
    name: '',
    email: '',
    role: 'agent',
    active: true,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState<string | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const loadProfiles = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setProfiles(data as unknown as DbProfile[]);
      }
    } catch (err: any) {
      console.error('Error loading profiles list:', err);
      showToast('Could not load user list from database.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  // Quick Role Change Handler
  const handleQuickRoleChange = async (profile: DbProfile, newRole: AppRole) => {
    if (profile.role === newRole) return;

    setIsUpdatingRole(profile.id);
    const oldRole = profile.role;

    // Optimistic UI update
    setProfiles((prev) =>
      prev.map((p) => (p.id === profile.id ? { ...p, role: newRole } : p))
    );

    try {
      // 1. Update Supabase profiles table
      const { error: profileErr } = await (supabase.from('profiles') as any)
        .update({
          role: newRole,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (profileErr) throw profileErr;

      // 2. If promoted to TC/LC/Admin, ensure corresponding ops_users record exists
      if (newRole !== 'agent') {
        const { data: existingOps } = await (supabase.from('ops_users') as any)
          .select('id')
          .eq('email', profile.email.toLowerCase().trim())
          .maybeSingle();

        if (existingOps) {
          await (supabase.from('ops_users') as any)
            .update({
              role: newRole === 'admin' ? 'admin' : newRole === 'listing_coordinator' ? 'listing_coordinator' : 'tc',
            })
            .eq('id', existingOps.id);
        } else {
          await (supabase.from('ops_users') as any).insert({
            name: profile.name || profile.full_name || profile.email,
            email: profile.email.toLowerCase().trim(),
            role: newRole === 'admin' ? 'admin' : newRole === 'listing_coordinator' ? 'listing_coordinator' : 'tc',
          });
        }
      }

      showToast(`Role for ${profile.name || profile.email} updated to ${ROLE_CONFIG[newRole].label}.`);
    } catch (err: any) {
      console.error('Role update error:', err);
      // Revert optimistic update
      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, role: oldRole } : p))
      );
      showToast(err.message || 'Failed to update system role.', 'error');
    } finally {
      setIsUpdatingRole(null);
    }
  };

  // Toggle Active Status
  const handleToggleActive = async (profile: DbProfile) => {
    const newStatus = !profile.active;
    const actionName = newStatus ? 'reactivated' : 'deactivated';

    // Optimistic UI update
    setProfiles((prev) =>
      prev.map((p) => (p.id === profile.id ? { ...p, active: newStatus } : p))
    );

    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({ active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', profile.id);

      if (error) throw error;
      showToast(`User ${profile.name || profile.email} ${actionName} successfully.`);
    } catch (err: any) {
      console.error('Toggle active error:', err);
      // Revert
      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, active: !newStatus } : p))
      );
      showToast(err.message || `Failed to ${actionName} user.`, 'error');
    }
  };

  // Delete User Permanently
  const handleDeleteUser = async () => {
    if (!profileToDelete) return;

    setIsDeleting(true);
    const target = profileToDelete;

    try {
      const { error } = await (supabase.from('profiles') as any)
        .delete()
        .eq('id', target.id);

      if (error) throw error;

      // Remove from state
      setProfiles((prev) => prev.filter((p) => p.id !== target.id));
      showToast(`User ${target.name || target.email} was deleted from the allowlist.`);
      setProfileToDelete(null);
    } catch (err: any) {
      console.error('Delete user error:', err);
      showToast(err.message || 'Failed to delete user profile.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (profile: DbProfile) => {
    setEditingProfile(profile);
    setEditFormData({
      name: profile.name || profile.full_name || '',
      email: profile.email || '',
      role: profile.role || 'agent',
      active: profile.active ?? true,
    });
  };

  // Submit Edit Modal Form
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    if (!editFormData.name.trim() || !editFormData.email.trim()) {
      showToast('Name and email are required.', 'error');
      return;
    }

    setIsSubmitting(true);
    const emailNormalized = editFormData.email.trim().toLowerCase();

    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({
          name: editFormData.name.trim(),
          full_name: editFormData.name.trim(),
          email: emailNormalized,
          role: editFormData.role,
          active: editFormData.active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingProfile.id);

      if (error) throw error;

      // Sync ops_users role if applicable
      if (editFormData.role !== 'agent') {
        const { data: existingOps } = await (supabase.from('ops_users') as any)
          .select('id')
          .eq('email', emailNormalized)
          .maybeSingle();

        if (existingOps) {
          await (supabase.from('ops_users') as any)
            .update({
              name: editFormData.name.trim(),
              role: editFormData.role === 'admin' ? 'admin' : editFormData.role === 'listing_coordinator' ? 'listing_coordinator' : 'tc',
            })
            .eq('id', existingOps.id);
        } else {
          await (supabase.from('ops_users') as any).insert({
            name: editFormData.name.trim(),
            email: emailNormalized,
            role: editFormData.role === 'admin' ? 'admin' : editFormData.role === 'listing_coordinator' ? 'listing_coordinator' : 'tc',
          });
        }
      }

      setProfiles((prev) =>
        prev.map((p) =>
          p.id === editingProfile.id
            ? {
                ...p,
                name: editFormData.name.trim(),
                full_name: editFormData.name.trim(),
                email: emailNormalized,
                role: editFormData.role,
                active: editFormData.active,
                updated_at: new Date().toISOString(),
              }
            : p
        )
      );

      showToast(`User ${editFormData.name.trim()} updated successfully.`);
      setEditingProfile(null);
    } catch (err: any) {
      console.error('Update user error:', err);
      showToast(err.message || 'Failed to update user profile.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add User Form Submit
  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      showToast('Name and email are required.', 'error');
      return;
    }

    const emailNormalized = formData.email.trim().toLowerCase();

    // Check duplicate
    if (profiles.some((p) => p.email.toLowerCase() === emailNormalized)) {
      showToast(`A profile for ${emailNormalized} already exists.`, 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      let agentId = formData.agentId || null;
      let opsUserId = formData.opsUserId || null;

      // Always ensure an agent record exists so user can be assigned as lead agent on deals
      if (!agentId) {
        const { data: existingAgent } = await (supabase
          .from('agents') as any)
          .select('id')
          .eq('email', emailNormalized)
          .maybeSingle();

        if (existingAgent) {
          agentId = (existingAgent as any).id;
        } else {
          const { data: newAgent } = await (supabase.from('agents') as any)
            .insert({
              name: formData.name.trim(),
              email: emailNormalized,
              active: true,
            })
            .select('id')
            .single();
          if (newAgent) agentId = (newAgent as any).id;
        }
      }

      // Auto-create ops_user record if adding TC/LC/Admin and no ops user linked yet
      if (formData.role !== 'agent' && !opsUserId) {
        const { data: existingOps } = await (supabase
          .from('ops_users') as any)
          .select('id')
          .eq('email', emailNormalized)
          .maybeSingle();

        if (existingOps) {
          opsUserId = (existingOps as any).id;
        } else {
          const { data: newOps } = await (supabase.from('ops_users') as any)
            .insert({
              name: formData.name.trim(),
              email: emailNormalized,
              role: formData.role === 'admin' ? 'admin' : formData.role === 'listing_coordinator' ? 'listing_coordinator' : 'tc',
            })
            .select('id')
            .single();
          if (newOps) opsUserId = (newOps as any).id;
        }
      }

      // Insert into Supabase profiles
      const { data: insertedProfile, error: insertError } = await (supabase.from('profiles') as any)
        .insert({
          email: emailNormalized,
          name: formData.name.trim(),
          full_name: formData.name.trim(),
          role: formData.role,
          agent_id: agentId,
          ops_user_id: opsUserId,
          active: true,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create profile: ${insertError.message}`);
      }

      // Trigger Welcome Email via Resend edge function / API
      try {
        await supabase.functions.invoke('send-user-welcome', {
          body: {
            name: formData.name.trim(),
            email: emailNormalized,
            role: formData.role,
            appBaseUrl: window.location.origin,
            googleDomain: import.meta.env.VITE_GOOGLE_WORKSPACE_DOMAIN || 'mattsmithrealestategroup.com',
          },
        });
      } catch (emailErr) {
        console.warn('Could not dispatch welcome email:', emailErr);
      }

      await loadProfiles();

      showToast(`User ${formData.name.trim()} provisioned and saved!`);

      // Reset form
      setFormData({
        name: '',
        email: '',
        role: 'agent',
        agentId: '',
        opsUserId: '',
      });
      setIsAddModalOpen(false);
    } catch (err: any) {
      console.error('Add user error:', err);
      showToast(err.message || 'Failed to add user', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered List
  const filteredProfiles = profiles.filter((p) => {
    if (roleFilter !== 'all' && p.role !== roleFilter) return false;
    if (statusFilter === 'active' && !p.active) return false;
    if (statusFilter === 'deactivated' && p.active) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (p.name || p.full_name || '').toLowerCase().includes(q);
      const matchEmail = p.email.toLowerCase().includes(q);
      const matchId = p.id.toLowerCase().includes(q);
      return matchName || matchEmail || matchId;
    }
    return true;
  });

  // Statistics
  const totalUsers = profiles.length;
  const activeAgents = profiles.filter((p) => p.role === 'agent' && p.active).length;
  const activeOps = profiles.filter((p) => (p.role === 'tc' || p.role === 'listing_coordinator') && p.active).length;
  const activeAdmins = profiles.filter((p) => p.role === 'admin' && p.active).length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm shadow-xl animate-in fade-in duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-xs p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-[#111726] border border-white/10 rounded-2xl p-4 shadow-lg flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Total Users
            </span>
            <span className="text-xl font-bold text-white font-mono tabular-nums">
              {totalUsers}
            </span>
          </div>
        </div>

        <div className="bg-[#111726] border border-white/10 rounded-2xl p-4 shadow-lg flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Active Agents
            </span>
            <span className="text-xl font-bold text-emerald-400 font-mono tabular-nums">
              {activeAgents}
            </span>
          </div>
        </div>

        <div className="bg-[#111726] border border-white/10 rounded-2xl p-4 shadow-lg flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Ops Coordinators
            </span>
            <span className="text-xl font-bold text-sky-400 font-mono tabular-nums">
              {activeOps}
            </span>
          </div>
        </div>

        <div className="bg-[#111726] border border-white/10 rounded-2xl p-4 shadow-lg flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
              Administrators
            </span>
            <span className="text-xl font-bold text-purple-400 font-mono tabular-nums">
              {activeAdmins}
            </span>
          </div>
        </div>
      </div>

      {/* Header & Controls */}
      <div className="bg-[#111726] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <UserCog className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
                User Roster & Access Control
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage system roles, delete profiles, and provision Google Workspace allowlist accounts
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-sm shadow-md active:scale-[0.98] transition-all min-h-[44px]"
          >
            <UserPlus className="h-4 w-4 stroke-[2.5]" />
            <span>Add User</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 pt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or user ID..."
              className="w-full pl-10 pr-4 py-2 bg-[#0d121f] border border-white/10 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
            />
          </div>

          {/* Role Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(['all', 'agent', 'tc', 'listing_coordinator', 'admin'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap min-h-[38px] ${
                  roleFilter === r
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    : 'bg-[#162035] text-slate-400 border border-white/10 hover:text-white'
                }`}
              >
                {r === 'all' ? 'All Roles' : ROLE_CONFIG[r]?.shortLabel || r}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-[#162035] border border-white/10 rounded-xl text-xs font-semibold text-slate-300 focus:outline-none focus:border-amber-400"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="deactivated">Deactivated Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#111726] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#0d121f] text-slate-400 uppercase font-bold tracking-wider border-b border-white/10">
                <th className="py-3.5 px-4 sm:px-6">Team Member</th>
                <th className="py-3.5 px-4">Workspace Email</th>
                <th className="py-3.5 px-4">System Role</th>
                <th className="py-3.5 px-4">Access Status</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
                      <span>Loading authorized team members...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No provisioned users match the search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p) => {
                  const roleConfig = ROLE_CONFIG[p.role] || ROLE_CONFIG.agent;
                  const isUpdating = isUpdatingRole === p.id;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-[#0d121f]/40 transition-colors ${
                        !p.active ? 'opacity-60 bg-[#0d121f]/20' : ''
                      }`}
                    >
                      {/* Name & Avatar */}
                      <td className="py-4 px-4 sm:px-6 font-semibold text-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-full bg-[#0d121f] border border-white/10 flex items-center justify-center font-bold text-xs text-amber-400 overflow-hidden flex-shrink-0">
                            {p.avatar_url ? (
                              <img
                                src={p.avatar_url}
                                alt={p.name || p.email}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              (p.name || p.email)[0].toUpperCase()
                            )}
                          </div>
                          <div>
                            <span className="block text-sm text-slate-100 font-bold">
                              {p.name || p.full_name || 'Team Member'}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono tabular-nums">
                              ID: {p.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-4 font-mono tabular-nums text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate max-w-[220px]">{p.email}</span>
                        </div>
                      </td>

                      {/* Interactive Role Switcher Dropdown */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={p.role}
                            disabled={isUpdating}
                            onChange={(e) =>
                              handleQuickRoleChange(p, e.target.value as AppRole)
                            }
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border cursor-pointer focus:outline-none focus:border-amber-400 transition-all ${roleConfig.badgeClass} bg-[#0d121f]`}
                            title="Click to change system role immediately"
                          >
                            <option value="agent" className="bg-[#111726] text-emerald-400">
                              Agent (Read-Only Deals)
                            </option>
                            <option value="tc" className="bg-[#111726] text-sky-400">
                              TC (Full Ops Editor)
                            </option>
                            <option value="listing_coordinator" className="bg-[#111726] text-indigo-400">
                              Listing Coordinator
                            </option>
                            <option value="admin" className="bg-[#111726] text-amber-400">
                              Administrator
                            </option>
                          </select>
                          {isUpdating && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {p.active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
                            Deactivated
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Details Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            title="Edit user details"
                            className="p-2 rounded-xl bg-[#162035] hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 transition-colors"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>

                          {/* Toggle Active / Deactivate */}
                          <button
                            type="button"
                            onClick={() => handleToggleActive(p)}
                            title={p.active ? 'Deactivate user access' : 'Reactivate user access'}
                            className={`p-2 rounded-xl border transition-colors ${
                              p.active
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            }`}
                          >
                            {p.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </button>

                          {/* Delete User Button */}
                          <button
                            type="button"
                            onClick={() => setProfileToDelete(p)}
                            title="Delete user permanently"
                            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#111726] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 bg-[#0d121f] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Edit3 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Edit User Profile
                  </h3>
                  <p className="text-xs text-slate-400">
                    Update profile info & system role
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEditingProfile(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#0d121f] border border-white/10 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Workspace Email *
                </label>
                <input
                  type="email"
                  required
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-[#0d121f] border border-white/10 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  System Role *
                </label>
                <select
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as AppRole })}
                  className="w-full px-3.5 py-2.5 bg-[#0d121f] border border-white/10 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-400 transition-colors"
                >
                  <option value="agent">Agent (Read-only /my-deals access)</option>
                  <option value="tc">Transaction Coordinator (Full /ops editable sheet)</option>
                  <option value="listing_coordinator">Listing Coordinator (Full /ops editable sheet)</option>
                  <option value="admin">System Administrator (Full access + System settings)</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="edit_active_toggle"
                  checked={editFormData.active}
                  onChange={(e) => setEditFormData({ ...editFormData, active: e.target.checked })}
                  className="h-4 w-4 rounded bg-[#0d121f] border-white/20 text-amber-400 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <label htmlFor="edit_active_toggle" className="text-xs font-medium text-slate-300 cursor-pointer">
                  Account is Active & Allowed to Sign In
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingProfile(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-[#162035] border border-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {profileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#111726] border border-rose-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 bg-rose-500/10 border-b border-rose-500/20 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">
                  Delete User Profile
                </h3>
                <p className="text-xs text-rose-300">
                  Revoke Google Workspace Access
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <strong className="text-white font-bold">
                  {profileToDelete.name || profileToDelete.email}
                </strong>{' '}
                (<span className="font-mono text-amber-400">{profileToDelete.email}</span>)?
              </p>

              <div className="p-3 bg-[#0d121f] rounded-xl border border-white/10 text-[11px] text-slate-400 space-y-1">
                <span className="font-bold text-rose-400 block uppercase tracking-wider">
                  Warning:
                </span>
                <span>
                  This will remove the user from the authentication allowlist immediately. They will no longer be able to sign in to the Hub.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setProfileToDelete(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-[#162035] border border-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDeleteUser}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md disabled:opacity-50 transition-colors"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>Delete User</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#111726] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-[#0d121f] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    Provision Team Member
                  </h3>
                  <p className="text-xs text-slate-400">
                    Google Workspace Access Allowlist
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddUserSubmit} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Rachel Adams"
                  className="w-full px-3.5 py-2.5 bg-[#0d121f] border border-white/10 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Google Workspace Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="rachel.adams@msreg.com"
                  className="w-full px-3.5 py-2.5 bg-[#0d121f] border border-white/10 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Must belong to your Google Workspace organization (@{import.meta.env.VITE_GOOGLE_WORKSPACE_DOMAIN || 'mattsmithrealestategroup.com'}).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  System Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as AppRole })}
                  className="w-full px-3.5 py-2.5 bg-[#0d121f] border border-white/10 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-amber-400 transition-colors"
                >
                  <option value="agent">Agent (Read-only /my-deals access)</option>
                  <option value="tc">Transaction Coordinator (Full /ops editable sheet)</option>
                  <option value="listing_coordinator">Listing Coordinator (Full /ops editable sheet)</option>
                  <option value="admin">System Administrator (Full access + Sync debug & User management)</option>
                </select>
              </div>

              {/* Notification note */}
              <div className="p-3 bg-[#0d121f] rounded-xl border border-white/10 text-xs text-slate-400 flex items-start gap-2">
                <Send className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  Adding this user will immediately allowlist their Google account and trigger a welcome notification email via Resend. No passwords or tokens are required.
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-[#162035] border border-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-md disabled:opacity-50 transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Provisioning...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>Authorize & Send Welcome</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
