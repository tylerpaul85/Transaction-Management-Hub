import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert,
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  Send,
  Eye,
  FileCode,
  Check,
  X,
  Layers,
  Sparkles,
} from 'lucide-react';
import sampleWebhook from '../../supabase/samples/sisu-webhook-sample.json';

interface MockWebhookLog {
  id: string;
  event_type: string;
  transaction_id: string;
  received_at: string;
  processed: boolean;
  error?: string | null;
  payload: any;
}

interface MockConflict {
  id: string;
  transaction_id: string;
  property_address: string;
  sisu_transaction_id: string;
  milestone_type: string;
  current_manual_value: {
    target_date?: string;
    actual_date?: string;
    status: string;
    notes?: string;
    updated_at: string;
    source: string;
  };
  incoming_sisu_value: {
    target_date?: string;
    actual_date?: string;
    status: string;
    notes?: string;
    source: string;
  };
  detected_at: string;
  resolved: boolean;
  resolution_action?: string;
}

interface MockReconciliationRun {
  id: string;
  run_at: string;
  transactions_checked: number;
  transactions_updated: number;
  conflicts_found: number;
  duration_ms: number;
  status: 'completed' | 'failed';
}

const INITIAL_LOGS: MockWebhookLog[] = [
  {
    id: 'log-1',
    event_type: 'transaction.updated',
    transaction_id: 'SISU-TRX-8901',
    received_at: '2026-09-16 17:30:12',
    processed: true,
    payload: sampleWebhook,
  },
  {
    id: 'log-2',
    event_type: 'milestone.status_changed',
    transaction_id: 'SISU-TRX-8902',
    received_at: '2026-09-16 14:15:40',
    processed: true,
    payload: {
      event: 'milestone.status_changed',
      transaction_id: 'SISU-TRX-8902',
      data: {
        milestone: 'clear_to_close',
        status: 'satisfied',
        actual_date: '2026-09-14',
      },
    },
  },
  {
    id: 'log-3',
    event_type: 'transaction.delta',
    transaction_id: 'SISU-TRX-8903',
    received_at: '2026-09-16 09:12:05',
    processed: true,
    payload: {
      event: 'transaction.delta',
      transaction_id: 'SISU-TRX-8903',
      changed_fields: ['earnest_money_date'],
    },
  },
];

const INITIAL_CONFLICTS: MockConflict[] = [
  {
    id: 'conf-1',
    transaction_id: 't1111111-1111-1111-1111-111111111111',
    property_address: '2100 N Lincoln Park West, Unit 18A',
    sisu_transaction_id: 'SISU-TRX-8901',
    milestone_type: 'inspection_10day',
    current_manual_value: {
      target_date: '2026-09-22',
      status: 'pending',
      notes: 'Attorney negotiated 4-day inspection extension with seller.',
      updated_at: '2026-09-16 16:45',
      source: 'manual',
    },
    incoming_sisu_value: {
      target_date: '2026-09-18',
      status: 'pending',
      notes: 'Default 10-day template date from CRM.',
      source: 'sisu',
    },
    detected_at: '2026-09-16 17:30:12',
    resolved: false,
  },
];

const INITIAL_RUNS: MockReconciliationRun[] = [
  {
    id: 'run-1',
    run_at: '2026-09-16 04:00:00',
    transactions_checked: 24,
    transactions_updated: 6,
    conflicts_found: 1,
    duration_ms: 1240,
    status: 'completed',
  },
  {
    id: 'run-2',
    run_at: '2026-09-15 04:00:00',
    transactions_checked: 22,
    transactions_updated: 4,
    conflicts_found: 0,
    duration_ms: 980,
    status: 'completed',
  },
];

export const AdminSyncDebug: React.FC = () => {
  const { currentUser } = useAuth();
  const [logs, setLogs] = useState<MockWebhookLog[]>(INITIAL_LOGS);
  const [conflicts, setConflicts] = useState<MockConflict[]>(INITIAL_CONFLICTS);
  const [runs, setRuns] = useState<MockReconciliationRun[]>(INITIAL_RUNS);
  const [activeTab, setActiveTab] = useState<'logs' | 'conflicts' | 'reconciliation'>('logs');
  const [selectedPayload, setSelectedPayload] = useState<any | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSimulateWebhook = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const newLog: MockWebhookLog = {
        id: `log-${Date.now()}`,
        event_type: 'transaction.updated',
        transaction_id: 'SISU-TRX-8901',
        received_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
        processed: true,
        payload: sampleWebhook,
      };
      setLogs((prev) => [newLog, ...prev]);
      setIsSimulating(false);
    }, 600);
  };

  const handleResolveConflict = (conflictId: string, action: 'kept_manual' | 'accepted_sisu') => {
    setConflicts((prev) =>
      prev.map((c) => (c.id === conflictId ? { ...c, resolved: true, resolution_action: action } : c))
    );
  };

  const handleTriggerReconciliation = () => {
    const newRun: MockReconciliationRun = {
      id: `run-${Date.now()}`,
      run_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
      transactions_checked: 28,
      transactions_updated: 3,
      conflicts_found: conflicts.filter((c) => !c.resolved).length,
      duration_ms: 840,
      status: 'completed',
    };
    setRuns((prev) => [newRun, ...prev]);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-6 shadow-xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-editorial text-xl sm:text-2xl font-bold text-[#f8fafc]">
                  Sisu Sync & Conflict Debug Console
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 uppercase">
                  Admin Internal Only
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] font-mono-code mt-0.5">
                Monitoring webhook receiver, manual edit preservation, and nightly reconciliation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSimulateWebhook}
              disabled={isSimulating}
              className="px-3.5 py-2 bg-[#d97706] text-[#0f172a] hover:bg-[#d97706]/90 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md min-h-[38px]"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{isSimulating ? 'Sending...' : 'Test Webhook POST'}</span>
            </button>
            <button
              onClick={handleTriggerReconciliation}
              className="px-3.5 py-2 bg-[#131826] hover:bg-[#334155] text-[#f8fafc] font-semibold rounded-xl text-xs flex items-center gap-1.5 border border-[#334155] transition-all min-h-[38px]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Run Nightly Sync</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 pt-2 border-t border-[#334155]/60">
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'logs'
                ? 'bg-[#0f172a] text-[#f8fafc] border border-[#334155]'
                : 'text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            Webhook Logs ({logs.length})
          </button>
          <button
            onClick={() => setActiveTab('conflicts')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'conflicts'
                ? 'bg-[#0f172a] text-[#f8fafc] border border-[#334155]'
                : 'text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            Sync Conflicts ({conflicts.filter((c) => !c.resolved).length} active)
          </button>
          <button
            onClick={() => setActiveTab('reconciliation')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'reconciliation'
                ? 'bg-[#0f172a] text-[#f8fafc] border border-[#334155]'
                : 'text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            Nightly Runs ({runs.length})
          </button>
        </div>
      </div>

      {/* TAB 1: WEBHOOK LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-[#334155] flex items-center justify-between">
            <h3 className="font-editorial text-base font-bold text-[#f8fafc]">
              Recent Sisu Webhooks (Last 50 Entries)
            </h3>
            <span className="text-xs text-[#94a3b8]">Stored in public.sisu_webhook_log</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#131826] text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider border-b border-[#334155]">
                <tr>
                  <th className="py-3 px-4">Received Time</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Sisu TX ID</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#131826]/60 transition-colors">
                    <td className="py-3 px-4 font-mono-code text-xs text-[#94a3b8]">
                      {log.received_at}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#f8fafc]">{log.event_type}</td>
                    <td className="py-3 px-4 font-mono-code font-bold text-[#d97706]">
                      {log.transaction_id}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        Processed
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedPayload(log.payload)}
                        className="px-2.5 py-1 bg-[#131826] hover:bg-[#334155] text-[#94a3b8] hover:text-[#f8fafc] rounded-lg text-xs font-mono-code border border-[#334155] inline-flex items-center gap-1"
                      >
                        <Eye className="h-3 w-3" />
                        <span>View JSON</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SYNC CONFLICTS */}
      {activeTab === 'conflicts' && (
        <div className="space-y-4">
          <div className="p-4 bg-[#1e293b] border border-[#334155] rounded-2xl flex items-center justify-between">
            <div>
              <h3 className="font-editorial text-base font-bold text-[#f8fafc]">
                Manual Edit Preservation & Conflict Queue
              </h3>
              <p className="text-xs text-[#94a3b8]">
                When a milestone was edited manually in MSREG Hub, Sisu updates are held for review
                so your custom dates are never clobbered.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              {conflicts.filter((c) => !c.resolved).length} Pending Review
            </span>
          </div>

          <div className="space-y-4">
            {conflicts.map((c) => (
              <div
                key={c.id}
                className="p-5 bg-[#1e293b] border border-[#334155] rounded-2xl shadow-lg space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#334155] pb-3">
                  <div>
                    <span className="font-mono-code text-xs text-[#d97706] font-bold block">
                      {c.sisu_transaction_id} • Milestone: {c.milestone_type.toUpperCase()}
                    </span>
                    <h4 className="text-base font-bold text-[#f8fafc]">{c.property_address}</h4>
                  </div>

                  <span className="text-xs text-[#94a3b8] font-mono-code">
                    Detected: {c.detected_at}
                  </span>
                </div>

                {/* Side-by-Side Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Current Manual */}
                  <div className="p-4 bg-[#131826] rounded-xl border border-emerald-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-400 uppercase tracking-wider">
                        Current Value in MSREG Hub (Manual Edit)
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        PRESERVED
                      </span>
                    </div>
                    <div className="space-y-1 text-[#f8fafc]">
                      <div>
                        Target Date:{' '}
                        <strong className="font-mono-code text-emerald-300">
                          {c.current_manual_value.target_date}
                        </strong>
                      </div>
                      <div>Status: {c.current_manual_value.status}</div>
                      <div>Notes: {c.current_manual_value.notes}</div>
                      <div className="text-[10px] text-[#94a3b8] pt-1">
                        Last edited locally at {c.current_manual_value.updated_at}
                      </div>
                    </div>
                  </div>

                  {/* Incoming Sisu */}
                  <div className="p-4 bg-[#131826] rounded-xl border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-400 uppercase tracking-wider">
                        Incoming Sisu CRM Value
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        BLOCKED OVERWRITE
                      </span>
                    </div>
                    <div className="space-y-1 text-[#f8fafc]">
                      <div>
                        Target Date:{' '}
                        <strong className="font-mono-code text-amber-300">
                          {c.incoming_sisu_value.target_date}
                        </strong>
                      </div>
                      <div>Status: {c.incoming_sisu_value.status}</div>
                      <div>Notes: {c.incoming_sisu_value.notes || 'None'}</div>
                    </div>
                  </div>
                </div>

                {/* Resolution Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-[#334155]/60">
                  <span className="text-xs text-[#94a3b8]">
                    {c.resolved ? `Resolved (${c.resolution_action})` : 'Choose action:'}
                  </span>

                  {!c.resolved ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResolveConflict(c.id, 'kept_manual')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-[#0f172a] border border-emerald-500/30 text-xs font-bold transition-all"
                      >
                        Keep Manual (Safe)
                      </button>
                      <button
                        onClick={() => handleResolveConflict(c.id, 'accepted_sisu')}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-400 hover:text-[#0f172a] border border-amber-500/30 text-xs font-bold transition-all"
                      >
                        Accept Sisu Update
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-400">
                      ✓ Conflict Closed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: RECONCILIATION RUNS */}
      {activeTab === 'reconciliation' && (
        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-[#334155] flex items-center justify-between">
            <h3 className="font-editorial text-base font-bold text-[#f8fafc]">
              Nightly Sisu Reconciliation History
            </h3>
            <span className="text-xs text-[#94a3b8]">Stored in public.reconciliation_runs</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#131826] text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider border-b border-[#334155]">
                <tr>
                  <th className="py-3 px-4">Run Timestamp</th>
                  <th className="py-3 px-4">Checked</th>
                  <th className="py-3 px-4">Updated</th>
                  <th className="py-3 px-4">Conflicts Found</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/60">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-[#131826]/60 transition-colors">
                    <td className="py-3 px-4 font-mono-code text-xs text-[#f8fafc]">{r.run_at}</td>
                    <td className="py-3 px-4 font-mono-code">{r.transactions_checked} Deals</td>
                    <td className="py-3 px-4 font-mono-code text-[#d97706]">
                      {r.transactions_updated} Updated
                    </td>
                    <td className="py-3 px-4 font-mono-code text-amber-400">
                      {r.conflicts_found} Conflicts
                    </td>
                    <td className="py-3 px-4 font-mono-code text-xs text-[#94a3b8]">
                      {r.duration_ms} ms
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Raw Payload Modal */}
      {selectedPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1a2235] border border-[#334155] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 bg-[#131826] border-b border-[#334155] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-[#d97706]" />
                <span className="font-editorial font-bold text-sm text-[#f8fafc]">
                  Raw Sisu JSON Payload
                </span>
              </div>
              <button
                onClick={() => setSelectedPayload(null)}
                className="p-1 rounded-lg hover:bg-[#334155] text-[#94a3b8] hover:text-[#f8fafc]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto font-mono-code text-xs bg-[#0f172a] text-emerald-400">
              <pre>{JSON.stringify(selectedPayload, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
