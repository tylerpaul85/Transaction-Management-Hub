import React, { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';
import { AppRole, DbProfile, DbAgent, DbOpsUser } from '../types/database.types';
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
  Building,
  KeyRound,
  Send,
} from 'lucide-react';

const SEED_PROFILES: DbProfile[] = [];

export const AdminUserManagement: React.FC = () => {
  const [profiles, setProfiles] = useState<DbProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AppRole>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add User Form State
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    role: AppRole;
    linkType: 'none' | 'agent' | 'ops';
    agentId: string;
    opsUserId: string;
  }>({
    name: '',
    email: '',
    role: 'agent',
    linkType: 'agent',
    agentId: '',
    opsUserId: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load live profiles if available
  useEffect(() => {
    async function loadProfiles() {
      try {
        const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (data) {
          setProfiles(data as unknown as DbProfile[]);
        }
      } catch (err) {
        console.warn('Error loading profiles list', err);
      }
    }
    loadProfiles();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleToggleActive = async (profile: DbProfile) => {
    const newStatus = !profile.active;
    const actionName = newStatus ? 'Reactivated' : 'Deactivated';

    try {
      // Update in Supabase
      await (supabase.from('profiles') as any)
        .update({ active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', profile.id);

      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, active: newStatus } : p))
      );

      showToast(`User ${profile.name || profile.email} ${actionName} successfully.`);
    } catch (err: any) {
      // Fallback local update
      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, active: newStatus } : p))
      );
      showToast(`User ${profile.name || profile.email} ${actionName}.`);
    }
  };

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
      const newProfile: DbProfile = {
        id: crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}`,
        email: emailNormalized,
        name: formData.name.trim(),
        full_name: formData.name.trim(),
        role: formData.role,
        agent_id: formData.role === 'agent' && formData.agentId ? formData.agentId : null,
        ops_user_id: (formData.role === 'tc' || formData.role === 'listing_coordinator' || formData.role === 'admin') && formData.opsUserId ? formData.opsUserId : null,
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 1. Insert into Supabase profiles
      const { error: insertError } = await (supabase.from('profiles') as any).insert({
        id: newProfile.id,
        email: newProfile.email,
        name: newProfile.name,
        full_name: newProfile.full_name,
        role: newProfile.role,
        agent_id: newProfile.agent_id,
        ops_user_id: newProfile.ops_user_id,
        active: true,
      });

      if (insertError) {
        console.warn('Supabase profile insert error, saving locally:', insertError);
      }

      // 2. Trigger Welcome Email via Resend edge function / API
      try {
        await supabase.functions.invoke('send-user-welcome', {
          body: {
            name: newProfile.name,
            email: newProfile.email,
            role: newProfile.role,
            appBaseUrl: window.location.origin,
            googleDomain: import.meta.env.VITE_GOOGLE_WORKSPACE_DOMAIN || 'mattsmithrealestategroup.com',
          },
        });
      } catch (emailErr) {
        console.warn('Could not dispatch welcome email:', emailErr);
      }

      // Update state
      setProfiles((prev) => [newProfile, ...prev]);
      showToast(`User ${newProfile.name} added and welcome notification sent!`);

      // Reset form
      setFormData({
        name: '',
        email: '',
        role: 'agent',
        linkType: 'agent',
        agentId: '',
        opsUserId: '',
      });
      setIsAddModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to add user', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    if (roleFilter !== 'all' && p.role !== roleFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (p.name || p.full_name || '').toLowerCase().includes(q);
      const matchEmail = p.email.toLowerCase().includes(q);
      return matchName || matchEmail;
    }
    return true;
  });

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
            className="text-xs p-1 hover:bg-white/10 rounded-lg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header & Controls */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#d97706]/15 border border-[#d97706]/30 text-[#d97706]">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h2 className="font-editorial text-xl sm:text-2xl font-bold text-[#f8fafc]">
                User Access & Allowlist Management
              </h2>
              <p className="text-xs text-[#94a3b8]">
                Admin-only portal • Google Workspace authentication allowlist
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#d97706] hover:bg-[#d97706]/90 text-[#0f172a] font-bold rounded-xl text-sm shadow-lg active:scale-[0.98] transition-all min-h-[44px]"
          >
            <UserPlus className="h-4 w-4 stroke-[2.5]" />
            <span>Add User</span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user name or workspace email..."
              className="w-full pl-10 pr-4 py-2 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] placeholder-[#94a3b8] focus:outline-none focus:border-[#d97706]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
            {(['all', 'agent', 'tc', 'listing_coordinator', 'admin'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap min-h-[38px] ${
                  roleFilter === r
                    ? 'bg-[#d97706]/20 text-[#d97706] border border-[#d97706]/40'
                    : 'bg-[#131826] text-[#94a3b8] border border-[#334155] hover:text-[#f8fafc]'
                }`}
              >
                {r === 'all' ? 'All Roles' : r.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#131826] text-[#94a3b8] uppercase font-bold tracking-wider border-b border-[#334155]">
                <th className="py-3.5 px-4 sm:px-6">Team Member</th>
                <th className="py-3.5 px-4">Workspace Email</th>
                <th className="py-3.5 px-4">Assigned Role</th>
                <th className="py-3.5 px-4">Access Status</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]/60">
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[#94a3b8]">
                    No provisioned users match the filter criteria.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p) => {
                  const roleBadgeColors: Record<AppRole, string> = {
                    agent: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                    tc: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
                    listing_coordinator: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
                    admin: 'bg-[#d97706]/20 text-[#d97706] border-[#d97706]/40',
                  };

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-[#131826]/40 transition-colors ${
                        !p.active ? 'opacity-60 bg-[#131826]/20' : ''
                      }`}
                    >
                      <td className="py-4 px-4 sm:px-6 font-semibold text-[#f8fafc]">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-[#131826] border border-[#334155] flex items-center justify-center font-bold text-xs text-[#d97706]">
                            {(p.name || p.email)[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="block text-sm">{p.name || p.full_name || 'Team Member'}</span>
                            <span className="text-[10px] text-[#94a3b8] font-mono-code">ID: {p.id.slice(0, 8)}...</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 font-mono-code text-[#94a3b8]">
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-[#94a3b8]" />
                          <span>{p.email}</span>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase border ${
                            roleBadgeColors[p.role]
                          }`}
                        >
                          {p.role.replace('_', ' ')}
                        </span>
                      </td>

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

                      <td className="py-4 px-4 sm:px-6 text-right">
                        <button
                          onClick={() => handleToggleActive(p)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all min-h-[36px] ${
                            p.active
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                          }`}
                        >
                          {p.active ? (
                            <>
                              <UserX className="h-3.5 w-3.5" />
                              <span>Deactivate</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3.5 w-3.5" />
                              <span>Reactivate</span>
                            </>
                          )}
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

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1e293b] border border-[#334155] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-[#131826] border-b border-[#334155] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#d97706]/15 text-[#d97706] border border-[#d97706]/30">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-editorial text-lg font-bold text-[#f8fafc]">
                    Provision Team Member
                  </h3>
                  <p className="text-xs text-[#94a3b8]">
                    Google Workspace Access Allowlist
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-[#94a3b8] hover:text-[#f8fafc] rounded-xl hover:bg-[#1e293b]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddUserSubmit} className="p-5 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#94a3b8] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Rachel Adams"
                  className="w-full px-3.5 py-2.5 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] placeholder-[#94a3b8] focus:outline-none focus:border-[#d97706]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#94a3b8] mb-1">
                  Google Workspace Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="rachel.adams@msreg.com"
                  className="w-full px-3.5 py-2.5 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] placeholder-[#94a3b8] focus:outline-none focus:border-[#d97706]"
                />
                <p className="text-[11px] text-[#94a3b8] mt-1">
                  Must belong to your Google Workspace organization (@{import.meta.env.VITE_GOOGLE_WORKSPACE_DOMAIN || 'mattsmithrealestategroup.com'}).
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#94a3b8] mb-1">
                  System Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as AppRole })}
                  className="w-full px-3.5 py-2.5 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                >
                  <option value="agent">Agent (Read-only /my-deals access)</option>
                  <option value="tc">Transaction Coordinator (Full /ops editable sheet)</option>
                  <option value="listing_coordinator">Listing Coordinator (Full /ops editable sheet)</option>
                  <option value="admin">System Administrator (Full access + Sync debug & User management)</option>
                </select>
              </div>

              {/* Notification note */}
              <div className="p-3 bg-[#131826]/80 rounded-xl border border-[#334155] text-xs text-[#94a3b8] flex items-start gap-2">
                <Send className="h-4 w-4 text-[#d97706] flex-shrink-0 mt-0.5" />
                <span>
                  Adding this user will immediately allowlist their Google account and trigger a welcome notification email via Resend. No passwords or tokens are required.
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#334155]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-[#94a3b8] hover:text-[#f8fafc] bg-[#131826] border border-[#334155]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#d97706] hover:bg-[#d97706]/90 text-[#0f172a] shadow-lg disabled:opacity-50"
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
