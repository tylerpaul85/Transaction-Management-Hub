import React, { useState } from 'react';
import { useTransactions } from '../context/TransactionContext';
import {
  TransactionStage,
  STAGE_CONFIG,
  ContingencyStatus,
  DocumentStatus,
  DocumentCategory,
  TransactionHealth,
  PartyContact,
} from '../types/transaction';
import {
  X,
  Building,
  Calendar,
  FileText,
  DollarSign,
  Users,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  ArrowRight,
  ShieldCheck,
  Send,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Printer,
  Copy,
  Check,
  Trash2,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';

export const TransactionDetailModal: React.FC = () => {
  const {
    selectedTransaction,
    setSelectedTransactionId,
    activeDetailTab,
    setActiveDetailTab,
    updateTransactionStage,
    updateContingencyStatus,
    updateDocumentStatus,
    addDocument,
    toggleMilestone,
    addActivityNote,
    updateCommission,
    addOrUpdateParty,
    openCdaModal,
  } = useTransactions();

  // Local state for new note
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isNotePinned, setIsNotePinned] = useState(false);

  // Local state for adding document
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocCategory, setNewDocCategory] = useState<DocumentCategory>('Contract');
  const [newDocRequired, setNewDocRequired] = useState(true);

  // Local state for adding party
  const [isAddingParty, setIsAddingParty] = useState(false);
  const [newPartyRole, setNewPartyRole] = useState<PartyContact['role']>('Real Estate Attorney');
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyEmail, setNewPartyEmail] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [newPartyCompany, setNewPartyCompany] = useState('');

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!selectedTransaction) return null;

  const trx = selectedTransaction;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    addActivityNote(
      trx.id,
      newNoteContent.trim(),
      'note',
      'Tyler Miller',
      'Lead Broker',
      isNotePinned
    );
    setNewNoteContent('');
    setIsNotePinned(false);
  };

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;
    addDocument(trx.id, {
      name: newDocName.trim(),
      category: newDocCategory,
      required: newDocRequired,
      status: 'uploaded',
      uploadedAt: new Date().toISOString().split('T')[0],
      fileSize: '1.4 MB',
    });
    setNewDocName('');
    setIsAddingDoc(false);
  };

  const handleAddParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartyName.trim() || !newPartyEmail.trim()) return;
    const newParty: PartyContact = {
      id: `party-${Date.now()}`,
      role: newPartyRole,
      name: newPartyName.trim(),
      email: newPartyEmail.trim(),
      phone: newPartyPhone.trim(),
      company: newPartyCompany.trim() || undefined,
    };
    addOrUpdateParty(trx.id, newParty);
    setNewPartyName('');
    setNewPartyEmail('');
    setNewPartyPhone('');
    setNewPartyCompany('');
    setIsAddingParty(false);
  };

  const STAGES: TransactionStage[] = [
    'intake',
    'escrow_opened',
    'inspection',
    'appraisal_loan',
    'clear_to_close',
    'closed',
  ];

  const compliantDocs = trx.documents.filter(
    (d) => d.status === 'approved' || d.status === 'signed'
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#1a2235] border border-[#334155] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Modal Top Banner & Header */}
        <div className="relative bg-[#131826] border-b border-[#334155] p-5 sm:p-6 flex-shrink-0">
          <button
            onClick={() => setSelectedTransactionId(null)}
            className="absolute top-4 right-4 p-2 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-[#94a3b8] hover:text-[#f8fafc] border border-[#334155] transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-12">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="font-mono-code text-xs font-bold text-[#d97706] bg-[#d97706]/15 border border-[#d97706]/30 px-2.5 py-0.5 rounded-full">
                  {trx.fileNumber}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    trx.representation === 'Buyer'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-[#d97706]/15 text-[#d97706] border-[#d97706]/30'
                  }`}
                >
                  {trx.representation} Representation
                </span>
                {trx.mlsId && (
                  <span className="text-xs text-[#94a3b8] font-mono-code">MLS: {trx.mlsId}</span>
                )}
              </div>

              <h2 className="font-editorial text-xl sm:text-2xl font-bold text-[#f8fafc]">
                {trx.address} {trx.unit ? `• ${trx.unit}` : ''}
              </h2>
              <p className="text-xs sm:text-sm text-[#94a3b8]">
                {trx.city}, {trx.state} {trx.zip} • Client: {trx.clientNames.join(', ')}
              </p>
            </div>

            {/* Quick Action & Price */}
            <div className="flex items-center gap-3 sm:text-right">
              <div>
                <span className="text-[11px] text-[#94a3b8] uppercase tracking-wider block">
                  Contract Price
                </span>
                <span className="font-mono-code text-xl sm:text-2xl font-bold text-[#f8fafc]">
                  {formatCurrency(trx.contractPrice)}
                </span>
              </div>

              <button
                onClick={() => openCdaModal(trx)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#d97706] text-[#0f172a] hover:bg-[#d97706]/90 font-semibold text-xs active:scale-[0.98] transition-all shadow-md min-h-[44px]"
              >
                <Printer className="h-4 w-4" />
                <span>CDA Letterhead</span>
              </button>
            </div>
          </div>

          {/* Stage Progress Bar / Selector */}
          <div className="mt-4 pt-4 border-t border-[#334155]/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#94a3b8] font-medium">Stage:</span>
              <select
                value={trx.stage}
                onChange={(e) => updateTransactionStage(trx.id, e.target.value as TransactionStage)}
                className="bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-1 text-sm font-semibold text-[#f8fafc] focus:outline-none focus:border-[#d97706] cursor-pointer"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_CONFIG[s].step}. {STAGE_CONFIG[s].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono-code text-[#94a3b8]">
              <span>Mutual: {trx.mutualAcceptanceDate}</span>
              <span className="text-[#f8fafc] font-semibold">Target Close: {trx.targetClosingDate}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-[#334155] bg-[#131826] px-4 sm:px-6 overflow-x-auto no-scrollbar">
          {[
            { id: 'overview', label: 'Overview & Milestones', icon: Building },
            { id: 'documents', label: `Documents (${compliantDocs}/${trx.documents.length})`, icon: FileText },
            { id: 'parties', label: `Parties (${trx.parties.length})`, icon: Users },
            { id: 'commission', label: 'Financials & CDA', icon: DollarSign },
            { id: 'activity', label: `Activity (${trx.activityLog.length})`, icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeDetailTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveDetailTab(tab.id as any)}
                className={`flex items-center gap-2 py-3.5 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap min-h-[44px] ${
                  isActive
                    ? 'border-[#d97706] text-[#d97706] bg-[#1e293b]/40'
                    : 'border-transparent text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#1e293b]/20'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: OVERVIEW & MILESTONES */}
          {activeDetailTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Dates Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-[#1e293b] rounded-xl border border-[#334155]">
                  <span className="text-[11px] text-[#94a3b8] block">Mutual Acceptance</span>
                  <span className="font-mono-code text-sm font-bold text-[#f8fafc]">
                    {trx.mutualAcceptanceDate}
                  </span>
                </div>
                <div className="p-3 bg-[#1e293b] rounded-xl border border-[#334155]">
                  <span className="text-[11px] text-[#94a3b8] block">Target Closing</span>
                  <span className="font-mono-code text-sm font-bold text-[#d97706]">
                    {trx.targetClosingDate}
                  </span>
                </div>
                <div className="p-3 bg-[#1e293b] rounded-xl border border-[#334155]">
                  <span className="text-[11px] text-[#94a3b8] block">Lead Broker</span>
                  <span className="text-sm font-semibold text-[#f8fafc] block truncate">
                    {trx.agentName}
                  </span>
                </div>
                <div className="p-3 bg-[#1e293b] rounded-xl border border-[#334155]">
                  <span className="text-[11px] text-[#94a3b8] block">Coordinator (TC)</span>
                  <span className="text-sm font-semibold text-[#f8fafc] block truncate">
                    {trx.tcName}
                  </span>
                </div>
              </div>

              {/* Contingency Timeline & Status */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-editorial text-lg font-bold text-[#f8fafc] flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#d97706]" />
                    <span>Contract Contingencies</span>
                  </h3>
                  <span className="text-xs text-[#94a3b8]">
                    Click to toggle satisfaction status
                  </span>
                </div>

                <div className="space-y-2.5">
                  {trx.contingencies.map((contingency) => (
                    <div
                      key={contingency.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-[#1e293b] border border-[#334155] rounded-xl gap-3 hover:border-[#334155]/80 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => {
                            const nextStatus: ContingencyStatus =
                              contingency.status === 'satisfied' ? 'pending' : 'satisfied';
                            updateContingencyStatus(trx.id, contingency.id, nextStatus);
                          }}
                          className={`mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center transition-all ${
                            contingency.status === 'satisfied'
                              ? 'bg-emerald-500 text-[#0f172a] border-emerald-400'
                              : contingency.status === 'waived'
                              ? 'bg-sky-500 text-[#0f172a] border-sky-400'
                              : 'border-[#334155] hover:border-[#d97706]'
                          }`}
                        >
                          {(contingency.status === 'satisfied' ||
                            contingency.status === 'waived') && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </button>

                        <div>
                          <span className="text-sm font-semibold text-[#f8fafc] block">
                            {contingency.name}
                          </span>
                          {contingency.notes && (
                            <p className="text-xs text-[#94a3b8] mt-0.5">{contingency.notes}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <span className="font-mono-code text-xs text-[#94a3b8]">
                          Due: {contingency.dueDate}
                        </span>
                        <select
                          value={contingency.status}
                          onChange={(e) =>
                            updateContingencyStatus(
                              trx.id,
                              contingency.id,
                              e.target.value as ContingencyStatus
                            )
                          }
                          className={`px-2 py-1 rounded-md text-xs font-semibold border cursor-pointer ${
                            contingency.status === 'satisfied'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : contingency.status === 'waived'
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          <option value="pending">Pending</option>
                          <option value="satisfied">Satisfied</option>
                          <option value="waived">Waived</option>
                          <option value="overdue">Overdue</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Milestones Checklist */}
              <div>
                <h3 className="font-editorial text-lg font-bold text-[#f8fafc] mb-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Escrow Milestone Tasks</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {trx.milestones.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => toggleMilestone(trx.id, m.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        m.completed
                          ? 'bg-emerald-500/5 border-emerald-500/20 text-[#f8fafc]'
                          : 'bg-[#1e293b] border-[#334155] text-[#94a3b8] hover:text-[#f8fafc]'
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                          m.completed
                            ? 'bg-emerald-500 text-[#0f172a] border-emerald-400'
                            : 'border-[#334155]'
                        }`}
                      >
                        {m.completed && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span
                          className={`text-xs sm:text-sm font-medium block truncate ${
                            m.completed ? 'line-through text-[#94a3b8]' : 'text-[#f8fafc]'
                          }`}
                        >
                          {m.title}
                        </span>
                        {m.completedAt && (
                          <span className="text-[10px] text-emerald-400 font-mono-code block">
                            Completed {m.completedAt}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sisu Custom Form Responses */}
              {trx.customFields && Object.keys(trx.customFields).length > 0 && (
                <div className="p-4 bg-[#131826] border border-[#334155] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-editorial text-base font-bold text-[#f8fafc] flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#d97706]" />
                      <span>Sisu Custom Form Responses</span>
                    </h3>
                    <span className="text-[11px] font-mono-code text-[#94a3b8]">
                      Live sync from Sisu forms
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {Object.entries(trx.customFields).map(([key, val]) => {
                      const CUSTOM_LABEL_OVERRIDES: Record<string, string> = {
                        inspection_completeds_63: 'Inspection Ordered',
                        inspection_completed: 'Inspection Ordered',
                        inspection_satisfieds_63: 'Inspection Satisfied',
                        insurance_obtaineds_63: 'Insurance Obtained',
                        earnest_money_depositeds_63: 'Earnest Money Deposited',
                        title_commitment_s_38_clearance: 'Title Commitment & Clearance',
                        'financing_/_loan_commitment_-_internal_use': 'Financing / Loan Commitment',
                        'clear-to-close_(ctc)': 'Clear to Close',
                        final_walkthrough: 'Final Walkthrough',
                        appraisal_received: 'Appraisal Received',
                        appraisal_satisfied: 'Appraisal Satisfied',
                      };

                      const label = CUSTOM_LABEL_OVERRIDES[key] || key
                        .replace(/s_\d+$|_\d+$/g, '')
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (c) => c.toUpperCase());

                      const isYes =
                        val === '0' ||
                        val === true ||
                        String(val).toLowerCase() === 'yes' ||
                        String(val).toLowerCase() === 'true';

                      const isNo =
                        val === '1' ||
                        val === false ||
                        String(val).toLowerCase() === 'no' ||
                        String(val).toLowerCase() === 'false';

                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between p-3 rounded-lg bg-[#1e293b] border border-[#334155]/80"
                        >
                          <span className="text-xs text-[#f8fafc] font-medium pr-2 truncate">
                            {label}
                          </span>
                          {isYes ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                              Yes
                            </span>
                          ) : isNo ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-700/50 text-[#94a3b8] border border-[#334155] whitespace-nowrap">
                              No
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#0f172a] text-[#94a3b8] border border-[#334155] whitespace-nowrap">
                              {String(val ?? '—')}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DOCUMENT COMPLIANCE */}
          {activeDetailTab === 'documents' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1e293b] p-4 rounded-xl border border-[#334155]">
                <div>
                  <h3 className="font-editorial text-base font-bold text-[#f8fafc]">
                    Real Estate Compliance Checklist
                  </h3>
                  <p className="text-xs text-[#94a3b8]">
                    Illinois Real Estate Board (MRED / Multi-Board 7.0) Mandatory File Checklist
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono-code text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                    {compliantDocs} of {trx.documents.length} Compliant
                  </span>
                  <button
                    onClick={() => setIsAddingDoc(true)}
                    className="px-3 py-1.5 bg-[#d97706] text-[#0f172a] hover:bg-[#d97706]/90 font-semibold rounded-lg text-xs flex items-center gap-1.5 min-h-[36px]"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Document</span>
                  </button>
                </div>
              </div>

              {/* Add Doc Form */}
              {isAddingDoc && (
                <form
                  onSubmit={handleAddDocument}
                  className="bg-[#131826] p-4 rounded-xl border border-[#d97706]/40 space-y-3"
                >
                  <h4 className="text-xs font-bold text-[#d97706] uppercase tracking-wider">
                    Add New Compliance Document
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Document Name (e.g. Lead Paint Addendum)"
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      required
                      className="sm:col-span-2 px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                    />
                    <select
                      value={newDocCategory}
                      onChange={(e) => setNewDocCategory(e.target.value as DocumentCategory)}
                      className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                    >
                      <option value="Contract">Contract</option>
                      <option value="Disclosures">Disclosures</option>
                      <option value="Financial & Title">Financial & Title</option>
                      <option value="Closing">Closing</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingDoc(false)}
                      className="px-3 py-1.5 rounded-lg border border-[#334155] text-xs text-[#94a3b8] hover:text-[#f8fafc]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-[#d97706] text-[#0f172a] text-xs font-bold hover:bg-[#d97706]/90"
                    >
                      Save to File
                    </button>
                  </div>
                </form>
              )}

              {/* Documents Table */}
              <div className="space-y-3">
                {trx.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-[#1e293b] border border-[#334155] rounded-xl gap-3 hover:border-[#334155]/80 transition-all"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-[#131826] border border-[#334155] text-[#94a3b8] flex-shrink-0">
                        <FileText className="h-4 w-4 text-[#d97706]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#f8fafc] truncate">
                            {doc.name}
                          </span>
                          {doc.required && (
                            <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded">
                              Required
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[#94a3b8] block mt-0.5">
                          Category: {doc.category}{' '}
                          {doc.uploadedAt ? `• Uploaded ${doc.uploadedAt}` : '• Not uploaded yet'}
                        </span>
                        {doc.notes && (
                          <p className="text-xs text-[#94a3b8] italic mt-1">{doc.notes}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <select
                        value={doc.status}
                        onChange={(e) =>
                          updateDocumentStatus(trx.id, doc.id, e.target.value as DocumentStatus)
                        }
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                          doc.status === 'approved' || doc.status === 'signed'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : doc.status === 'in_review'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : doc.status === 'uploaded'
                            ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        <option value="needed">Needed</option>
                        <option value="uploaded">Uploaded</option>
                        <option value="in_review">In Review</option>
                        <option value="approved">Approved</option>
                        <option value="signed">Signed</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: PARTIES & CONTACTS */}
          {activeDetailTab === 'parties' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-editorial text-lg font-bold text-[#f8fafc]">
                    Transaction Directory & Contacts
                  </h3>
                  <p className="text-xs text-[#94a3b8]">
                    Buyers, Sellers, Co-op Brokerage, Escrow/Title Officers, and Lenders
                  </p>
                </div>

                <button
                  onClick={() => setIsAddingParty(true)}
                  className="px-3 py-1.5 bg-[#d97706] text-[#0f172a] hover:bg-[#d97706]/90 font-semibold rounded-lg text-xs flex items-center gap-1.5 min-h-[36px]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Contact</span>
                </button>
              </div>

              {/* Add Party Form */}
              {isAddingParty && (
                <form
                  onSubmit={handleAddParty}
                  className="bg-[#131826] p-4 rounded-xl border border-[#d97706]/40 space-y-3"
                >
                  <h4 className="text-xs font-bold text-[#d97706] uppercase tracking-wider">
                    Add New Transaction Contact
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={newPartyRole}
                      onChange={(e) => setNewPartyRole(e.target.value as PartyContact['role'])}
                      className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-base text-[#f8fafc]"
                    >
                      <option value="Real Estate Attorney">Real Estate Attorney</option>
                      <option value="Title / Escrow Officer">Title / Escrow Officer</option>
                      <option value="Mortgage Lender">Mortgage Lender</option>
                      <option value="Home Inspector">Home Inspector</option>
                      <option value="Co-op Agent">Co-op Agent</option>
                      <option value="Buyer">Buyer</option>
                      <option value="Seller">Seller</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Contact Name"
                      value={newPartyName}
                      onChange={(e) => setNewPartyName(e.target.value)}
                      required
                      className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-base text-[#f8fafc]"
                    />
                    <input
                      type="email"
                      placeholder="Email Address"
                      value={newPartyEmail}
                      onChange={(e) => setNewPartyEmail(e.target.value)}
                      required
                      className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-base text-[#f8fafc]"
                    />
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={newPartyPhone}
                      onChange={(e) => setNewPartyPhone(e.target.value)}
                      className="px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-base text-[#f8fafc]"
                    />
                    <input
                      type="text"
                      placeholder="Company (Optional)"
                      value={newPartyCompany}
                      onChange={(e) => setNewPartyCompany(e.target.value)}
                      className="sm:col-span-2 px-3 py-2 bg-[#1e293b] border border-[#334155] rounded-lg text-base text-[#f8fafc]"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddingParty(false)}
                      className="px-3 py-1.5 rounded-lg border border-[#334155] text-xs text-[#94a3b8] hover:text-[#f8fafc]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-[#d97706] text-[#0f172a] text-xs font-bold hover:bg-[#d97706]/90"
                    >
                      Save Contact
                    </button>
                  </div>
                </form>
              )}

              {/* Contact Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trx.parties.map((party) => (
                  <div
                    key={party.id}
                    className="p-4 bg-[#1e293b] border border-[#334155] rounded-xl space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#131826] text-[#d97706] border border-[#334155]">
                          {party.role}
                        </span>
                        <h4 className="text-base font-bold text-[#f8fafc] mt-1">{party.name}</h4>
                        {party.company && (
                          <p className="text-xs text-[#94a3b8] font-medium">{party.company}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-[#94a3b8] pt-1 border-t border-[#334155]/60">
                      <div className="flex items-center justify-between">
                        <a
                          href={`mailto:${party.email}`}
                          className="flex items-center gap-1.5 hover:text-[#d97706] transition-colors truncate"
                        >
                          <Mail className="h-3.5 w-3.5 text-[#d97706]" />
                          <span className="truncate">{party.email}</span>
                        </a>
                        <button
                          onClick={() => handleCopy(party.email, `email-${party.id}`)}
                          className="p-1 hover:text-[#f8fafc]"
                          title="Copy Email"
                        >
                          {copiedId === `email-${party.id}` ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>

                      {party.phone && (
                        <div className="flex items-center justify-between">
                          <a
                            href={`tel:${party.phone}`}
                            className="flex items-center gap-1.5 hover:text-[#d97706] transition-colors font-mono-code"
                          >
                            <Phone className="h-3.5 w-3.5 text-emerald-400" />
                            <span>{party.phone}</span>
                          </a>
                          <button
                            onClick={() => handleCopy(party.phone, `phone-${party.id}`)}
                            className="p-1 hover:text-[#f8fafc]"
                            title="Copy Phone"
                          >
                            {copiedId === `phone-${party.id}` ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      )}

                      {party.address && (
                        <div className="flex items-start gap-1.5 text-[11px]">
                          <MapPin className="h-3.5 w-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
                          <span>{party.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: FINANCIALS & COMMISSION DISBURSEMENT (CDA) */}
          {activeDetailTab === 'commission' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#1e293b] p-5 rounded-2xl border border-[#334155]">
                <div>
                  <span className="font-mono-code text-xs text-[#d97706] font-bold block">
                    {trx.commission.cdaNumber} • Status: {trx.commission.cdaStatus}
                  </span>
                  <h3 className="font-editorial text-xl font-bold text-[#f8fafc]">
                    Commission Disbursement Breakdown
                  </h3>
                  <p className="text-xs text-[#94a3b8]">
                    Official brokerage splits, coordinator deductions, and net payout calculation.
                  </p>
                </div>

                <button
                  onClick={() => openCdaModal(trx)}
                  className="px-4 py-2.5 bg-[#d97706] text-[#0f172a] hover:bg-[#d97706]/90 font-bold rounded-xl text-sm active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg min-h-[44px]"
                >
                  <Printer className="h-4 w-4" />
                  <span>Generate Official CDA</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Financial Breakdown Card */}
                <div className="p-5 bg-[#1e293b] border border-[#334155] rounded-2xl space-y-4">
                  <h4 className="text-sm font-bold text-[#f8fafc] uppercase tracking-wider border-b border-[#334155] pb-2">
                    Gross Calculation
                  </h4>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Purchase Price:</span>
                      <span className="font-mono-code font-bold text-[#f8fafc]">
                        {formatCurrency(trx.commission.purchasePrice)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Commission Rate:</span>
                      <span className="font-mono-code font-semibold text-[#f8fafc]">
                        {trx.commission.commissionRate}%
                      </span>
                    </div>

                    <div className="flex justify-between pt-2 border-t border-[#334155]/60">
                      <span className="font-semibold text-[#f8fafc]">Total Gross Commission:</span>
                      <span className="font-mono-code font-bold text-[#d97706]">
                        {formatCurrency(trx.commission.grossCommission)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">
                        Agent Split ({trx.commission.agentSplitPercentage}%):
                      </span>
                      <span className="font-mono-code font-semibold text-[#f8fafc]">
                        {formatCurrency(trx.commission.agentGrossPayout)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Brokerage Retained:</span>
                      <span className="font-mono-code font-semibold text-[#94a3b8]">
                        {formatCurrency(trx.commission.brokerageGrossSplit)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Deductions & Net Payout Card */}
                <div className="p-5 bg-[#1e293b] border border-[#334155] rounded-2xl space-y-4">
                  <h4 className="text-sm font-bold text-[#f8fafc] uppercase tracking-wider border-b border-[#334155] pb-2">
                    Deductions & Net Payout
                  </h4>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Transaction Coordinator (TC) Fee:</span>
                      <span className="font-mono-code text-rose-400">
                        -${trx.commission.transactionCoordinatorFee}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">E&O Insurance Risk Fee:</span>
                      <span className="font-mono-code text-rose-400">
                        -${trx.commission.eoInsuranceFee}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-[#94a3b8]">Brokerage Admin File Fee:</span>
                      <span className="font-mono-code text-rose-400">
                        -${trx.commission.adminFee}
                      </span>
                    </div>

                    <div className="flex justify-between pt-3 border-t border-[#334155] bg-[#131826]/70 p-3 rounded-xl">
                      <div>
                        <span className="text-xs uppercase tracking-wider text-[#94a3b8] block">
                          Net Agent Payout
                        </span>
                        <span className="text-xs text-[#94a3b8]">Direct Deposit / Check</span>
                      </div>
                      <span className="font-mono-code text-xl font-bold text-[#d97706]">
                        {formatCurrency(trx.commission.netAgentPayout)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Escrow Disbursement Instructions */}
              <div className="p-4 bg-[#131826] border border-[#334155] rounded-xl text-xs space-y-2">
                <span className="font-bold text-[#d97706] uppercase tracking-wider">
                  Escrow Settlement Instructions
                </span>
                <p className="text-[#94a3b8]">
                  Closing Officer:{' '}
                  <strong className="text-[#f8fafc]">{trx.commission.escrowOfficer}</strong> at{' '}
                  <strong className="text-[#f8fafc]">{trx.commission.escrowCompany}</strong> (
                  {trx.commission.escrowEmail}). Disbursement authorized upon recording and escrow
                  receipt.
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: ACTIVITY & AUDIT TRAIL */}
          {activeDetailTab === 'activity' && (
            <div className="space-y-6">
              {/* Post Note Form */}
              <form
                onSubmit={handleAddNote}
                className="bg-[#1e293b] p-4 rounded-xl border border-[#334155] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#f8fafc] uppercase tracking-wider">
                    Add Note or Activity Update
                  </span>
                  <label className="flex items-center gap-2 text-xs text-[#94a3b8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isNotePinned}
                      onChange={(e) => setIsNotePinned(e.target.checked)}
                      className="h-4 w-4 rounded border-[#334155] bg-[#131826] text-[#d97706]"
                    />
                    <span>Pin to top</span>
                  </label>
                </div>

                <textarea
                  rows={3}
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Record note, negotiation update, phone log or escrow memo..."
                  required
                  className="w-full p-3 bg-[#131826] border border-[#334155] rounded-xl text-base text-[#f8fafc] placeholder-[#94a3b8] focus:outline-none focus:border-[#d97706]"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#d97706] text-[#0f172a] hover:bg-[#d97706]/90 font-semibold rounded-xl text-xs flex items-center gap-1.5 min-h-[36px]"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Post Activity</span>
                  </button>
                </div>
              </form>

              {/* Activity Stream */}
              <div className="space-y-3">
                {trx.activityLog.map((act) => (
                  <div
                    key={act.id}
                    className={`p-4 rounded-xl border transition-all ${
                      act.isPinned
                        ? 'bg-[#d97706]/10 border-[#d97706]/40'
                        : 'bg-[#1e293b] border-[#334155]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#f8fafc]">{act.author}</span>
                        <span className="text-[10px] text-[#94a3b8] bg-[#131826] px-2 py-0.5 rounded-full border border-[#334155]">
                          {act.role}
                        </span>
                        {act.isPinned && (
                          <span className="text-[10px] text-[#d97706] font-bold uppercase tracking-wider">
                            ★ Pinned
                          </span>
                        )}
                      </div>
                      <span className="font-mono-code text-[11px] text-[#94a3b8]">
                        {act.createdAt}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#f8fafc] leading-relaxed">
                      {act.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
