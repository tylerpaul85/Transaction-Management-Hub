import React, { useState } from 'react';
import {
  Camera,
  Home,
  CheckCircle2,
  FileCheck,
  Key,
  Shield,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  DollarSign,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';

interface GuidesContentProps {
  guideType: 'listing_guide' | 'selling_guide' | 'buyer_guide';
  propertyAddress: string;
}

export const GuidesContent: React.FC<GuidesContentProps> = ({ guideType, propertyAddress }) => {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const toggleItem = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (guideType === 'listing_guide') {
    return (
      <div className="space-y-6 animate-in fade-in duration-200">
        {/* Hero Card */}
        <div className="bg-gradient-to-r from-sky-950/40 via-slate-900 to-slate-900 border border-sky-500/20 rounded-3xl p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-2.5 text-sky-400">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Matt Smith Real Estate Group</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Home Listing & Preparation Guide</h2>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            Welcome to the official seller readiness guide for <strong className="text-white">{propertyAddress}</strong>. Follow these proven steps to showcase your home in the best light, attract premium buyers, and maximize your net proceeds.
          </p>
        </div>

        {/* Photography Day Checklist */}
        <div className="bg-[#0e1726] border border-slate-800 rounded-3xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Camera className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Photo Day Ready</span>
              <h3 className="text-lg font-bold text-white">Photography & Media Checklist</h3>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Our photographer captures high-resolution HDR stills and 4K digital tours. Ensure the following items are complete prior to arrival:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {[
              { id: 'p1', label: 'Turn on all interior lights, lamps, and under-cabinet fixtures' },
              { id: 'p2', label: 'Open all window blinds, shutters, and drapes to maximize natural light' },
              { id: 'p3', label: 'Clear all kitchen countertops (stow away small appliances, sponges, dish soaps)' },
              { id: 'p4', label: 'Remove refrigerator magnets, photos, and personal memos' },
              { id: 'p5', label: 'Lower all toilet seats and stow bathroom toiletries out of sight' },
              { id: 'p6', label: 'Make all beds neatly with decorative pillows centered' },
              { id: 'p7', label: 'Mow the lawn, trim shrubs, and clear garden hoses/tools from exterior view' },
              { id: 'p8', label: 'Move vehicles out of the driveway and from the immediate front street' },
            ].map((item) => {
              const isChecked = !!checkedItems[item.id];
              return (
                <div
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                    isChecked
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div
                    className={`mt-0.5 h-4 w-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors ${
                      isChecked
                        ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                        : 'border-slate-600 bg-slate-800'
                    }`}
                  >
                    {isChecked && <CheckCircle2 className="h-3.5 w-3.5 stroke-[3]" />}
                  </div>
                  <span className="text-xs font-medium leading-relaxed">{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Showing Protocol & ShowingTime Tips */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#0e1726] border border-slate-800 rounded-3xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-sky-400">
              <Clock className="h-5 w-5" />
              <h4 className="font-bold text-sm text-white">ShowingTime & Lockbox Protocol</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Licensed buyer agents will schedule private showings through the automated ShowingTime system. You will receive real-time notifications via SMS or app to approve or adjust times.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside pt-1">
              <li>Plan to step out 10 minutes prior to the scheduled window</li>
              <li>Keep pets secured or take them on a walk during tours</li>
              <li>Leave interior doors open to create a flowing, inviting space</li>
            </ul>
          </div>

          <div className="bg-[#0e1726] border border-slate-800 rounded-3xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-amber-400">
              <Shield className="h-5 w-5" />
              <h4 className="font-bold text-sm text-white">Seller Disclosures Verification</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Missouri law encourages full transparency regarding property condition, known mechanical repairs, roof age, and appliance warranties.
            </p>
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-[11px] text-slate-300">
              💡 <strong>Tip:</strong> Being upfront on disclosures builds immediate buyer confidence and drastically prevents renegotiations during the inspection period.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Selling Guide (Contract to Close Guide)
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Hero Card */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/20 rounded-3xl p-6 sm:p-8 space-y-3">
        <div className="flex items-center gap-2.5 text-emerald-400">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-xs font-bold uppercase tracking-wider">Under Contract Success Guide</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">The Escrow & Closing Roadmap</h2>
        <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
          Congratulations on going under contract! Here is everything you need to know about the 4 crucial phases between acceptance and receiving your funds on closing day.
        </p>
      </div>

      {/* 4 Phases Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#0e1726] border border-slate-800 rounded-3xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-sky-400">
            <span className="h-6 w-6 rounded-full bg-sky-500/20 border border-sky-500/40 flex items-center justify-center font-bold text-xs text-sky-400">1</span>
            <h4 className="font-bold text-sm text-white">Inspection Contingency (Days 1–10)</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            The buyer will hire an independent home inspector to review structural, electrical, plumbing, and HVAC systems. Following the inspection, the buyer agent will submit an Inspection Notice specifying any requested repairs or credits.
          </p>
        </div>

        <div className="bg-[#0e1726] border border-slate-800 rounded-3xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="h-6 w-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-xs text-emerald-400">2</span>
            <h4 className="font-bold text-sm text-white">Appraisal & Loan Underwriting (Days 10–25)</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            The lender orders an appraisal to verify fair market value. Once appraisal is received and underwriting conditions are cleared, the lender issues Clear to Close (CTC).
          </p>
        </div>

        <div className="bg-[#0e1726] border border-slate-800 rounded-3xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-amber-400">
            <span className="h-6 w-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-xs text-amber-400">3</span>
            <h4 className="font-bold text-sm text-white">Title Commitment & Wire Security</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Freedom Land Title examines legal titles, payoff statements, and property tax records. <strong>Wire Fraud Warning:</strong> Always verbally verify wiring instructions with title before sending or accepting wire transfers.
          </p>
        </div>

        <div className="bg-[#0e1726] border border-slate-800 rounded-3xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-rose-400">
            <span className="h-6 w-6 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center font-bold text-xs text-rose-400">4</span>
            <h4 className="font-bold text-sm text-white">Closing Day & Moving Handover</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Bring government-issued photo ID (driver’s license or passport). Have keys, garage door remotes, mailbox keys, and appliance manuals labeled on the kitchen counter for the buyer.
          </p>
        </div>
      </div>
    </div>
  );
};
