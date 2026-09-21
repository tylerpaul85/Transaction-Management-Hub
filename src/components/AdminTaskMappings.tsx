import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../integrations/supabase/client';
import { ALL_MILESTONES_CONFIG } from '../types/ops';
import {
  ListChecks,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Trash2,
  Check,
  X,
  Search,
  Sparkles,
  Database,
  Copy,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface TaskMapping {
  id: string;
  sisu_task_name: string;
  milestone_field: string;
  milestone_table: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface DistinctTaskItem {
  taskName: string;
  count: number;
  latestDetectedAt: string;
  sampleTxId?: string | null;
  sources: ('unmatched_table' | 'webhook_log')[];
  rawPayloadSnippet?: string;
}

export const AdminTaskMappings: React.FC = () => {
  const [mappings, setMappings] = useState<TaskMapping[]>([]);
  const [unmatchedTasks, setUnmatchedTasks] = useState<DistinctTaskItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Selected milestone dropdown values for each unmatched item
  const [selectedMilestones, setSelectedMilestones] = useState<Record<string, string>>({});

  // Manual Add Form State
  const [manualTaskName, setManualTaskName] = useState<string>('');
  const [manualMilestoneField, setManualMilestoneField] = useState<string>('earnest_money');
  const [isSavingManual, setIsSavingManual] = useState<boolean>(false);

  // Quick-test suggestions (matching the 10 Sisu form custom fields)
  const TEST_SUGGESTIONS = [
    { name: 'Earnest money Deposited? (internal use)', defaultField: 'earnest_money' },
    { name: 'Inspection ordred? - Internal Use', defaultField: 'inspection_ordered' },
    { name: 'Inspection Satisfied? - Internal Use', defaultField: 'inspection_10day' },
    { name: 'Financing / Loan Commitment - internal use', defaultField: 'financing_contingency' },
    { name: 'Appraisal Received (internal use)', defaultField: 'appraisal_received' },
    { name: 'Appraisal Satisfied (internal use)', defaultField: 'appraisal_satisfied' },
    { name: 'Insurance Obtained? - Internal Use', defaultField: 'insurance_binder' },
    { name: 'Title Commitment & Clearance - Internal use', defaultField: 'title' },
    { name: 'Clear-to-Close (internal use)', defaultField: 'ctc' },
    { name: 'Final Walkthrough (internal use)', defaultField: 'walk_through' },
  ];

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch current mappings
      const { data: mappingsData, error: mapErr } = await supabase
        .from('sisu_task_mappings')
        .select('*')
        .order('created_at', { ascending: false });

      if (mapErr) throw mapErr;
      const currentMappings = (mappingsData as TaskMapping[]) || [];
      setMappings(currentMappings);

      const mappedNamesSet = new Set(
        currentMappings.map((m) => m.sisu_task_name.trim().toLowerCase())
      );

      // 2. Fetch unmatched tasks from sisu_unmatched_tasks table
      const { data: unmatchedData, error: unErr } = await supabase
        .from('sisu_unmatched_tasks')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(1000);

      if (unErr) console.warn('Could not query sisu_unmatched_tasks:', unErr);

      // 3. Scan recent sisu_webhook_log for any embedded tasks
      const { data: logData, error: logErr } = await supabase
        .from('sisu_webhook_log')
        .select('id, payload, transaction_id, received_at')
        .order('received_at', { ascending: false })
        .limit(300);

      if (logErr) console.warn('Could not query sisu_webhook_log:', logErr);

      // Aggregate distinct tasks
      const taskMap = new Map<string, DistinctTaskItem>();

      // From sisu_unmatched_tasks
      (unmatchedData || []).forEach((row: any) => {
        const rawName = row.task_name ? String(row.task_name).trim() : '';
        if (!rawName) return;
        const lower = rawName.toLowerCase();

        if (taskMap.has(lower)) {
          const item = taskMap.get(lower)!;
          item.count += 1;
          if (row.detected_at && row.detected_at > item.latestDetectedAt) {
            item.latestDetectedAt = row.detected_at;
          }
          if (!item.sampleTxId && row.transaction_id) item.sampleTxId = row.transaction_id;
          if (!item.sources.includes('unmatched_table')) item.sources.push('unmatched_table');
        } else {
          taskMap.set(lower, {
            taskName: rawName,
            count: 1,
            latestDetectedAt: row.detected_at || new Date().toISOString(),
            sampleTxId: row.transaction_id || null,
            sources: ['unmatched_table'],
            rawPayloadSnippet: row.task_payload ? JSON.stringify(row.task_payload).slice(0, 100) : undefined,
          });
        }
      });

      // From sisu_webhook_log
      (logData || []).forEach((entry: any) => {
        const payload = entry.payload || {};
        let tasksList: any[] = [];
        if (Array.isArray(payload.tasks)) tasksList = payload.tasks;
        else if (Array.isArray(payload.data?.tasks)) tasksList = payload.data.tasks;
        else if (Array.isArray(payload.data_objects?.[0]?.object_data?.tasks)) tasksList = payload.data_objects[0].object_data.tasks;
        else if (Array.isArray(payload.data_objects?.[0]?.object_data?.checklist_tasks)) tasksList = payload.data_objects[0].object_data.checklist_tasks;

        tasksList.forEach((t: any) => {
          const name = t?.name || t?.task_name || t?.title || (typeof t === 'string' ? t : '');
          if (!name) return;
          const trimmed = String(name).trim();
          const lower = trimmed.toLowerCase();

          if (taskMap.has(lower)) {
            const item = taskMap.get(lower)!;
            item.count += 1;
            if (entry.received_at && entry.received_at > item.latestDetectedAt) {
              item.latestDetectedAt = entry.received_at;
            }
            if (!item.sampleTxId && entry.transaction_id) item.sampleTxId = entry.transaction_id;
            if (!item.sources.includes('webhook_log')) item.sources.push('webhook_log');
          } else {
            taskMap.set(lower, {
              taskName: trimmed,
              count: 1,
              latestDetectedAt: entry.received_at || new Date().toISOString(),
              sampleTxId: entry.transaction_id || null,
              sources: ['webhook_log'],
              rawPayloadSnippet: JSON.stringify(t).slice(0, 100),
            });
          }
        });
      });

      // Filter out tasks that are already mapped
      const unmapped = Array.from(taskMap.values()).filter(
        (item) => !mappedNamesSet.has(item.taskName.toLowerCase())
      );

      // Sort by occurrences & latest date
      unmapped.sort((a, b) => new Date(b.latestDetectedAt).getTime() - new Date(a.latestDetectedAt).getTime());

      setUnmatchedTasks(unmapped);
    } catch (err: any) {
      console.error('Failed to load task mapping data:', err);
      setStatusMessage({ type: 'error', text: `Error loading tasks: ${err.message || String(err)}` });
    } finally {
      setIsLoading(false);
      setIsScanning(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Save mapping from unmatched row
  const handleSaveUnmatchedMapping = async (taskName: string) => {
    const selectedField = selectedMilestones[taskName] || 'earnest_money';
    try {
      const { data, error } = await (supabase
        .from('sisu_task_mappings') as any)
        .insert({
          sisu_task_name: taskName.trim(),
          milestone_field: selectedField,
          milestone_table: 'milestones',
          active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setStatusMessage({
        type: 'success',
        text: `Mapped "${taskName}" to milestone "${getMilestoneLabel(selectedField)}" successfully!`,
      });

      // Move into active mappings immediately
      if (data) {
        setMappings((prev) => [data as TaskMapping, ...prev]);
        setUnmatchedTasks((prev) => prev.filter((item) => item.taskName.toLowerCase() !== taskName.toLowerCase()));
      }
    } catch (err: any) {
      console.error('Error saving task mapping:', err);
      setStatusMessage({
        type: 'error',
        text: `Failed to save mapping: ${err.message || String(err)}`,
      });
    }
  };

  // Create manual mapping
  const handleCreateManualMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTaskName.trim()) return;

    setIsSavingManual(true);
    try {
      const { data, error } = await (supabase
        .from('sisu_task_mappings') as any)
        .insert({
          sisu_task_name: manualTaskName.trim(),
          milestone_field: manualMilestoneField,
          milestone_table: 'milestones',
          active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setStatusMessage({
        type: 'success',
        text: `Successfully mapped "${manualTaskName.trim()}" to "${getMilestoneLabel(manualMilestoneField)}"!`,
      });

      if (data) {
        setMappings((prev) => [data as TaskMapping, ...prev]);
        setUnmatchedTasks((prev) =>
          prev.filter((item) => item.taskName.toLowerCase() !== manualTaskName.trim().toLowerCase())
        );
      }
      setManualTaskName('');
    } catch (err: any) {
      console.error('Error creating manual mapping:', err);
      setStatusMessage({
        type: 'error',
        text: `Failed to create mapping: ${err.message || String(err)}`,
      });
    } finally {
      setIsSavingManual(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await (supabase
        .from('sisu_task_mappings') as any)
        .update({
          active: !currentActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setMappings((prev) =>
        prev.map((m) => (m.id === id ? { ...m, active: !currentActive, updated_at: new Date().toISOString() } : m))
      );
    } catch (err: any) {
      console.error('Error toggling mapping active status:', err);
      setStatusMessage({ type: 'error', text: `Failed to update status: ${err.message}` });
    }
  };

  // Delete mapping
  const handleDeleteMapping = async (id: string, taskName: string) => {
    if (!window.confirm(`Are you sure you want to remove the mapping for "${taskName}"?`)) return;

    try {
      const { error } = await supabase.from('sisu_task_mappings').delete().eq('id', id);
      if (error) throw error;

      setMappings((prev) => prev.filter((m) => m.id !== id));
      setStatusMessage({ type: 'info', text: `Mapping for "${taskName}" removed.` });
      // Re-scan to replenish unmatched if it existed in logs
      fetchData();
    } catch (err: any) {
      console.error('Error deleting mapping:', err);
      setStatusMessage({ type: 'error', text: `Failed to delete: ${err.message}` });
    }
  };

  // Helper for milestone labels
  const getMilestoneLabel = (field: string) => {
    const found = ALL_MILESTONES_CONFIG.find((m) => m.type === field);
    return found ? found.label : field;
  };

  // Filtered unmatched tasks
  const filteredUnmatched = useMemo(() => {
    if (!searchQuery.trim()) return unmatchedTasks;
    const q = searchQuery.toLowerCase();
    return unmatchedTasks.filter((t) => t.taskName.toLowerCase().includes(q));
  }, [unmatchedTasks, searchQuery]);

  // Filtered mappings
  const filteredMappings = useMemo(() => {
    if (!searchQuery.trim()) return mappings;
    const q = searchQuery.toLowerCase();
    return mappings.filter(
      (m) =>
        m.sisu_task_name.toLowerCase().includes(q) ||
        m.milestone_field.toLowerCase().includes(q) ||
        getMilestoneLabel(m.milestone_field).toLowerCase().includes(q)
    );
  }, [mappings, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1e293b] via-[#1a2234] to-[#131826] p-6 sm:p-8 rounded-2xl border border-[#334155] shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl">
                <ListChecks className="h-6 w-6" />
              </span>
              <div>
                <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-[#f8fafc]">
                  Sisu Task-Level Milestone Synchronization
                </h1>
                <p className="text-xs sm:text-sm text-[#94a3b8] mt-0.5">
                  Automatically mark transaction milestones complete whenever specific Sisu checklist tasks are completed.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsScanning(true);
                fetchData();
              }}
              disabled={isLoading || isScanning}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#334155] hover:bg-[#475569] text-[#f8fafc] transition-all disabled:opacity-50 border border-slate-600 shadow-md"
            >
              <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning Payloads...' : 'Re-Scan Tasks & Logs'}</span>
            </button>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-[#334155]/60">
          <div className="p-4 bg-[#0f172a]/60 rounded-xl border border-[#334155] flex items-center justify-between">
            <div>
              <span className="text-xs text-[#94a3b8] font-medium uppercase tracking-wider block">Active Mappings</span>
              <span className="font-mono-code text-2xl font-bold text-emerald-400">
                {mappings.filter((m) => m.active).length}
              </span>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="p-4 bg-[#0f172a]/60 rounded-xl border border-[#334155] flex items-center justify-between">
            <div>
              <span className="text-xs text-[#94a3b8] font-medium uppercase tracking-wider block">Unmatched Tasks Seen</span>
              <span className="font-mono-code text-2xl font-bold text-amber-400">
                {unmatchedTasks.length}
              </span>
            </div>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>

          <div className="p-4 bg-[#0f172a]/60 rounded-xl border border-[#334155] flex items-center justify-between">
            <div>
              <span className="text-xs text-[#94a3b8] font-medium uppercase tracking-wider block">Total Mappings Configured</span>
              <span className="font-mono-code text-2xl font-bold text-sky-400">
                {mappings.length}
              </span>
            </div>
            <div className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
              <Database className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Notification Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : statusMessage.type === 'error'
              ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              : 'bg-sky-950/40 border-sky-500/40 text-sky-300'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-medium">
            {statusMessage.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
            {statusMessage.type === 'error' && <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />}
            {statusMessage.type === 'info' && <Sparkles className="h-4 w-4 shrink-0 text-sky-400" />}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Quick Add Manual Mapping Card */}
      <div className="bg-[#1e293b] p-6 rounded-2xl border border-[#334155] shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#f8fafc] flex items-center gap-2">
              <Plus className="h-4 w-4 text-amber-400" />
              Add or Pre-Map a Sisu Task
            </h2>
            <p className="text-xs text-[#94a3b8]">
              Configure any Sisu checklist task title before or after it appears in incoming webhooks.
            </p>
          </div>

          {/* Quick-fill pills for Tyler's screenshot test items */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#94a3b8] font-medium text-[11px]">Quick Fill Test Tasks:</span>
            {TEST_SUGGESTIONS.map((sug) => (
              <button
                key={sug.name}
                type="button"
                onClick={() => {
                  setManualTaskName(sug.name);
                  setManualMilestoneField(sug.defaultField);
                }}
                className="px-2.5 py-1 rounded-lg bg-[#334155] hover:bg-[#475569] text-amber-300 border border-amber-500/30 text-[11px] font-mono-code transition-all"
              >
                + {sug.name.split(' - ')[0]}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleCreateManualMapping} className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2">
          <div className="md:col-span-6">
            <label className="block text-[11px] font-bold uppercase text-[#94a3b8] mb-1">
              Exact Sisu Task Name
            </label>
            <input
              type="text"
              value={manualTaskName}
              onChange={(e) => setManualTaskName(e.target.value)}
              placeholder="e.g. Earnest Money Deposited - Transaction Hub"
              className="w-full px-3.5 py-2.5 bg-[#131826] border border-[#334155] rounded-xl text-sm text-[#f8fafc] placeholder-[#64748b] focus:outline-none focus:border-amber-400 font-mono-code"
              required
            />
          </div>

          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold uppercase text-[#94a3b8] mb-1">
              Target Milestone Field
            </label>
            <select
              value={manualMilestoneField}
              onChange={(e) => setManualMilestoneField(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#131826] border border-[#334155] rounded-xl text-sm text-[#f8fafc] focus:outline-none focus:border-amber-400"
            >
              {ALL_MILESTONES_CONFIG.map((conf) => (
                <option key={conf.type} value={conf.type}>
                  {conf.label} ({conf.type})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={isSavingManual || !manualTaskName.trim()}
              className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-[#0f172a] font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span>{isSavingManual ? 'Saving...' : 'Add Mapping'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Global Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search task names or milestones..."
            className="w-full pl-10 pr-4 py-2 bg-[#1e293b] border border-[#334155] rounded-xl text-sm text-[#f8fafc] placeholder-[#94a3b8] focus:outline-none focus:border-amber-400"
          />
        </div>
        <span className="text-xs text-[#94a3b8]">
          Showing {filteredUnmatched.length} unmatched / {filteredMappings.length} mapped
        </span>
      </div>

      {/* Section 1: Unmatched Tasks Punch List */}
      <div className="bg-[#1e293b] rounded-2xl border border-[#334155] shadow-lg overflow-hidden">
        <div className="p-5 border-b border-[#334155] flex items-center justify-between bg-[#182234]">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
              <AlertCircle className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#f8fafc]">
                Unmatched Sisu Tasks Punch List ({filteredUnmatched.length})
              </h2>
              <p className="text-[11px] text-[#94a3b8]">
                Tasks detected in incoming Sisu webhooks or logs that do not have a milestone assigned yet.
              </p>
            </div>
          </div>
        </div>

        {filteredUnmatched.length === 0 ? (
          <div className="p-12 text-center text-[#94a3b8]">
            <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-400/60 mb-2" />
            <p className="text-sm font-semibold text-[#f8fafc]">All Detected Tasks Are Mapped!</p>
            <p className="text-xs text-[#64748b] mt-1 max-w-md mx-auto">
              No unmatched tasks found across sisu_unmatched_tasks or recent webhook logs. When new Sisu tasks are received, they will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#f8fafc]">
              <thead className="bg-[#131826] text-[#94a3b8] uppercase text-[10px] tracking-wider border-b border-[#334155]">
                <tr>
                  <th className="py-3 px-4 font-bold">Detected Task Name (Sisu)</th>
                  <th className="py-3 px-4 font-bold">Times Seen</th>
                  <th className="py-3 px-4 font-bold">Latest Detected</th>
                  <th className="py-3 px-4 font-bold">Assign Milestone</th>
                  <th className="py-3 px-4 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/60">
                {filteredUnmatched.map((item) => {
                  const currentSelected = selectedMilestones[item.taskName] || 'earnest_money';
                  return (
                    <tr key={item.taskName} className="hover:bg-[#131826]/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono-code font-bold text-amber-300">
                        <div className="flex items-center gap-2">
                          <span>{item.taskName}</span>
                          <button
                            type="button"
                            title="Copy task name"
                            onClick={() => {
                              navigator.clipboard.writeText(item.taskName);
                              setStatusMessage({ type: 'info', text: `Copied "${item.taskName}" to clipboard` });
                            }}
                            className="text-[#64748b] hover:text-[#f8fafc] transition-colors"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                        {item.sampleTxId && (
                          <span className="text-[10px] text-[#64748b] font-normal block mt-0.5">
                            Tx ID: {item.sampleTxId}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#334155] text-slate-200">
                          {item.count}x
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[#94a3b8] text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-slate-500" />
                          <span>{new Date(item.latestDetectedAt).toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 min-w-[220px]">
                        <select
                          value={currentSelected}
                          onChange={(e) =>
                            setSelectedMilestones((prev) => ({
                              ...prev,
                              [item.taskName]: e.target.value,
                            }))
                          }
                          className="w-full px-2.5 py-1.5 bg-[#131826] border border-[#334155] rounded-lg text-xs text-[#f8fafc] focus:outline-none focus:border-amber-400"
                        >
                          {ALL_MILESTONES_CONFIG.map((conf) => (
                            <option key={conf.type} value={conf.type}>
                              {conf.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleSaveUnmatchedMapping(item.taskName)}
                          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-[#0f172a] font-bold text-xs rounded-lg shadow transition-all inline-flex items-center gap-1"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Save Mapping</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Active Task Mappings */}
      <div className="bg-[#1e293b] rounded-2xl border border-[#334155] shadow-lg overflow-hidden">
        <div className="p-5 border-b border-[#334155] flex items-center justify-between bg-[#182234]">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#f8fafc]">
                Configured Sisu Task Mappings ({filteredMappings.length})
              </h2>
              <p className="text-[11px] text-[#94a3b8]">
                These checklist tasks automatically update their designated milestone in the transactions table upon completion.
              </p>
            </div>
          </div>
        </div>

        {filteredMappings.length === 0 ? (
          <div className="p-10 text-center text-[#94a3b8]">
            <ListChecks className="h-8 w-8 mx-auto text-slate-500 mb-2" />
            <p className="text-sm text-slate-300">No task mappings configured yet.</p>
            <p className="text-xs text-[#64748b] mt-1">
              Use the manual form above or assign an unmatched task from the punch list.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#f8fafc]">
              <thead className="bg-[#131826] text-[#94a3b8] uppercase text-[10px] tracking-wider border-b border-[#334155]">
                <tr>
                  <th className="py-3 px-4 font-bold">Exact Sisu Task Name</th>
                  <th className="py-3 px-4 font-bold">Target Milestone</th>
                  <th className="py-3 px-4 font-bold">Target Table</th>
                  <th className="py-3 px-4 font-bold text-center">Active</th>
                  <th className="py-3 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/60">
                {filteredMappings.map((m) => (
                  <tr key={m.id} className="hover:bg-[#131826]/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono-code font-bold text-[#f8fafc]">
                      {m.sisu_task_name}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        {getMilestoneLabel(m.milestone_field)}
                      </span>
                      <span className="text-[10px] text-[#64748b] font-mono-code block mt-0.5">
                        field: {m.milestone_field}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#94a3b8] font-mono-code text-[11px]">
                      {m.milestone_table || 'milestones'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(m.id, m.active)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${
                          m.active
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700'
                        }`}
                      >
                        {m.active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteMapping(m.id, m.sisu_task_name)}
                        className="p-1.5 text-[#94a3b8] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                        title="Delete Mapping"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
