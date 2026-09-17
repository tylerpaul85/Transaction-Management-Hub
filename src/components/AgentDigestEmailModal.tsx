import React, { useState } from 'react';
import { renderAgentDigestEmail, DigestTransactionItem } from '../utils/agentDigestEmail';
import { OpsTransaction } from '../types/ops';
import { supabase } from '../integrations/supabase/client';
import {
  X,
  Send,
  Mail,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
} from 'lucide-react';

interface AgentDigestEmailModalProps {
  agentName: string;
  agentEmail: string;
  transactions: OpsTransaction[];
  onClose: () => void;
}

export const AgentDigestEmailModal: React.FC<AgentDigestEmailModalProps> = ({
  agentName,
  agentEmail: initialAgentEmail,
  transactions,
  onClose,
}) => {
  const [recipientEmail, setRecipientEmail] = useState(
    initialAgentEmail || 'tyler.p@mattsmithrealestategroup.com'
  );
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);
  const [copiedType, setCopiedType] = useState<'html' | 'text' | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // Transform OpsTransactions into DigestTransactionItems
  const digestItems: DigestTransactionItem[] = transactions.map((tx) => {
    const milestonesList = tx.milestones || [];
    const overdue = milestonesList
      .filter((m) => {
        if (!m.target_date) return false;
        const isDone = m.status === 'satisfied' || m.status === 'waived';
        return !isDone && m.target_date < todayStr;
      })
      .map((m) => {
        const targetMs = new Date(m.target_date!).getTime();
        const nowMs = new Date(todayStr).getTime();
        const diffDays = Math.max(1, Math.round((nowMs - targetMs) / (1000 * 60 * 60 * 24)));
        return {
          type: m.milestone_type,
          label: m.milestone_type.replace(/_/g, ' ').toUpperCase(),
          target_date: m.target_date,
          status: m.status,
          days_overdue: diffDays,
        };
      });

    const pending = milestonesList
      .filter((m) => {
        const isDone = m.status === 'satisfied' || m.status === 'waived';
        return !isDone && m.target_date && m.target_date >= todayStr;
      })
      .sort((a, b) => (a.target_date! > b.target_date! ? 1 : -1));

    const nextM = pending.length > 0 ? pending[0] : null;

    return {
      id: tx.id,
      property_address: tx.property_address,
      client_name: tx.client_name,
      side: tx.side,
      contract_date: tx.contract_date,
      target_closing_date: tx.target_closing_date,
      next_milestone: nextM
        ? {
            type: nextM.milestone_type,
            label: nextM.milestone_type.replace(/_/g, ' ').toUpperCase(),
            target_date: nextM.target_date,
            status: nextM.status,
          }
        : null,
      overdue_milestones: overdue,
    };
  });

  const { subject, html, text } = renderAgentDigestEmail({
    agentName,
    agentEmail: recipientEmail,
    transactions: digestItems,
    frequencyName: 'Weekly',
  });

  const handleSendServerEmail = async () => {
    setIsSending(true);
    setSendResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('weekly-agent-digest', {
        body: {
          agent_name: agentName,
          agent_email: recipientEmail,
        },
      });

      if (error) throw error;

      if (data?.summary?.emails_sent > 0) {
        setSendResult({
          type: 'success',
          message: `Email update successfully dispatched to ${recipientEmail}!`,
        });
      } else {
        setSendResult({
          type: 'warning',
          message: `Digest generated with ${transactions.length} deals. Note: If RESEND_API_KEY is missing in Supabase Edge Function Secrets, use the 'Open Mail App' or 'Copy Email' options below to dispatch immediately!`,
        });
      }
    } catch (err: any) {
      console.warn('Digest invoke result:', err);
      setSendResult({
        type: 'warning',
        message: `Digest email payload generated for ${recipientEmail}! Use the 'Open Mail App' or 'Copy Text' options below to send directly via Outlook/Gmail.`,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenMailClient = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(recipientEmail)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(text)}`;
    window.open(mailtoUrl, '_blank');
  };

  const handleCopy = (content: string, type: 'html' | 'text') => {
    navigator.clipboard.writeText(content);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#1e293b] border border-[#334155] rounded-3xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-[#131826] border-b border-[#334155] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#d97706]/15 border border-[#d97706]/30 text-[#d97706]">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#d97706]">
                Weekly Transaction Update Dispatch
              </span>
              <h2 className="text-lg font-bold text-[#f8fafc]">
                Email Overview for {agentName} ({transactions.length} Deals)
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-[#94a3b8] hover:text-white transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Target Email Input */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1.5">
                Recipient Email Address
              </label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#131826] border border-[#334155] rounded-xl text-sm font-semibold text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#94a3b8] uppercase mb-1.5">
                Subject Line
              </label>
              <input
                type="text"
                readOnly
                value={subject}
                className="w-full px-4 py-2.5 bg-[#131826]/70 border border-[#334155] rounded-xl text-xs font-semibold text-[#94a3b8]"
              />
            </div>
          </div>

          {/* Feedback banner */}
          {sendResult && (
            <div
              className={`p-4 rounded-2xl text-xs font-semibold flex items-start gap-3 border ${
                sendResult.type === 'success'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
              }`}
            >
              {sendResult.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <span>{sendResult.message}</span>
              </div>
            </div>
          )}

          {/* Email HTML Preview Card */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#94a3b8] uppercase flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-[#d97706]" />
                <span>Live Email Content Preview</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(html, 'html')}
                  className="px-3 py-1 bg-[#131826] hover:bg-[#334155] border border-[#334155] text-xs text-sky-400 font-bold rounded-lg flex items-center gap-1 transition-all"
                >
                  {copiedType === 'html' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Copy HTML</span>
                </button>
                <button
                  onClick={() => handleCopy(text, 'text')}
                  className="px-3 py-1 bg-[#131826] hover:bg-[#334155] border border-[#334155] text-xs text-emerald-400 font-bold rounded-lg flex items-center gap-1 transition-all"
                >
                  {copiedType === 'text' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Copy Text</span>
                </button>
              </div>
            </div>

            <div className="bg-[#0f172a] border border-[#334155] rounded-2xl p-4 max-h-96 overflow-y-auto">
              <div dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-[#131826] border-t border-[#334155] flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[#334155] hover:bg-[#475569] text-white text-xs font-semibold transition-all"
          >
            Close
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleOpenMailClient}
              className="px-4 py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/40 text-sky-300 text-xs font-bold flex items-center gap-2 transition-all active:scale-[0.98]"
              title="Open pre-filled draft in Outlook / Apple Mail / Gmail"
            >
              <ExternalLink className="h-4 w-4 text-sky-400" />
              <span>Open Mail App</span>
            </button>

            <button
              onClick={handleSendServerEmail}
              disabled={isSending}
              className="px-5 py-2.5 rounded-xl bg-[#d97706] hover:bg-[#b45309] text-white text-xs font-bold flex items-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-[#d97706]/20 disabled:opacity-50"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <Send className="h-4 w-4 text-white" />
              )}
              <span>Send via Cloud Server</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
