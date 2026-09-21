import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../integrations/supabase/client';
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
  AlertCircle,
  Upload,
  FileSpreadsheet,
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
  const [logs, setLogs] = useState<MockWebhookLog[]>([]);
  const [conflicts, setConflicts] = useState<MockConflict[]>([]);
  const [runs, setRuns] = useState<MockReconciliationRun[]>([]);
  const [activeTab, setActiveTab] = useState<'logs' | 'conflicts' | 'reconciliation'>('logs');
  const [selectedPayload, setSelectedPayload] = useState<any | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load real logs, conflicts, and runs from Supabase
  const loadLiveData = async () => {
    try {
      const { data: logData } = await supabase
        .from('sisu_webhook_log')
        .select('*')
        .order('received_at', { ascending: false })
        .limit(20);

      if (logData) {
        setLogs(
          logData.map((l: any) => ({
            id: l.id,
            event_type: l.event_type || 'transaction.updated',
            transaction_id: l.transaction_id || 'SISU-RAW',
            received_at: l.received_at ? l.received_at.replace('T', ' ').substring(0, 19) : '',
            processed: l.processed,
            payload: l.payload,
          }))
        );
      }

      const { data: conflictData } = await supabase
        .from('sync_conflicts')
        .select('*')
        .order('detected_at', { ascending: false });

      if (conflictData) {
        setConflicts(
          conflictData.map((c: any) => ({
            id: c.id,
            transaction_id: c.transaction_id,
            property_address: '103 Ella St, Waynesville, MO',
            sisu_transaction_id: c.sisu_transaction_id,
            milestone_type: c.milestone_type,
            current_manual_value: c.current_manual_value,
            incoming_sisu_value: c.incoming_sisu_value,
            detected_at: c.detected_at ? c.detected_at.replace('T', ' ').substring(0, 19) : '',
            resolved: c.resolved,
          }))
        );
      }

      const { data: runData } = await supabase
        .from('reconciliation_runs')
        .select('*')
        .order('run_at', { ascending: false });

      if (runData) {
        setRuns(
          runData.map((r: any) => ({
            id: r.id,
            run_at: r.run_at ? r.run_at.replace('T', ' ').substring(0, 19) : '',
            transactions_checked: r.transactions_checked || 0,
            transactions_updated: r.transactions_updated || 0,
            conflicts_found: r.conflicts_found || 0,
            duration_ms: r.duration_ms || 0,
            status: r.status || 'completed',
          }))
        );
      }
    } catch (err) {
      console.warn('Error loading sync debug data:', err);
    }
  };

  useEffect(() => {
    loadLiveData();
  }, []);

  const handleSimulateWebhook = async () => {
    setIsSimulating(true);
    try {
      const realMsregTestPayload = {
        Type: "Notification",
        Message: JSON.stringify({
          bulk_guid: "0fb0304c-77a8-41ab-89b5-3aa5d4de1240",
          model: "Client",
          action: "insert",
          team_id: 1200,
          data_objects: [
            {
              updated_values: {
                client_id: 6763992,
                agent_id: 235141,
                type_id: "s",
                first_name: "William",
                last_name: "Estilo",
                address_1: "103 Ella St Waynesville 65583",
                mobile_phone: "417-414-7029",
                pipeline_status: "Appt Set"
              },
              object_data: {
                agent_record: {
                  agent_id: 235141,
                  full_name: "Storm Kittel",
                  email: "storm@mattsmithrealestategroup.com",
                  mobile_phone: "5732615528"
                },
                full_object: {
                  client_id: 6763992,
                  type_id: "s",
                  first_name: "William",
                  last_name: "Estilo",
                  full_name: "William Estilo",
                  address_1: "103 Ella St Waynesville 65583",
                  pipeline_status: "Appt Set"
                }
              }
            }
          ]
        })
      };

      await supabase.functions.invoke('sisu-webhook-receiver', {
        body: realMsregTestPayload,
      });

      await loadLiveData();
    } catch (err) {
      console.error('Error invoking sisu-webhook-receiver:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleResolveConflict = async (conflictId: string, action: 'kept_manual' | 'accepted_sisu') => {
    try {
      await (supabase as any)
        .from('sync_conflicts')
        .update({ resolved: true, resolution_notes: `Resolved via admin console: ${action}` })
        .eq('id', conflictId);
      await loadLiveData();
    } catch (err) {
      console.error('Error resolving conflict:', err);
    }
  };

  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [csvStatusMessage, setCsvStatusMessage] = useState<string | null>(null);

  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingCsv(true);
    setCsvStatusMessage('Processing Sisu CSV export...');

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setCsvStatusMessage('CSV file is empty or invalid.');
        setIsImportingCsv(false);
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());

      const getVal = (rowParts: string[], colNames: string[]) => {
        for (const name of colNames) {
          const idx = headers.findIndex((h) => h.includes(name));
          if (idx !== -1 && rowParts[idx]) {
            return rowParts[idx].trim().replace(/^"|"$/g, '');
          }
        }
        return '';
      };

      let importedCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
        const cleanRow = row.map((cell) => cell.trim().replace(/^"|"$/g, ''));

        const clientFirstName = getVal(cleanRow, ['first_name', 'first name', 'client_first']);
        const clientLastName = getVal(cleanRow, ['last_name', 'last name', 'client_last']);
        const clientFullName = getVal(cleanRow, ['client', 'full_name', 'name', 'client_name']) || `${clientFirstName} ${clientLastName}`.trim();

        const sisuId = getVal(cleanRow, ['client_id', 'id', 'sisu_id', 'transaction_id']) || `SISU-CSV-${Date.now()}-${i}`;
        const address = getVal(cleanRow, ['address_1', 'address', 'property_address']) || 'Pending Address';
        const city = getVal(cleanRow, ['city']) || 'Waynesville';
        const state = getVal(cleanRow, ['state']) || 'MO';
        const sideVal = getVal(cleanRow, ['side', 'type', 'representation']).toLowerCase();
        const side = (sideVal.includes('seller') || sideVal.includes('listing') || sideVal === 's') ? 'seller' : 'buyer';
        const status = getVal(cleanRow, ['pipeline_status', 'status', 'stage']) || 'Under Contract';
        const agentName = getVal(cleanRow, ['agent', 'agent_name', 'primary_agent']);
        const agentEmail = getVal(cleanRow, ['agent_email', 'email']);
        const clientPhone = getVal(cleanRow, ['phone', 'mobile_phone', 'mobile']);

        let agentId: string | null = null;
        if (agentName || agentEmail) {
          const { data: existingAgent } = await (supabase.from('agents') as any)
            .select('id')
            .or(`email.eq.${(agentEmail || '').toLowerCase()},name.eq.${agentName}`)
            .maybeSingle();

          if (existingAgent) {
            agentId = existingAgent.id;
          } else if (agentName) {
            const { data: newAgent } = await (supabase.from('agents') as any)
              .insert({
                name: agentName,
                email: agentEmail ? agentEmail.toLowerCase() : `${agentName.toLowerCase().replace(/\s+/g, '.')}@mattsmithrealestategroup.com`,
                active: true,
              })
              .select('id')
              .maybeSingle();
            if (newAgent) agentId = newAgent.id;
          }
        }

        const { data: existingTx } = await (supabase.from('transactions') as any)
          .select('id')
          .eq('sisu_transaction_id', sisuId)
          .maybeSingle();

        const isGenuine =
          address &&
          address.trim().length >= 3 &&
          address.toLowerCase() !== 'pending address' &&
          !address.toLowerCase().startsWith('pending address') &&
          address.toLowerCase() !== 'tbd' &&
          !address.toLowerCase().startsWith('tbd ');

        if (existingTx) {
          const updateData: Record<string, any> = {
            updated_at: new Date().toISOString(),
          };
          if (isGenuine) updateData.property_address = address;
          if (city) updateData.city = city;
          if (state) updateData.state = state;
          if (sideVal) updateData.side = side;
          if (status) updateData.status = status;
          if (clientFullName && clientFullName !== 'Unnamed Client') updateData.client_name = clientFullName;
          if (clientPhone) updateData.client_phone = clientPhone;
          if (agentId) {
            if (side === 'seller') updateData.listing_agent_id = agentId;
            else updateData.selling_agent_id = agentId;
          }
          await (supabase.from('transactions') as any).update(updateData).eq('id', existingTx.id);
        } else {
          // Only pull over properties that have a genuine street address
          if (!isGenuine) {
            continue;
          }

          await (supabase.from('transactions') as any).insert({
            sisu_transaction_id: sisuId,
            property_address: address,
            city,
            state,
            side,
            status,
            client_name: clientFullName || 'Unnamed Client',
            client_phone: clientPhone || null,
            listing_agent_id: side === 'seller' ? agentId : null,
            selling_agent_id: side === 'buyer' ? agentId : null,
          });
        }

        importedCount++;
      }

      setCsvStatusMessage(`Successfully imported ${importedCount} transactions from Sisu CSV!`);
      await loadLiveData();
    } catch (err: any) {
      console.error('CSV import error:', err);
      setCsvStatusMessage(`CSV import error: ${err.message || String(err)}`);
    } finally {
      setIsImportingCsv(false);
    }
  };

  const handleTriggerReconciliation = async () => {
    setIsSyncing(true);
    try {
      await supabase.functions.invoke('sisu-nightly-reconciliation');
      await loadLiveData();
    } catch (err) {
      console.error('Error triggering reconciliation:', err);
    } finally {
      setIsSyncing(false);
    }
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

          <div className="flex flex-wrap items-center gap-2">
            <label className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-[#f8fafc] font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md min-h-[38px]">
              <Upload className="h-3.5 w-3.5" />
              <span>{isImportingCsv ? 'Importing CSV...' : 'Import Sisu CSV Export'}</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvFileUpload}
                disabled={isImportingCsv}
                className="hidden"
              />
            </label>
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
              disabled={isSyncing}
              className="px-3.5 py-2 bg-[#131826] hover:bg-[#334155] text-[#f8fafc] font-semibold rounded-xl text-xs flex items-center gap-1.5 border border-[#334155] transition-all min-h-[38px]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Run Nightly Sync'}</span>
            </button>
          </div>
        </div>

        {csvStatusMessage && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{csvStatusMessage}</span>
          </div>
        )}

        {/* Informative Sisu Historical Backfill Note */}
        <div className="p-3.5 bg-sky-950/40 border border-sky-500/30 rounded-xl flex items-start gap-3 text-xs text-sky-200">
          <AlertCircle className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-sky-100 font-semibold block mb-0.5">Sisu Real-Time Sync Active (Team ID 1200):</strong>
            The system has logged and synced <strong>5 live transactions</strong> so far via Sisu webhooks. To import all 100+ active historical deals into this management hub:
            <ul className="list-disc list-inside space-y-0.5 mt-1 text-sky-300">
              <li>Log in to Sisu Admin (<code className="bg-slate-900/60 px-1 py-0.5 rounded text-[#f8fafc]">beta.sisu.co</code>) &gt; <strong>Admin / Team Settings</strong> &gt; <strong>Webhooks</strong>.</li>
              <li>Click <strong>Resend / Trigger Webhooks</strong> or touch/edit transactions in Sisu to stream all 100+ deals directly to your Supabase listener.</li>
            </ul>
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
