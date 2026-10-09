import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Send,
  Building,
  UserCheck,
  FileText,
  Calendar,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { TaskApprovalData } from '../../utils/taskApproval';

interface TaskCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskTitle: string;
  stepNumber?: number;
  propertyAddress: string;
  clientName?: string;
  assignedTcName: string;
  assignedTcEmail?: string;
  currentDate?: string | null;
  existingApprovalData?: TaskApprovalData | null;
  isOpsOrTc?: boolean;
  onSubmitForApproval: (data: {
    details: string;
    completionDate: string;
    documentLink?: string;
  }) => Promise<void> | void;
  onApproveByTc?: (tcNotes?: string) => Promise<void> | void;
  onRequestChangesByTc?: (tcFeedback: string) => Promise<void> | void;
}

export const TaskCompletionModal: React.FC<TaskCompletionModalProps> = ({
  isOpen,
  onClose,
  taskTitle,
  stepNumber,
  propertyAddress,
  clientName,
  assignedTcName,
  assignedTcEmail,
  currentDate,
  existingApprovalData,
  isOpsOrTc = false,
  onSubmitForApproval,
  onApproveByTc,
  onRequestChangesByTc,
}) => {
  const [details, setDetails] = useState(existingApprovalData?.details || '');
  const [completionDate, setCompletionDate] = useState(
    currentDate || new Date().toISOString().split('T')[0]
  );
  const [documentLink, setDocumentLink] = useState(
    existingApprovalData?.documentLink || ''
  );
  const [tcFeedbackNotes, setTcFeedbackNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAlreadyPending =
    existingApprovalData?.approvalStatus === 'pending_tc_approval';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim() || details.trim().length < 5) {
      setErrorMsg('Please enter completion details (at least 5 characters).');
      return;
    }
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onSubmitForApproval({
        details: details.trim(),
        completionDate,
        documentLink: documentLink.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit task details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTcApprove = async () => {
    if (!onApproveByTc) return;
    setIsSubmitting(true);
    try {
      await onApproveByTc(tcFeedbackNotes.trim() || undefined);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve milestone.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTcRequestChanges = async () => {
    if (!onRequestChangesByTc) return;
    if (!tcFeedbackNotes.trim()) {
      setErrorMsg('Please provide revision notes explaining what needs attention.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onRequestChangesByTc(tcFeedbackNotes.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to request changes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-200">
      <div
        className="bg-[#0e1726] border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-[#131d2e] to-[#0e1726] flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                <Clock className="h-3 w-3 animate-pulse" />
                TC Verification Required
              </span>
              {stepNumber && (
                <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                  Step #{stepNumber}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              {taskTitle}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-sky-400">
              <Building className="h-3.5 w-3.5" />
              <span className="font-semibold">{propertyAddress}</span>
              {clientName && (
                <span className="text-slate-400 font-normal">
                  • {clientName}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm">
          {/* Assigned TC Notice Card */}
          <div className="bg-[#142032] border border-sky-500/20 rounded-xl p-3.5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center justify-center font-bold text-xs shrink-0 font-mono tabular-nums">
              {assignedTcName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase() || 'TC'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[11px] text-sky-400 uppercase font-bold tracking-wider">
                <UserCheck className="h-3.5 w-3.5" />
                Assigned Transaction Coordinator
              </div>
              <div className="font-semibold text-white truncate text-xs sm:text-sm">
                {assignedTcName}{' '}
                {assignedTcEmail && (
                  <span className="text-slate-400 font-normal text-xs">
                    ({assignedTcEmail})
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                Your TC will verify these notes and attachments before officially marking this milestone complete.
              </p>
            </div>
          </div>

          {/* Existing Pending Submission Banner (if already submitted) */}
          {isAlreadyPending && existingApprovalData && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Currently Pending TC Approval
                </span>
                {existingApprovalData.submittedAt && (
                  <span className="text-[11px] text-slate-400 font-normal">
                    Submitted{' '}
                    {new Date(
                      existingApprovalData.submittedAt
                    ).toLocaleDateString('en-US')}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-200 bg-slate-900/60 rounded-lg p-2.5 font-mono tabular-nums text-[11px] whitespace-pre-wrap border border-slate-800">
                {existingApprovalData.details}
              </div>
              {existingApprovalData.submittedByName && (
                <div className="text-[10px] text-slate-400">
                  Submitted by: <strong>{existingApprovalData.submittedByName}</strong>
                </div>
              )}
            </div>
          )}

          {/* Form */}
          <form id="task-completion-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Completion Details Textarea */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-amber-400" />
                  Enter Details / Completion Notes{' '}
                  <span className="text-rose-400">*</span>
                </span>
                <span className="text-[10px] text-slate-400 font-normal normal-case">
                  Required for TC approval
                </span>
              </label>
              <textarea
                rows={4}
                value={details}
                onChange={(e) => {
                  setDetails(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                disabled={isSubmitting || (isOpsOrTc && isAlreadyPending)}
                placeholder="Enter specific details for your TC (e.g. Earnest money deposited at Freedom Title on 10/7 check #9843, copy uploaded in Dotloop folder, repair amendment signed, etc.)..."
                className="w-full px-3.5 py-2.5 bg-[#090e17] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-xs sm:text-sm resize-none disabled:opacity-60"
              />
            </div>

            {/* Date Completed */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-sky-400" />
                  Date Completed
                </label>
                <input
                  type="date"
                  value={completionDate}
                  onChange={(e) => setCompletionDate(e.target.value)}
                  disabled={isSubmitting || (isOpsOrTc && isAlreadyPending)}
                  className="w-full px-3 py-2 bg-[#090e17] border border-slate-700 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-sky-500 disabled:opacity-60"
                />
              </div>

              {/* Document Link / Proof (Optional) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5 text-emerald-400" />
                  Doc Link (Optional)
                </label>
                <input
                  type="text"
                  value={documentLink}
                  onChange={(e) => setDocumentLink(e.target.value)}
                  disabled={isSubmitting || (isOpsOrTc && isAlreadyPending)}
                  placeholder="Dotloop or Google Drive link..."
                  className="w-full px-3 py-2 bg-[#090e17] border border-slate-700 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:border-emerald-500 placeholder-slate-600 disabled:opacity-60"
                />
              </div>
            </div>

            {/* TC Approval Section (visible only when TC / Ops is viewing) */}
            {isOpsOrTc && (
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <ShieldCheck className="h-4 w-4" />
                  TC Final Review & Action Controls
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    TC Verification Notes / Feedback (Optional on approval, required on revision request):
                  </label>
                  <input
                    type="text"
                    value={tcFeedbackNotes}
                    onChange={(e) => setTcFeedbackNotes(e.target.value)}
                    placeholder="e.g., Verified in Dotloop and synced to Sisu..."
                    className="w-full px-3 py-2 bg-[#090e17] border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 placeholder-slate-600"
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </form>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-[#0b121e] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {/* If viewed by TC/Ops and currently pending approval */}
            {isOpsOrTc && isAlreadyPending ? (
              <>
                <button
                  type="button"
                  onClick={handleTcRequestChanges}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 rounded-xl transition-all"
                >
                  Request Changes
                </button>
                <button
                  type="button"
                  onClick={handleTcApprove}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isSubmitting ? 'Approving...' : 'Approve & Mark Done'}
                </button>
              </>
            ) : (
              <button
                type="submit"
                form="task-completion-form"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 font-medium"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    {isAlreadyPending
                      ? 'Update Details for TC'
                      : 'Submit to TC for Approval'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
