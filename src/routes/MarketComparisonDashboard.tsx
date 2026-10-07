import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../context/AuthContext';
import {
  MapPin,
  TrendingUp,
  BarChart3,
  Calendar,
  Filter,
  RefreshCw,
  Layers,
  Settings,
  HelpCircle,
  ExternalLink,
  DollarSign,
  Home,
  Clock,
  Percent,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Globe,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { LowSampleBadge } from '../components/analytics/LowSampleBadge';
import { DealDrillDownModal, DrillDownDeal } from '../components/analytics/DealDrillDownModal';
import { AdminTriageDrawer } from '../components/analytics/AdminTriageDrawer';
import { batchGeocodeTransactions } from '../utils/censusGeocoder';

const TERRITORY_COLORS: Record<string, string> = {
  Rolla: '#f59e0b',
  'St. Robert': '#10b981',
  Waynesville: '#06b6d4',
  'Lake of the Ozarks': '#8b5cf6',
  'Unmapped / Other': '#64748b',
};

export const MarketComparisonDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'metrics' | 'map'>('metrics');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // Filters
  const [dateRange, setDateRange] = useState<'12m' | 'ytd' | '2025' | '2024' | 'all'>('12m');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [selectedSide, setSelectedSide] = useState<'all' | 'buyer' | 'seller'>('all');
  const [agentsList, setAgentsList] = useState<any[]>([]);

  // Geocoding & Map state
  const [mapDeals, setMapDeals] = useState<any[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState<{ done: number; total: number; latest?: string } | null>(null);

  // Modals & Drawers
  const [triageOpen, setTriageOpen] = useState(false);
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownTitle, setDrillDownTitle] = useState('');
  const [drillDownSubtitle, setDrillDownSubtitle] = useState('');
  const [drillDownDeals, setDrillDownDeals] = useState<DrillDownDeal[]>([]);

  // Date boundaries
  const { startDate, endDate } = useMemo(() => {
    const today = new Date();
    const endStr = today.toISOString().split('T')[0];

    if (dateRange === '12m') {
      const d = new Date(today);
      d.setFullYear(d.getFullYear() - 1);
      return { startDate: d.toISOString().split('T')[0], endDate: endStr };
    }
    if (dateRange === 'ytd') {
      return { startDate: `${today.getFullYear()}-01-01`, endDate: endStr };
    }
    if (dateRange === '2025') {
      return { startDate: '2025-01-01', endDate: '2025-12-31' };
    }
    if (dateRange === '2024') {
      return { startDate: '2024-01-01', endDate: '2024-12-31' };
    }
    return { startDate: '2020-01-01', endDate: endStr };
  }, [dateRange]);

  useEffect(() => {
    async function loadAgents() {
      const { data: ags } = await (supabase.from('agents') as any)
        .select('id, name')
        .eq('active', true)
        .order('name');
      setAgentsList(ags || []);
    }
    loadAgents();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await (supabase.rpc as any)('get_market_comparison_analytics', {
        p_start_date: startDate,
        p_end_date: endDate,
        p_agent_id: selectedAgentId === 'all' ? null : selectedAgentId,
        p_side: selectedSide === 'all' ? null : selectedSide,
      });

      if (error) {
        console.warn('RPC get_market_comparison_analytics error:', error);
      } else {
        setData(res);
      }

      // Load Geocoded Deals for Map Tab
      const { data: geoDeals } = await (supabase.from('transactions') as any)
        .select(`
          id, property_address, city, state, zip, price, status, side, closed_date,
          latitude, longitude,
          listing_agent:listing_agent_id(name),
          selling_agent:selling_agent_id(name)
        `)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .in('status', ['Closed', 'closed', 'Pending', 'pending'])
        .limit(500);

      setMapDeals(geoDeals || []);
    } catch (err) {
      console.warn('Failed fetching market comparison analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [startDate, endDate, selectedAgentId, selectedSide]);

  // Run Batch Geocoding
  const handleStartGeocoding = async () => {
    setIsGeocoding(true);
    setGeocodeProgress({ done: 0, total: 30 });

    try {
      await batchGeocodeTransactions(30, (done, total, latest) => {
        setGeocodeProgress({ done, total, latest });
      });
      fetchAnalytics();
    } catch (err) {
      console.warn('Geocoding error:', err);
    } finally {
      setIsGeocoding(false);
      setGeocodeProgress(null);
    }
  };

  // Drilldown loader
  const handleDrilldown = async (territoryName: string) => {
    setDrillDownTitle(`${territoryName} Market Deals`);
    setDrillDownSubtitle(`Deals in ${territoryName} territory (${startDate} to ${endDate})`);
    setDrillDownOpen(true);

    try {
      const { data: rawDeals } = await (supabase.from('transactions') as any)
        .select(`
          id, property_address, city, state, zip, status, price, side,
          contract_date, closed_date, lender_name, loan_type,
          listing_agent:listing_agent_id(name),
          selling_agent:selling_agent_id(name)
        `)
        .eq('status', 'Closed')
        .not('closed_date', 'is', null);

      const mapped: DrillDownDeal[] = (rawDeals || []).map((t: any) => {
        const lead = t.side === 'seller' ? (t.listing_agent || t.selling_agent) : (t.selling_agent || t.listing_agent);
        return {
          id: t.id,
          property_address: t.property_address,
          city: t.city,
          state: t.state,
          zip: t.zip,
          status: 'Closed',
          price: t.price,
          side: t.side,
          agent_name: lead?.name || 'Lead Agent',
          lender_name: t.lender_name,
          loan_type: t.loan_type,
          contract_date: t.contract_date,
          closed_date: t.closed_date,
        };
      });

      // Filter by territory name match in city or known zips
      const filtered = mapped.filter((d) => {
        const c = (d.city || '').toLowerCase().trim();
        if (territoryName === 'Rolla') return c === 'rolla' || d.zip === '65401';
        if (territoryName === 'St. Robert') return c.includes('robert') || d.zip === '65584';
        if (territoryName === 'Waynesville') return c === 'waynesville' || d.zip === '65583';
        if (territoryName === 'Lake of the Ozarks') {
          return ['camdenton', 'osage beach', 'lake ozark', 'sunrise beach', 'eldon', 'linn creek'].includes(c);
        }
        return true;
      });

      setDrillDownDeals(filtered);
    } catch (err) {
      console.warn('Error fetching drilldown deals:', err);
    }
  };

  const territories = data?.territories || [];
  const yoyTrends = data?.yoy_trends || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#334155] pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold font-editorial text-white tracking-tight">
                  Territory Market Comparison
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  ADMIN ONLY
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5 font-mono-code">
                Rolla • St. Robert • Waynesville • Lake of the Ozarks
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs & Actions */}
        <div className="flex items-center gap-2.5">
          <div className="bg-slate-900/80 p-1 border border-slate-700 rounded-xl flex items-center text-xs">
            <button
              onClick={() => setActiveTab('metrics')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'metrics'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Side-by-Side</span>
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'map'
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>Interactive Map ({mapDeals.length})</span>
            </button>
          </div>

          <button
            onClick={() => setTriageOpen(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Settings className="h-4 w-4 text-amber-400" />
            <span>Map ZIPs / Cities</span>
          </button>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="p-4 bg-[#1e293b] border border-[#334155] rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wider">
            <Filter className="h-3.5 w-3.5 text-amber-400" />
            <span>Filters:</span>
          </div>

          <div className="flex items-center bg-slate-900/80 p-1 border border-slate-700 rounded-xl text-xs">
            {(['12m', 'ytd', '2025', '2024', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                  dateRange === range
                    ? 'bg-amber-500 text-slate-950 font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {range === '12m'
                  ? 'Trailing 12M'
                  : range === 'ytd'
                  ? 'YTD 2026'
                  : range === 'all'
                  ? 'All-Time'
                  : range}
              </button>
            ))}
          </div>

          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="px-3 py-1.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
          >
            <option value="all">All Agents</option>
            {agentsList.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <select
            value={selectedSide}
            onChange={(e) => setSelectedSide(e.target.value as any)}
            className="px-3 py-1.5 bg-slate-900/80 border border-slate-700 rounded-xl text-xs text-white focus:outline-none"
          >
            <option value="all">All Sides (Buyer + Seller)</option>
            <option value="buyer">Buyer Side Only</option>
            <option value="seller">Seller Side Only</option>
          </select>
        </div>

        {data?.unmapped_count > 0 && (
          <button
            onClick={() => setTriageOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold hover:bg-amber-500/25 transition-colors cursor-pointer"
          >
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            <span>{data.unmapped_count} Unmapped Territory Deals</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-24 text-center text-slate-400">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-amber-500 mb-3" />
          <p className="text-sm">Aggregating territory performance metrics from Supabase SQL...</p>
        </div>
      ) : activeTab === 'metrics' ? (
        /* ================= TAB 1: SIDE-BY-SIDE METRICS ================= */
        <div className="space-y-8">
          {/* Territory Side-by-Side Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {territories.map((t: any) => {
              const color = TERRITORY_COLORS[t.territory_name] || '#f59e0b';
              const totalUnits = Number(t.closed_units) || 0;
              const vaPct = totalUnits > 0 ? Math.round((t.va_count / totalUnits) * 100) : 0;
              const fhaPct = totalUnits > 0 ? Math.round((t.fha_count / totalUnits) * 100) : 0;
              const convPct = totalUnits > 0 ? Math.round((t.conventional_count / totalUnits) * 100) : 0;
              const cashPct = totalUnits > 0 ? Math.round((t.cash_count / totalUnits) * 100) : 0;

              return (
                <div
                  key={t.territory_name}
                  onClick={() => handleDrilldown(t.territory_name)}
                  className="p-6 bg-[#1e293b] border border-[#334155] rounded-3xl shadow-xl hover:border-amber-500/50 transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: color }}
                  />

                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <h3 className="font-bold font-editorial text-xl text-white">
                          {t.territory_name}
                        </h3>
                      </div>
                      {t.is_low_sample && <LowSampleBadge dealCount={t.closed_units} />}
                    </div>

                    {/* Volume & Units */}
                    <div>
                      <div className="text-2xl font-bold font-editorial text-white">
                        ${Number(t.total_volume).toLocaleString()}
                      </div>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        {t.closed_units} Closed Units ({t.buyer_units} Buyer • {t.seller_units} Seller)
                      </div>
                    </div>

                    {/* Pricing Stats */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                          Median Sale Price
                        </div>
                        <div className="font-bold text-slate-200 font-mono mt-0.5">
                          ${Number(t.median_sale_price).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                          Average Sale Price
                        </div>
                        <div className="font-bold text-slate-200 font-mono mt-0.5">
                          ${Number(t.average_sale_price).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Cycle Time & List-to-Sale */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                          Contract-to-Close
                        </div>
                        <div className="font-bold text-amber-300 font-mono mt-0.5">
                          {t.avg_days_to_close} Days
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                          List-to-Sale Ratio
                        </div>
                        <div className="font-bold text-emerald-400 font-mono mt-0.5">
                          {t.avg_list_to_sale_ratio}%
                        </div>
                      </div>
                    </div>

                    {/* Financing Mix Breakdown Bar */}
                    <div className="pt-2 border-t border-slate-800 space-y-1.5">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wider flex justify-between">
                        <span>Financing Mix</span>
                        <span className="font-mono text-slate-300">VA {vaPct}% • Cash {cashPct}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-900 rounded-full flex overflow-hidden">
                        <div style={{ width: `${vaPct}%` }} className="bg-sky-500" title={`VA: ${vaPct}%`} />
                        <div style={{ width: `${fhaPct}%` }} className="bg-indigo-500" title={`FHA: ${fhaPct}%`} />
                        <div style={{ width: `${convPct}%` }} className="bg-emerald-500" title={`Conv: ${convPct}%`} />
                        <div style={{ width: `${cashPct}%` }} className="bg-amber-500" title={`Cash: ${cashPct}%`} />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> VA ({t.va_count})
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Conv ({t.conventional_count})
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Cash ({t.cash_count})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom CTA */}
                  <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-amber-400 flex items-center justify-between group-hover:underline">
                    <span>Inspect underlying deals</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* YoY Volume and Units Comparison Chart */}
          <div className="p-6 bg-[#1e293b] border border-[#334155] rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold font-editorial text-white">
                  Year-over-Year Production Trends (2024–2026)
                </h3>
                <p className="text-xs text-slate-400">Closed units across our 4 core territories</p>
              </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yoyTrends} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="territory" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const row = payload[0].payload;
                      return (
                        <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl text-xs space-y-1 shadow-2xl">
                          <div className="font-bold text-white text-sm">
                            {row.territory} ({row.year})
                          </div>
                          <div className="text-emerald-400 font-mono">
                            Volume: ${Number(row.volume).toLocaleString()}
                          </div>
                          <div className="text-slate-300 font-mono">Units: {row.units} Closed</div>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Bar dataKey="units" fill="#10b981" name="Closed Units" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        /* ================= TAB 2: INTERACTIVE MAP ================= */
        <div className="p-6 bg-[#1e293b] border border-[#334155] rounded-3xl shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold font-editorial text-white">
                Geographic Territory Distribution
              </h3>
              <p className="text-xs text-slate-400">
                Addresses geocoded via US Census API • Pins color-coded by territory
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleStartGeocoding}
                disabled={isGeocoding}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                {isGeocoding ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>
                      Geocoding {geocodeProgress?.done}/{geocodeProgress?.total}...
                    </span>
                  </>
                ) : (
                  <>
                    <Globe className="h-3.5 w-3.5" />
                    <span>Run Census Geocoder</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Map Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            {Object.entries(TERRITORY_COLORS).map(([name, color]) => (
              <div key={name} className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-slate-300 font-medium">{name}</span>
              </div>
            ))}
          </div>

          {/* Leaflet Map Container */}
          <div className="h-[600px] w-full rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl relative z-10">
            <MapContainer
              center={[37.95, -92.15]}
              zoom={9}
              scrollWheelZoom={true}
              style={{ height: '100%', width: '100%', background: '#0f172a' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />

              {mapDeals.map((deal) => {
                const cityStr = (deal.city || '').toLowerCase();
                let terr = 'Unmapped / Other';
                if (cityStr.includes('rolla') || deal.zip === '65401') terr = 'Rolla';
                else if (cityStr.includes('robert') || deal.zip === '65584') terr = 'St. Robert';
                else if (cityStr.includes('waynesville') || deal.zip === '65583') terr = 'Waynesville';
                else if (['camdenton', 'osage beach', 'lake ozark', 'sunrise beach', 'eldon'].some((c) => cityStr.includes(c))) {
                  terr = 'Lake of the Ozarks';
                }

                const markerColor = TERRITORY_COLORS[terr] || '#f59e0b';
                const leadAgent = deal.side === 'seller' ? (deal.listing_agent?.name || deal.selling_agent?.name) : (deal.selling_agent?.name || deal.listing_agent?.name);

                return (
                  <CircleMarker
                    key={deal.id}
                    center={[deal.latitude, deal.longitude]}
                    radius={7}
                    pathOptions={{
                      fillColor: markerColor,
                      fillOpacity: 0.9,
                      color: '#ffffff',
                      weight: 1.5,
                    }}
                  >
                    <Popup>
                      <div className="p-2 space-y-1 text-slate-900 text-xs">
                        <div className="font-bold text-sm text-slate-950">{deal.property_address}</div>
                        <div className="text-slate-600">
                          {deal.city}, {deal.state} {deal.zip}
                        </div>
                        <div className="font-mono font-bold text-amber-700">
                          {deal.price ? `$${Number(deal.price).toLocaleString()}` : '—'}
                        </div>
                        <div className="text-[11px] text-slate-700">
                          Territory: <strong>{terr}</strong>
                        </div>
                        <div className="text-[11px] text-slate-700">
                          Agent: <strong>{leadAgent || 'Lead Agent'}</strong>
                        </div>
                        <div className="text-[10px] text-slate-500 pt-1">
                          Status: {deal.status} • {deal.closed_date ? `Closed: ${deal.closed_date}` : ''}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </div>
      )}

      {/* Admin Triage Drawer */}
      <AdminTriageDrawer
        isOpen={triageOpen}
        onClose={() => setTriageOpen(false)}
        initialTab="territories"
        onDataUpdated={fetchAnalytics}
      />

      {/* Deal Drill Down Modal */}
      <DealDrillDownModal
        isOpen={drillDownOpen}
        onClose={() => setDrillDownOpen(false)}
        title={drillDownTitle}
        subtitle={drillDownSubtitle}
        deals={drillDownDeals}
      />
    </div>
  );
};
