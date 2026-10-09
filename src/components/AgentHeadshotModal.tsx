import React, { useState, useRef } from 'react';
import {
  X,
  Camera,
  Upload,
  Link as LinkIcon,
  Check,
  AlertCircle,
  Loader2,
  Trash2,
  User,
} from 'lucide-react';
import { processHeadshotFile, saveAgentAvatar } from '../utils/avatarStorage';

interface AgentHeadshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentName: string;
  agentEmail?: string;
  agentId?: string;
  currentAvatarUrl?: string | null;
  onAvatarUpdated: (newAvatarUrl: string | null) => void;
}

export const AgentHeadshotModal: React.FC<AgentHeadshotModalProps> = ({
  isOpen,
  onClose,
  agentName,
  agentEmail,
  agentId,
  currentAvatarUrl,
  onAvatarUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl || null);
  const [customUrl, setCustomUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const initials = agentName
    ? agentName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'MS';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, or WEBP).');
      return;
    }

    try {
      setIsProcessing(true);
      setErrorMsg(null);
      const dataUrl = await processHeadshotFile(file, 400);
      setPreviewUrl(dataUrl);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyUrl = () => {
    if (!customUrl.trim()) return;
    setPreviewUrl(customUrl.trim());
    setErrorMsg(null);
  };

  const handleSave = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      if (previewUrl) {
        await saveAgentAvatar({
          agentId,
          email: agentEmail,
          avatarUrl: previewUrl,
        });
        onAvatarUpdated(previewUrl);
        setSuccessMsg('Headshot updated successfully!');
      } else {
        await saveAgentAvatar({
          agentId,
          email: agentEmail,
          avatarUrl: '',
        });
        onAvatarUpdated(null);
        setSuccessMsg('Headshot removed.');
      }

      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save headshot');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setCustomUrl('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#111726] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Camera className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Update Agent Headshot
              </h3>
              <p className="text-xs text-slate-400">{agentName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Preview Avatar */}
        <div className="flex flex-col items-center justify-center space-y-3 py-2">
          <div className="relative group">
            <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-amber-500/40 bg-[#090d16] shadow-xl flex items-center justify-center">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={agentName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-slate-800 text-amber-400 font-bold text-2xl font-mono">
                  {initials}
                </div>
              )}
            </div>

            {previewUrl && (
              <button
                onClick={handleRemove}
                title="Remove photo"
                className="absolute -top-1 -right-1 p-1.5 rounded-full bg-red-500/80 hover:bg-red-600 text-white shadow-lg transition-transform hover:scale-110"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-400">
            {previewUrl ? 'Previewing photo' : 'No photo uploaded — showing default monogram'}
          </span>
        </div>

        {/* Tab Controls: Upload File vs Image URL */}
        <div className="flex rounded-xl bg-[#0d121f] p-1 border border-white/10">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'upload'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Upload Photo</span>
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'url'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LinkIcon className="h-3.5 w-3.5" />
            <span>Image URL</span>
          </button>
        </div>

        {/* Tab 1: Upload from device */}
        {activeTab === 'upload' && (
          <div className="space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png,image/jpeg,image/webp,image/jpg"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-white/10 hover:border-amber-500/60 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-[#0d121f]/40 hover:bg-[#0d121f]/80 text-center"
            >
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
                <Camera className="h-6 w-6" />
              </div>
              <p className="text-xs font-semibold text-slate-100">
                Click or drag & drop to choose photo
              </p>
              <p className="text-[10px] text-slate-400">
                PNG, JPG, or WEBP (auto-cropped to square headshot)
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Web Image Link */}
        {activeTab === 'url' && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-400">
              Public Headshot URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://example.com/headshot.jpg"
                className="flex-1 px-3 py-2 bg-[#0d121f] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleApplyUrl}
                className="px-3 py-2 bg-white/10 hover:bg-[#475569] text-xs font-bold text-white rounded-xl transition-colors"
              >
                Preview
              </button>
            </div>
          </div>
        )}

        {/* Error / Success Notifications */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white/10 hover:bg-[#475569] text-slate-100 rounded-xl text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isProcessing}
            className="px-5 py-2 bg-amber-400 hover:bg-[#b45309] text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            <span>Save Headshot</span>
          </button>
        </div>
      </div>
    </div>
  );
};
