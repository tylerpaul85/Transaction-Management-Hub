import React, { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import {
  X,
  AlertTriangle,
  Building,
  MapPin,
  DollarSign,
  Plus,
  Check,
  CheckCircle2,
  Trash2,
  Loader2,
  Tag,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';

interface AdminTriageDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'reasons' | 'lenders' | 'territories' | 'bands';
  onDataUpdated?: () => void;
}

export const AdminTriageDrawer: React.FC<AdminTriageDrawerProps> = ({
  isOpen,
  onClose,
  initialTab = 'reasons',
  onDataUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'reasons' | 'lenders' | 'territories' | 'bands'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Data states
  const [cancellationReasons, setCancellationReasons] = useState<any[]>([]);
  const [unassignedCancelledDeals, setUnassignedCancelledDeals] = useState<any[]>([]);
  const [lenderAliases, setLenderAliases] = useState<any[]>([]);
  const [rawLendersInDeals, setRawLendersInDeals] = useState<string[]>([]);
  const [territoryMappings, setTerritoryMappings] = useState<any[]>([]);
  const [unmappedTerritoryDeals, setUnmappedTerritoryDeals] = useState<any[]>([]);
  const [priceBands, setPriceBands] = useState<any[]>([]);

  // New item inputs
  const [newReason, setNewReason] = useState('');
  const [newReasonCategory, setNewReasonCategory] = useState('General');
  const [newTerritoryZip, setNewTerritoryZip] = useState('');
  const [newTerritoryCity, setNewTerritoryCity] = useState('');
  const [newTerritoryTarget, setNewTerritoryTarget] = useState('Lake of the Ozarks');

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (isOpen) {
      loadAllData();
    }
  }, [isOpen, activeTab]);

  const showToast = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Cancellation Reasons
      const { data: reasons } = await (supabase.from('cancellation_reasons') as any)
        .select('*')
        .order('display_order', { ascending: true });
      setCancellationReasons(reasons || []);

      // Cancelled deals missing a reason
      const { data: unassignedDeals } = await (supabase.from('transactions') as any)
        .select('id, property_address, city, price, agent_name:listing_agent_id(name), contract_date')
        .eq('status', 'cancelled')
        .is('cancellation_reason_id', null)
        .limit(50);
      setUnassignedCancelledDeals(unassignedDeals || []);

      // 2. Lender Aliases & Raw Lenders
      const { data: aliases } = await (supabase.from('lender_aliases') as any)
        .select('*')
        .order('canonical_name', { ascending: true });
      setLenderAliases(aliases || []);

      const { data: lenderTx } = await (supabase.from('transactions') as any)
        .select('lender_name')
        .not('lender_name', 'is', null)
        .limit(200);
      const uniqueRawLenders = Array.from(
        new Set((lenderTx || []).map((t: any) => (t.lender_name || '').trim()))
      ).filter(Boolean) as string[];
      setRawLendersInDeals(uniqueRawLenders);

      // 3. Territory Mappings & Unmapped Deals
      const { data: terrs } = await (supabase.from('territory_mappings') as any)
        .select('*')
        .order('territory_name', { ascending: true });
      setTerritoryMappings(terrs || []);

      // Unmapped deals (checking city and zip against territory mappings)
      const { data: allDeals } = await (supabase.from('transactions') as any)
        .select('id, property_address, city, zip, price, status')
        .in('status', ['Closed', 'closed', 'Pending', 'pending'])
        .limit(300);

      const knownZips = new Set((terrs || []).filter((t: any) => t.zip).map((t: any) => t.zip.trim()));
      const knownCities = new Set((terrs || []).filter((t: any) => t.city).map((t: any) => t.city.toLowerCase().trim()));

      const unmapped = (allDeals || []).filter((d: any) => {
        const hasZip = d.zip && knownZips.has(d.zip.trim());
        const hasCity = d.city && knownCities.has(d.city.toLowerCase().trim());
        return !hasZip && !hasCity;
      });
      setUnmappedTerritoryDeals(unmapped.slice(0, 50));

      // 4. Price Bands
      const { data: bands } = await (supabase.from('price_bands') as any)
        .select('*')
        .order('display_order', { ascending: true });
      setPriceBands(bands || []);
    } catch (err) {
      console.warn('Error loading admin triage data:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- Actions ---

  const handleAssignReason = async (dealId: string, reasonId: string) => {
    try {
      await (supabase.from('transactions') as any)
        .update({ cancellation_reason_id: reasonId, updated_at: new Date().toISOString() })
        .eq('id', dealId);

      setUnassignedCancelledDeals((prev) => prev.filter((d) => d.id !== dealId));
      showToast('Cancellation reason assigned.');
      if (onDataUpdated) onDataUpdated();
    } catch {
      showToast('Failed to assign reason.');
    }
  };

  const handleAddNewReason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReason.trim()) return;

    try {
      const { data, error } = await (supabase.from('cancellation_reasons') as any)
        .insert({
          reason: newReason.trim(),
          category: newReasonCategory,
          display_order: cancellationReasons.length + 1,
        })
        .select()
        .single();

      if (!error && data) {
        setCancellationReasons((prev) => [...prev, data]);
        setNewReason('');
        showToast('New cancellation reason added.');
        if (onDataUpdated) onDataUpdated();
      }
    } catch {
      showToast('Error adding reason.');
    }
  };

  const handleSaveLenderAlias = async (rawName: string, canonicalName: string, isCash: boolean = false) => {
    try {
      await (supabase.from('lender_aliases') as any).upsert(
        {
          raw_name: rawName.trim(),
          canonical_name: canonicalName.trim(),
          is_cash_or_none: isCash,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'raw_name' }
      );

      showToast(`Mapped "${rawName}" -> "${canonicalName}"`);
      loadAllData();
      if (onDataUpdated) onDataUpdated();
    } catch {
      showToast('Error saving lender alias.');
    }
  };

  const handleAddTerritoryMapping = async (territory: string, zip?: string, city?: string) => {
    if (!zip && !city) return;
    try {
      await (supabase.from('territory_mappings') as any).insert({
        territory_name: territory,
        zip: zip?.trim() || null,
        city: city?.trim() || null,
      });

      showToast(`Added mapping for ${territory} (${zip || city})`);
      setNewTerritoryZip('');
      setNewTerritoryCity('');
      loadAllData();
      if (onDataUpdated) onDataUpdated();
    } catch {
      showToast('Error saving territory mapping.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl h-full bg-[#1e293b] border-l border-[#334155] shadow-2xl flex flex-col text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#334155] bg-[#131826]">
          <div>
            <h2 className="text-xl font-bold font-editorial text-white">Admin Data Triage & Mapping</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Manage cancellation reasons, normalize lenders, and map territory boundaries
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Toast */}
        {actionSuccess && (
          <div className="bg-emerald-500/20 text-emerald-300 border-b border-emerald-500/30 px-6 py-2.5 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center px-6 border-b border-[#334155] bg-[#172033] gap-2 overflow-x-auto py-2">
          <button
            onClick={() => setActiveTab('reasons')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'reasons'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            <span>Cancellation Reasons ({unassignedCancelledDeals.length} Unset)</span>
          </button>

          <button
            onClick={() => setActiveTab('lenders')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'lenders'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Building className="h-3.5 w-3.5" />
            <span>Lender Aliases ({lenderAliases.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('territories')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'territories'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>Territory Mappings ({unmappedTerritoryDeals.length} Unmapped)</span>
          </button>

          <button
            onClick={() => setActiveTab('bands')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'bands'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <DollarSign className="h-3.5 w-3.5" />
            <span>Price Bands ({priceBands.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-500 mb-2" />
              <p className="text-xs">Loading triage data...</p>
            </div>
          ) : activeTab === 'reasons' ? (
            /* ================= TAB 1: CANCELLATION REASONS ================= */
            <div className="space-y-6">
              {/* Add New Reason Form */}
              <div className="p-4 bg-slate-900/60 border border-slate-700/80 rounded-2xl space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  + Add Custom Cancellation Reason
                </h3>
                <form onSubmit={handleAddNewReason} className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    placeholder="e.g. Foundation / Structural Failure"
                    className="flex-1 min-w-[200px] px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <select
                    value={newReasonCategory}
                    onChange={(e) => setNewReasonCategory(e.target.value)}
                    className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
                  >
                    <option value="Inspection">Inspection</option>
                    <option value="Financing">Financing</option>
                    <option value="Appraisal">Appraisal</option>
                    <option value="Buyer Side">Buyer Side</option>
                    <option value="Seller Side">Seller Side</option>
                    <option value="Title / Legal">Title / Legal</option>
                    <option value="Contingency">Contingency</option>
                    <option value="General">General / Other</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Add Reason
                  </button>
                </form>
              </div>

              {/* Deals Missing Reason Triage Queue */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Cancelled Deals Missing Reason ({unassignedCancelledDeals.length})
                  </h3>
                  <button
                    onClick={loadAllData}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </button>
                </div>

                {unassignedCancelledDeals.length === 0 ? (
                  <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-400 text-xs">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                    All cancelled deals currently have assigned reasons!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unassignedCancelledDeals.map((deal) => (
                      <div
                        key={deal.id}
                        className="p-3 bg-slate-900/60 border border-slate-700/60 rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">
                            {deal.property_address || 'Address Pending'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {deal.city} • {deal.price ? `$${Number(deal.price).toLocaleString()}` : '—'}
                          </div>
                        </div>

                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) handleAssignReason(deal.id, e.target.value);
                          }}
                          className="px-2.5 py-1.5 bg-slate-950 border border-amber-500/40 rounded-xl text-xs text-amber-300 font-medium focus:outline-none cursor-pointer"
                        >
                          <option value="" disabled>
                            Select Reason...
                          </option>
                          {cancellationReasons.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.reason}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'lenders' ? (
            /* ================= TAB 2: LENDER ALIASES ================= */
            <div className="space-y-6">
              <div className="text-xs text-slate-400 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
                Lenders often get typed with slight spelling variations. Map raw lender strings to a
                single clean canonical lender name so your fall-through stats stay accurate.
              </div>

              {/* Raw Lenders from Deals List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Unmapped / Detected Lenders in Deals
                </h3>

                <div className="space-y-2">
                  {rawLendersInDeals
                    .filter((raw) => !lenderAliases.some((a) => a.raw_name.toLowerCase() === raw.toLowerCase()))
                    .map((rawLender) => (
                      <div
                        key={rawLender}
                        className="p-3 bg-slate-900/60 border border-slate-700/60 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-semibold text-amber-300 font-mono">{rawLender}</span>

                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            defaultValue={rawLender}
                            placeholder="Canonical Name"
                            id={`canon-${rawLender}`}
                            className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white"
                          />
                          <button
                            onClick={() => {
                              const el = document.getElementById(`canon-${rawLender}`) as HTMLInputElement;
                              handleSaveLenderAlias(rawLender, el?.value || rawLender);
                            }}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => handleSaveLenderAlias(rawLender, 'Cash (No Lender)', true)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                          >
                            Mark Cash
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Existing Aliases Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Active Aliases ({lenderAliases.length})
                </h3>
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-900/40">
                  {lenderAliases.map((a) => (
                    <div key={a.id} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-400 font-mono">{a.raw_name}</span>
                        <span className="mx-2 text-slate-600">→</span>
                        <span className="font-semibold text-emerald-400">{a.canonical_name}</span>
                      </div>
                      {a.is_cash_or_none && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                          Cash/None
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeTab === 'territories' ? (
            /* ================= TAB 3: TERRITORY MAPPINGS ================= */
            <div className="space-y-6">
              {/* Add Mapping Form */}
              <div className="p-4 bg-slate-900/60 border border-slate-700/80 rounded-2xl space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  + Add ZIP / City Territory Rule
                </h3>
                <div className="flex flex-wrap gap-2 text-xs">
                  <input
                    type="text"
                    value={newTerritoryZip}
                    onChange={(e) => setNewTerritoryZip(e.target.value)}
                    placeholder="ZIP (e.g. 65020)"
                    className="w-28 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={newTerritoryCity}
                    onChange={(e) => setNewTerritoryCity(e.target.value)}
                    placeholder="City (e.g. Camdenton)"
                    className="flex-1 min-w-[140px] px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none"
                  />
                  <select
                    value={newTerritoryTarget}
                    onChange={(e) => setNewTerritoryTarget(e.target.value)}
                    className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none"
                  >
                    <option value="Rolla">Rolla</option>
                    <option value="St. Robert">St. Robert</option>
                    <option value="Waynesville">Waynesville</option>
                    <option value="Lake of the Ozarks">Lake of the Ozarks</option>
                  </select>
                  <button
                    onClick={() =>
                      handleAddTerritoryMapping(newTerritoryTarget, newTerritoryZip, newTerritoryCity)
                    }
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Save Rule
                  </button>
                </div>
              </div>

              {/* Unmapped Deals Quick Actions */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Deals with Unmapped Cities/ZIPs ({unmappedTerritoryDeals.length})
                </h3>

                {unmappedTerritoryDeals.length === 0 ? (
                  <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-400 text-xs">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                    All active deals are mapped to our 4 territories!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unmappedTerritoryDeals.map((deal) => (
                      <div
                        key={deal.id}
                        className="p-3 bg-slate-900/60 border border-slate-700/60 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-white">{deal.property_address}</div>
                          <div className="text-slate-400 text-[11px]">
                            City: <strong className="text-amber-300">{deal.city || 'EMPTY'}</strong> • ZIP:{' '}
                            <strong className="text-amber-300">{deal.zip || 'EMPTY'}</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {['Rolla', 'St. Robert', 'Waynesville', 'Lake of the Ozarks'].map((terr) => (
                            <button
                              key={terr}
                              onClick={() => handleAddTerritoryMapping(terr, deal.zip, deal.city)}
                              className="px-2 py-1 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 rounded text-[11px] font-medium transition-colors cursor-pointer"
                            >
                              + {terr.slice(0, 7)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ================= TAB 4: PRICE BANDS ================= */
            <div className="space-y-4">
              <div className="text-xs text-slate-400 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
                Price bands segment deals into volume tiers for fall-through rate analysis.
              </div>

              <div className="divide-y divide-slate-800 border border-slate-800 rounded-2xl bg-slate-900/60 overflow-hidden">
                {priceBands.map((pb) => (
                  <div key={pb.id} className="p-3.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-white text-sm">{pb.label}</div>
                      <div className="text-slate-400 font-mono text-[11px]">
                        ${Number(pb.min_price).toLocaleString()} →{' '}
                        {pb.max_price ? `$${Number(pb.max_price).toLocaleString()}` : 'No Limit'}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Tier #{pb.display_order}
                    </span>
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
