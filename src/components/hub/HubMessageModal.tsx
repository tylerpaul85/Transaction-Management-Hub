import React, { useState } from 'react';
import { HubTeamMember } from '../../types/hub';
import { X, Send, MessageSquare, Mail, Phone, CheckCircle2 } from 'lucide-react';

interface HubMessageModalProps {
  recipient: {
    name: string;
    role: string;
    email?: string;
    phone?: string;
  };
  propertyAddress: string;
  onClose: () => void;
}

export const HubMessageModal: React.FC<HubMessageModalProps> = ({
  recipient,
  propertyAddress,
  onClose,
}) => {
  const [channel, setChannel] = useState<'email' | 'sms'>('sms');
  const [message, setMessage] = useState(
    `Hi ${recipient.name}, this is an update regarding ${propertyAddress}. Everything is progressing on schedule with our milestones! Let me know if you have any questions.`
  );
  const [isSent, setIsSent] = useState(false);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSent(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0e1726] border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-7 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                Direct Communications
              </span>
              <h2 className="text-lg font-bold text-white">Message {recipient.name}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isSent ? (
          <div className="py-8 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-6 w-6 stroke-[2.5]" />
            </div>
            <h3 className="text-base font-bold text-white">Message Dispatched!</h3>
            <p className="text-xs text-slate-400">
              Your {channel === 'sms' ? 'SMS text' : 'email'} update has been sent to {recipient.name}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-4">
            {/* Recipient summary card */}
            <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Recipient:</span>
                <span className="font-semibold text-white">
                  {recipient.name} ({recipient.role})
                </span>
              </div>
              {recipient.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Phone:</span>
                  <span className="font-mono-code text-slate-300">{recipient.phone}</span>
                </div>
              )}
              {recipient.email && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Email:</span>
                  <span className="text-slate-300">{recipient.email}</span>
                </div>
              )}
            </div>

            {/* Channel Selection Toggle */}
            <div className="flex items-center gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setChannel('sms')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  channel === 'sms'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Phone className="h-3.5 w-3.5" />
                <span>SMS Text</span>
              </button>

              <button
                type="button"
                onClick={() => setChannel('email')}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  channel === 'email'
                    ? 'bg-sky-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Email Digest</span>
              </button>
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Message Content
              </label>
              <textarea
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-[#131d2e] border border-slate-700/80 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-all resize-none"
              />
            </div>

            {/* Action buttons */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Property: {propertyAddress}
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md active:scale-[0.98]"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send Message</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
