import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../context/AuthContext';
import { getStoredAvatar } from '../utils/avatarStorage';
import {
  BarChart3,
  TrendingUp,
  Building,
  DollarSign,
  Calendar,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  ExternalLink,
  MapPin,
  User,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpDown,
  LayoutGrid,
  Table as TableIcon,
  X,
  Copy,
  Check,
  Tag,
  Share2,
  ChevronRight,
  Sparkles,
  Layers,
  Award,
} from 'lucide-react';

export interface ActiveListingRecord {
  id: string;
  sisu_transaction_id: string | null;
  property_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  price: number | null;
  list_price: number | null;
  status: string;
  side: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  contract_date: string | null;
  listing_date: string | null;
  created_at: string;
  updated_at: string;
  days_on_market: number | null;
  custom_fields: any;
  listing_agent_id: string | null;
  listing_agent?: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    role: string | null;
    level?: number | null;
  } | null;
}

export const ReportsView: React.FC = () => {
  const { currentUser, isOps, isAdmin } = useAuth();

  // Active sub-tab: 'active_listings' | 'charts_analytics' | 'market_breakdown'
  const [activeReportTab, setActiveReportTab] = useState<'active_listings' | 'charts_analytics' | 'market_breakdown'>('active_listings');

  // Listings data & loading
  const [listings, setListings] = useState<ActiveListingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('Live Supabase Feed');

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState('All');
  const [selectedCityFilter, setSelectedCityFilter] = useState('All');
  const [selectedPriceFilter, setSelectedPriceFilter] = useState('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('Live Listing');
  const [sortBy, setSortBy] = useState<'price_desc' | 'price_asc' | 'date_desc' | 'date_asc' | 'address_asc' | 'agent_asc'>('price_desc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Detail Modal State
  const [selectedListing, setSelectedListing] = useState<ActiveListingRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load listings from Supabase
  const loadActiveListings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          listing_agent:agents!transactions_listing_agent_id_fkey(
            id, name, email, phone, avatar_url, role, level
          )
        `)
        .or('status.ilike.%listing%,status.eq.Live Listing,status.eq.Signed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setListings(data as unknown as ActiveListingRecord[]);
        setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (err: any) {
      console.error('Error loading active listings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActiveListings();
  }, []);

  // Trigger Sisu Reconciliation Sync
  const handleSyncFromSisu = async () => {
    setIsSyncing(true);
    setSyncMessage('Requesting live listing updates from Sisu API...');
    try {
      const { data, error } = await supabase.functions.invoke('sisu-nightly-reconciliation');
      if (error) throw error;
      setSyncMessage(data?.message || 'Successfully reconciled active listings with Sisu!');
      await loadActiveListings();
    } catch (err: any) {
      console.error('Error syncing with Sisu:', err);
      setSyncMessage(`Sync error: ${err.message || 'Could not reach Sisu API'}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  // Unique agents & cities for filter dropdowns
  const availableAgents = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((l) => {
      if (l.listing_agent?.name) set.add(l.listing_agent.name);
    });
    return Array.from(set).sort();
  }, [listings]);

  const availableCities = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((l) => {
      if (l.city) set.add(l.city);
    });
    return Array.from(set).sort();
  }, [listings]);

  // Filtered & Sorted listings
  const filteredListings = useMemo(() => {
    let list = listings.filter((item) => {
      // Status filter
      if (selectedStatusFilter !== 'All') {
        const itemStatus = (item.status || '').toLowerCase();
        if (selectedStatusFilter === 'Live Listing') {
          if (!itemStatus.includes('live') && itemStatus !== 'live listing' && itemStatus !== 'active') return false;
        } else if (selectedStatusFilter === 'Signed') {
          if (!itemStatus.includes('signed')) return false;
        }
      }

      // Agent filter
      if (selectedAgentFilter !== 'All') {
        if (!item.listing_agent?.name || item.listing_agent.name !== selectedAgentFilter) {
          return false;
        }
      }

      // City filter
      if (selectedCityFilter !== 'All') {
        if (!item.city || item.city.toLowerCase() !== selectedCityFilter.toLowerCase()) {
          return false;
        }
      }

      // Price Filter
      const price = item.price || item.list_price || 0;
      if (selectedPriceFilter === 'under_150k' && price >= 150000) return false;
      if (selectedPriceFilter === '150k_300k' && (price < 150000 || price > 300000)) return false;
      if (selectedPriceFilter === '300k_500k' && (price < 300000 || price > 500000)) return false;
      if (selectedPriceFilter === '500k_plus' && price < 500000) return false;

      // Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const addressMatch = (item.property_address || '').toLowerCase().includes(q);
        const clientMatch = (item.client_name || '').toLowerCase().includes(q);
        const cityMatch = (item.city || '').toLowerCase().includes(q);
        const agentMatch = (item.listing_agent?.name || '').toLowerCase().includes(q);
        const sisuMatch = (item.sisu_transaction_id || '').toLowerCase().includes(q);
        if (!addressMatch && !clientMatch && !cityMatch && !agentMatch && !sisuMatch) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    list.sort((a, b) => {
      const priceA = a.price || a.list_price || 0;
      const priceB = b.price || b.list_price || 0;
      const dateA = new Date(a.created_at || a.listing_date || 0).getTime();
      const dateB = new Date(b.created_at || b.listing_date || 0).getTime();

      switch (sortBy) {
        case 'price_desc': return priceB - priceA;
        case 'price_asc': return priceA - priceB;
        case 'date_desc': return dateB - dateA;
        case 'date_asc': return dateA - dateB;
        case 'address_asc': return (a.property_address || '').localeCompare(b.property_address || '');
        case 'agent_asc': return (a.listing_agent?.name || '').localeCompare(b.listing_agent?.name || '');
        default: return 0;
      }
    });

    return list;
  }, [listings, selectedStatusFilter, selectedAgentFilter, selectedCityFilter, selectedPriceFilter, searchQuery, sortBy]);

  // Key Performance Indicators (KPIs)
  const kpis = useMemo(() => {
    const liveItems = listings.filter((l) => (l.status || '').toLowerCase().includes('live') || (l.status || '').toLowerCase().includes('listing'));
    const totalCount = liveItems.length;

    let totalVolume = 0;
    let pricedCount = 0;
    const cityCounts: Record<string, number> = {};
    const agentCounts: Record<string, { count: number; volume: number; agentName: string }> = {};

    liveItems.forEach((l) => {
      const price = l.price || l.list_price || 0;
      if (price > 0) {
        totalVolume += price;
        pricedCount++;
      }
      if (l.city) {
        cityCounts[l.city] = (cityCounts[l.city] || 0) + 1;
      }
      if (l.listing_agent?.name) {
        const agName = l.listing_agent.name;
        if (!agentCounts[agName]) {
          agentCounts[agName] = { count: 0, volume: 0, agentName: agName };
        }
        agentCounts[agName].count++;
        agentCounts[agName].volume += price;
      }
    });

    const avgPrice = pricedCount > 0 ? Math.round(totalVolume / pricedCount) : 0;

    // Top City
    let topCity = 'N/A';
    let maxCityCount = 0;
    Object.entries(cityCounts).forEach(([c, cnt]) => {
      if (cnt > maxCityCount) {
        maxCityCount = cnt;
        topCity = c;
      }
    });

    // Top Listing Agent
    let topAgentName = 'N/A';
    let maxAgentCount = 0;
    Object.values(agentCounts).forEach((a) => {
      if (a.count > maxAgentCount) {
        maxAgentCount = a.count;
        topAgentName = a.agentName;
      }
    });

    return {
      totalCount,
      totalVolume,
      avgPrice,
      topCity,
      topCityCount: maxCityCount,
      activeAgentsCount: Object.keys(agentCounts).length,
      topAgentName,
      topAgentCount: maxAgentCount,
    };
  }, [listings]);

  // Monthly Breakdown Analytics (for graphs)
  const monthlyTrends = useMemo(() => {
    // Group listings by month added
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();

    const dataByMonth: Record<number, { count: number; volume: number; name: string }> = {};
    for (let i = 0; i < 12; i++) {
      dataByMonth[i] = { count: 0, volume: 0, name: months[i] };
    }

    listings.forEach((l) => {
      const d = new Date(l.created_at || l.listing_date || '');
      if (!isNaN(d.getTime())) {
        const m = d.getMonth();
        const p = l.price || l.list_price || 0;
        dataByMonth[m].count++;
        dataByMonth[m].volume += p;
      }
    });

    const list = Object.values(dataByMonth);
    const maxCount = Math.max(...list.map((m) => m.count), 1);
    const maxVolume = Math.max(...list.map((m) => m.volume), 1);

    return { list, maxCount, maxVolume };
  }, [listings]);

  // Price Tier Distribution
  const priceTiers = useMemo(() => {
    let t1 = 0; // < 150k
    let t2 = 0; // 150k - 250k
    let t3 = 0; // 250k - 350k
    let t4 = 0; // 350k - 500k
    let t5 = 0; // 500k+
    let totalPriced = 0;

    listings.forEach((l) => {
      const p = l.price || l.list_price || 0;
      if (p > 0) {
        totalPriced++;
        if (p < 150000) t1++;
        else if (p < 250000) t2++;
        else if (p < 350000) t3++;
        else if (p < 500000) t4++;
        else t5++;
      }
    });

    return [
      { label: 'Under $150k', count: t1, pct: totalPriced ? Math.round((t1 / totalPriced) * 100) : 0, color: 'bg-sky-400' },
      { label: '$150k – $250k', count: t2, pct: totalPriced ? Math.round((t2 / totalPriced) * 100) : 0, color: 'bg-emerald-400' },
      { label: '$250k – $350k', count: t3, pct: totalPriced ? Math.round((t3 / totalPriced) * 100) : 0, color: 'bg-amber-400' },
      { label: '$350k – $500k', count: t4, pct: totalPriced ? Math.round((t4 / totalPriced) * 100) : 0, color: 'bg-purple-400' },
      { label: '$500k+', count: t5, pct: totalPriced ? Math.round((t5 / totalPriced) * 100) : 0, color: 'bg-rose-400' },
    ];
  }, [listings]);

  // City Distribution (Top 6 cities)
  const cityAnalytics = useMemo(() => {
    const counts: Record<string, { count: number; volume: number }> = {};
    listings.forEach((l) => {
      const c = l.city || 'Other';
      const p = l.price || l.list_price || 0;
      if (!counts[c]) counts[c] = { count: 0, volume: 0 };
      counts[c].count++;
      counts[c].volume += p;
    });

    const sorted = Object.entries(counts)
      .map(([city, data]) => ({ city, ...data }))
      .sort((a, b) => b.count - a.count);

    const maxCount = Math.max(...sorted.map((s) => s.count), 1);
    return { list: sorted.slice(0, 8), maxCount };
  }, [listings]);

  // Agent Leaderboard
  const agentLeaderboard = useMemo(() => {
    const map: Record<string, { name: string; email: string; avatar: string | null; count: number; volume: number; level: number }> = {};
    listings.forEach((l) => {
      if (l.listing_agent?.name) {
        const id = l.listing_agent.id;
        const name = l.listing_agent.name;
        const p = l.price || l.list_price || 0;
        if (!map[id]) {
          map[id] = {
            name,
            email: l.listing_agent.email,
            avatar: l.listing_agent.avatar_url || getStoredAvatar(id, l.listing_agent.email),
            count: 0,
            volume: 0,
            level: Number(l.listing_agent.level) || 1,
          };
        }
        map[id].count++;
        map[id].volume += p;
      }
    });

    return Object.values(map).sort((a, b) => b.count - a.count || b.volume - a.volume);
  }, [listings]);

  // Currency Formatter
  const formatMoney = (val?: number | null) => {
    if (!val || val === 0) return 'Price TBD';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Export to CSV handler
  const handleExportCsv = () => {
    if (filteredListings.length === 0) return;

    const headers = ['Sisu ID', 'Property Address', 'City', 'State', 'Zip', 'Status', 'Price', 'Listing Agent', 'Client Name', 'Client Phone', 'Date Added'];
    const rows = filteredListings.map((l) => [
      l.sisu_transaction_id || '',
      `"${(l.property_address || '').replace(/"/g, '""')}"`,
      `"${l.city || ''}"`,
      l.state || '',
      l.zip || '',
      l.status || '',
      l.price || l.list_price || '',
      `"${(l.listing_agent?.name || '').replace(/"/g, '""')}"`,
      `"${(l.client_name || '').replace(/"/g, '""')}"`,
      `"${l.client_phone || ''}"`,
      l.created_at || '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `msreg_active_listings_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Header Banner */}
      <div className="bg-[#111726] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <BarChart3 className="h-5 w-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Team Reports & Active Listings
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase">
                Sisu Cloud Sync
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Live inventory tracking pulling directly from Sisu. View active listings, geographical distributions, agent production rankings, and monthly volume trends.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSyncFromSisu}
              disabled={isSyncing}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#162035] hover:bg-[#1a2640] text-slate-200 border border-white/10 hover:border-amber-500/40 transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              title="Query Sisu API for updated active listings"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-amber-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync with Sisu'}</span>
            </button>

            <button
              onClick={handleExportCsv}
              disabled={filteredListings.length === 0}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50 font-semibold"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV ({filteredListings.length})</span>
            </button>
          </div>
        </div>

        {syncMessage && (
          <div className="mt-4 p-3 rounded-xl bg-sky-950/60 border border-sky-500/30 text-sky-200 text-xs flex items-center gap-2 animate-in fade-in">
            <Sparkles className="h-4 w-4 text-sky-400 shrink-0" />
            <span>{syncMessage}</span>
          </div>
        )}

        {/* Sub-Tabs Selector */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/10">
          <button
            onClick={() => setActiveReportTab('active_listings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeReportTab === 'active_listings'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Building className="h-4 w-4" />
            <span>Active Listings Directory</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/40 font-mono text-slate-300 border border-white/10">
              {kpis.totalCount}
            </span>
          </button>

          <button
            onClick={() => setActiveReportTab('charts_analytics')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeReportTab === 'charts_analytics'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Monthly Trends & Brackets</span>
          </button>

          <button
            onClick={() => setActiveReportTab('market_breakdown')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeReportTab === 'market_breakdown'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <MapPin className="h-4 w-4" />
            <span>Market & City Breakdown</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 sm:p-5 bg-[#111726] border border-white/10 rounded-2xl space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Active Listings</span>
            <Building className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white tabular-nums">{kpis.totalCount}</p>
          <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live on MLS & Sisu</span>
          </p>
        </div>

        <div className="p-4 sm:p-5 bg-[#111726] border border-white/10 rounded-2xl space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Listing Volume</span>
            <DollarSign className="h-4 w-4 text-amber-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-400 tabular-nums">
            {formatMoney(kpis.totalVolume)}
          </p>
          <p className="text-[11px] text-slate-400">Total inventory value</p>
        </div>

        <div className="p-4 sm:p-5 bg-[#111726] border border-white/10 rounded-2xl space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Average List Price</span>
            <TrendingUp className="h-4 w-4 text-sky-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white tabular-nums">
            {formatMoney(kpis.avgPrice)}
          </p>
          <p className="text-[11px] text-slate-400">Per active listing</p>
        </div>

        <div className="p-4 sm:p-5 bg-[#111726] border border-white/10 rounded-2xl space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Top Market & Agents</span>
            <Award className="h-4 w-4 text-purple-400" />
          </div>
          <p className="text-lg sm:text-xl font-black text-white truncate">{kpis.topCity}</p>
          <p className="text-[11px] text-slate-400">
            {kpis.activeAgentsCount} listing agents active
          </p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          TAB 1: Active Listings Directory
         ───────────────────────────────────────────────────────────────── */}
      {activeReportTab === 'active_listings' && (
        <div className="space-y-4">
          {/* Filter & Search Toolbar */}
          <div className="bg-[#111726] border border-white/10 rounded-2xl p-4 shadow-md space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search Box */}
              <div className="lg:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search address, client, city, agent..."
                  className="w-full pl-9 pr-3 py-2 bg-[#0d121f] border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition-all"
                />
              </div>

              {/* Agent Filter */}
              <div>
                <select
                  value={selectedAgentFilter}
                  onChange={(e) => setSelectedAgentFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0d121f] border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer font-medium"
                >
                  <option value="All">All Listing Agents ({availableAgents.length})</option>
                  {availableAgents.map((ag) => (
                    <option key={ag} value={ag}>{ag}</option>
                  ))}
                </select>
              </div>

              {/* City Filter */}
              <div>
                <select
                  value={selectedCityFilter}
                  onChange={(e) => setSelectedCityFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0d121f] border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer font-medium"
                >
                  <option value="All">All Cities ({availableCities.length})</option>
                  {availableCities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              {/* Price Tier Filter */}
              <div>
                <select
                  value={selectedPriceFilter}
                  onChange={(e) => setSelectedPriceFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0d121f] border border-white/10 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer font-medium"
                >
                  <option value="All">All Price Ranges</option>
                  <option value="under_150k">Under $150,000</option>
                  <option value="150k_300k">$150,000 – $300,000</option>
                  <option value="300k_500k">$300,000 – $500,000</option>
                  <option value="500k_plus">$500,000+</option>
                </select>
              </div>
            </div>

            {/* Bottom Row Controls */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-semibold">Status:</span>
                {['Live Listing', 'Signed', 'All'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setSelectedStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedStatusFilter === st
                        ? 'bg-amber-400 text-slate-950 shadow-sm'
                        : 'bg-[#0d121f] text-slate-400 hover:text-white border border-white/5'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                {/* Sort Selector */}
                <div className="flex items-center gap-1.5 bg-[#0d121f] px-2.5 py-1 rounded-xl border border-white/10 text-xs">
                  <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-transparent text-slate-300 font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="price_desc" className="bg-[#111726]">Price (High to Low)</option>
                    <option value="price_asc" className="bg-[#111726]">Price (Low to High)</option>
                    <option value="date_desc" className="bg-[#111726]">Newest Added</option>
                    <option value="date_asc" className="bg-[#111726]">Oldest Added</option>
                    <option value="address_asc" className="bg-[#111726]">Address (A-Z)</option>
                    <option value="agent_asc" className="bg-[#111726]">Agent (A-Z)</option>
                  </select>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center bg-[#0d121f] rounded-xl border border-white/10 p-0.5">
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === 'table' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Table View"
                  >
                    <TableIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === 'cards' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                    title="Cards View"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Listings List (Table vs Cards) */}
          {loading ? (
            <div className="p-12 text-center bg-[#111726] border border-white/10 rounded-2xl">
              <RefreshCw className="h-6 w-6 animate-spin text-amber-400 mx-auto mb-2" />
              <p className="text-xs text-slate-400 font-medium">Loading active listings from Sisu database...</p>
            </div>
          ) : filteredListings.length === 0 ? (
            <div className="p-12 text-center bg-[#111726] border border-white/10 rounded-2xl space-y-2">
              <Building className="h-8 w-8 text-slate-500 mx-auto" />
              <p className="text-sm font-bold text-slate-200">No active listings match your current filters.</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedAgentFilter('All');
                  setSelectedCityFilter('All');
                  setSelectedPriceFilter('All');
                  setSelectedStatusFilter('All');
                }}
                className="text-xs font-bold text-amber-400 hover:underline cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : viewMode === 'table' ? (
            /* Table View */
            <div className="bg-[#111726] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#0d121f] text-slate-400 uppercase font-bold tracking-wider border-b border-white/10 text-[11px]">
                      <th className="py-3.5 px-4 sm:px-6">Property Address</th>
                      <th className="py-3.5 px-4">Market / City</th>
                      <th className="py-3.5 px-4 font-right">List Price</th>
                      <th className="py-3.5 px-4">Listing Agent</th>
                      <th className="py-3.5 px-4">Seller Client</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredListings.map((listing) => {
                      const agent = listing.listing_agent;
                      const avatar = agent?.avatar_url || (agent ? getStoredAvatar(agent.id, agent.email) : null);
                      const price = listing.price || listing.list_price;

                      return (
                        <tr
                          key={listing.id}
                          className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                          onClick={() => setSelectedListing(listing)}
                        >
                          {/* Property Address */}
                          <td className="py-3.5 px-4 sm:px-6 font-semibold text-white">
                            <div className="space-y-0.5">
                              <span className="block font-bold text-sm text-slate-100 group-hover:text-amber-400 transition-colors">
                                {listing.property_address}
                              </span>
                              {listing.sisu_transaction_id && (
                                <span className="text-[10px] font-mono text-slate-500 block">
                                  Sisu #{listing.sisu_transaction_id}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* City / State */}
                          <td className="py-3.5 px-4 text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-slate-500 shrink-0" />
                              <span>{listing.city || 'Waynesville'}, {listing.state || 'MO'}</span>
                            </div>
                          </td>

                          {/* Price */}
                          <td className="py-3.5 px-4 font-mono font-black text-sm text-amber-400 tabular-nums">
                            {formatMoney(price)}
                          </td>

                          {/* Listing Agent */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              {avatar ? (
                                <img
                                  src={avatar}
                                  alt={agent?.name || 'Agent'}
                                  className="h-7 w-7 rounded-full object-cover border border-amber-500/40 shrink-0"
                                />
                              ) : (
                                <div className="h-7 w-7 rounded-full bg-[#162035] border border-white/10 flex items-center justify-center font-bold text-[10px] text-amber-400 shrink-0">
                                  {(agent?.name || 'A')[0]}
                                </div>
                              )}
                              <div>
                                <span className="block font-bold text-slate-200">
                                  {agent?.name || 'Unassigned'}
                                </span>
                                {agent?.level && (
                                  <span className="text-[9px] font-bold text-amber-400 uppercase">
                                    Level {agent.level}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Seller Client */}
                          <td className="py-3.5 px-4 text-slate-300">
                            <span className="truncate max-w-[150px] block">
                              {listing.client_name || 'Seller'}
                            </span>
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                                (listing.status || '').toLowerCase().includes('live')
                                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                  : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                              }`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>{listing.status || 'Live Listing'}</span>
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 sm:px-6 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedListing(listing)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-white/5 transition-colors cursor-pointer"
                                title="View listing details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                  `${listing.property_address}, ${listing.city || ''}, ${listing.state || 'MO'}`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                                title="Open Google Maps"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Cards View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredListings.map((listing) => {
                const agent = listing.listing_agent;
                const avatar = agent?.avatar_url || (agent ? getStoredAvatar(agent.id, agent.email) : null);
                const price = listing.price || listing.list_price;

                return (
                  <div
                    key={listing.id}
                    onClick={() => setSelectedListing(listing)}
                    className="p-5 bg-[#111726] border border-white/10 hover:border-amber-500/40 rounded-2xl shadow-lg transition-all space-y-4 cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                            (listing.status || '').toLowerCase().includes('live')
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>{listing.status || 'Live Listing'}</span>
                        </span>

                        {listing.sisu_transaction_id && (
                          <span className="text-[10px] font-mono text-slate-500">
                            #{listing.sisu_transaction_id}
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="font-bold text-base text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                          {listing.property_address}
                        </h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-slate-500 shrink-0" />
                          <span>{listing.city || 'Waynesville'}, {listing.state || 'MO'} {listing.zip || ''}</span>
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-[#0d121f] border border-white/5 flex items-baseline justify-between">
                        <span className="text-[10px] uppercase font-bold text-slate-400">List Price</span>
                        <span className="font-mono font-black text-xl text-amber-400 tabular-nums">
                          {formatMoney(price)}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={agent?.name || 'Agent'}
                            className="h-6 w-6 rounded-full object-cover border border-amber-500/30"
                          />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-[#162035] flex items-center justify-center font-bold text-[9px] text-amber-400">
                            {(agent?.name || 'A')[0]}
                          </div>
                        )}
                        <span className="font-bold text-slate-200 truncate max-w-[120px]">
                          {agent?.name || 'Unassigned'}
                        </span>
                      </div>

                      <span className="text-[10px] text-slate-500">
                        {listing.client_name || 'Seller'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          TAB 2: Monthly Trends & Price Brackets
         ───────────────────────────────────────────────────────────────── */}
      {activeReportTab === 'charts_analytics' && (
        <div className="space-y-6">
          {/* Active Listings Per Month Chart */}
          <div className="bg-[#111726] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-amber-400" />
                  <span>Listings Added by Month</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Month-over-month inventory intake tracking from Sisu
                </p>
              </div>
            </div>

            {/* SVG / Bar visualization */}
            <div className="pt-6">
              <div className="grid grid-cols-12 gap-2 sm:gap-3 items-end h-56 border-b border-white/10 pb-2">
                {monthlyTrends.list.map((m, idx) => {
                  const heightPct = Math.round((m.count / monthlyTrends.maxCount) * 100);
                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group">
                      <div className="text-[10px] font-mono font-bold text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {m.count}
                      </div>
                      <div className="w-full bg-[#162035] rounded-t-lg overflow-hidden relative h-full flex items-end">
                        <div
                          style={{ height: `${Math.max(heightPct, 6)}%` }}
                          className="w-full bg-gradient-to-t from-amber-500 to-amber-300 rounded-t-lg transition-all duration-300 group-hover:brightness-125"
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{m.name}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between pt-3 text-[11px] text-slate-500 font-mono">
                <span>Total Tracked Intake: {listings.length} listings</span>
                <span>Peak Monthly Velocity: {monthlyTrends.maxCount} listings</span>
              </div>
            </div>
          </div>

          {/* Two-Column Grid: Price Bracket Breakdown & Agent Leaderboard */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Price Tiers Breakdown */}
            <div className="bg-[#111726] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <span>Price Bracket Distribution</span>
              </h3>
              <p className="text-xs text-slate-400">
                Breakdown of active listings across market price categories
              </p>

              <div className="space-y-3 pt-2">
                {priceTiers.map((tier, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200">{tier.label}</span>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="text-slate-400">{tier.count} deals</span>
                        <span className="font-bold text-amber-400">{tier.pct}%</span>
                      </div>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#0d121f] overflow-hidden">
                      <div
                        style={{ width: `${tier.pct}%` }}
                        className={`h-full ${tier.color} rounded-full transition-all duration-500`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Listing Agents Leaderboard */}
            <div className="bg-[#111726] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Award className="h-4 w-4 text-purple-400" />
                <span>Top Listing Specialists</span>
              </h3>
              <p className="text-xs text-slate-400">
                Agent inventory share and total active dollar volume
              </p>

              <div className="space-y-2.5 pt-1 overflow-y-auto max-h-72 pr-1">
                {agentLeaderboard.slice(0, 7).map((agent, rank) => (
                  <div
                    key={agent.name}
                    className="p-2.5 rounded-xl bg-[#0d121f] border border-white/5 flex items-center justify-between gap-3 hover:border-amber-500/20 transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 text-center font-mono font-bold text-xs text-slate-500">
                        #{rank + 1}
                      </span>
                      {agent.avatar ? (
                        <img
                          src={agent.avatar}
                          alt={agent.name}
                          className="h-8 w-8 rounded-full object-cover border border-amber-500/30"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-[#162035] flex items-center justify-center font-bold text-xs text-amber-400">
                          {agent.name[0]}
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-xs text-slate-100 block">{agent.name}</span>
                        <span className="text-[10px] text-amber-400/90 font-medium">Level {agent.level} Specialist</span>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <span className="text-xs font-black text-white block tabular-nums">
                        {agent.count} {agent.count === 1 ? 'listing' : 'listings'}
                      </span>
                      <span className="text-[10px] text-slate-400 block tabular-nums">
                        {formatMoney(agent.volume)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          TAB 3: Market & City Breakdown
         ───────────────────────────────────────────────────────────────── */}
      {activeReportTab === 'market_breakdown' && (
        <div className="space-y-6">
          <div className="bg-[#111726] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-400" />
              <span>Geographical Inventory Distribution</span>
            </h3>
            <p className="text-xs text-slate-400">
              Active listings volume and deal count segmented across Missouri market territories
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
              {cityAnalytics.list.map((c) => (
                <div
                  key={c.city}
                  className="p-4 rounded-xl bg-[#0d121f] border border-white/5 space-y-2 hover:border-amber-500/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{c.city}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      {c.count} listings
                    </span>
                  </div>
                  <div className="pt-1">
                    <span className="text-xs font-mono font-black text-emerald-400 block tabular-nums">
                      {formatMoney(c.volume)}
                    </span>
                    <span className="text-[10px] text-slate-500 block">Total market inventory</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          Listing Detail Modal
         ───────────────────────────────────────────────────────────────── */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="relative w-full max-w-xl bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10 bg-gradient-to-r from-[#111726] to-[#162035] relative">
              <button
                onClick={() => setSelectedListing(null)}
                className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="space-y-1 pr-8">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 uppercase">
                    {selectedListing.status || 'Live Listing'}
                  </span>
                  {selectedListing.sisu_transaction_id && (
                    <span className="text-xs font-mono text-slate-400">
                      Sisu ID: #{selectedListing.sisu_transaction_id}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-black text-white">
                  {selectedListing.property_address}
                </h2>
                <p className="text-xs text-slate-300 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-amber-400" />
                  <span>{selectedListing.city || 'Waynesville'}, {selectedListing.state || 'MO'} {selectedListing.zip || ''}</span>
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-200">
              {/* Price Banner */}
              <div className="p-4 rounded-xl bg-[#162035]/80 border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">List Price</span>
                  <span className="text-2xl font-black text-amber-400 font-mono tabular-nums">
                    {formatMoney(selectedListing.price || selectedListing.list_price)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Representation</span>
                  <span className="text-xs font-bold text-white capitalize">Seller Side (Listing)</span>
                </div>
              </div>

              {/* Listing Agent Card */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Assigned Listing Agent
                </h4>
                <div className="p-3.5 rounded-xl bg-[#162035]/40 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {selectedListing.listing_agent?.avatar_url || getStoredAvatar(selectedListing.listing_agent?.id || '', selectedListing.listing_agent?.email || '') ? (
                      <img
                        src={selectedListing.listing_agent?.avatar_url || getStoredAvatar(selectedListing.listing_agent?.id || '', selectedListing.listing_agent?.email || '')!}
                        alt={selectedListing.listing_agent?.name || 'Agent'}
                        className="h-10 w-10 rounded-full object-cover border border-amber-500/40"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-[#0d121f] flex items-center justify-center font-bold text-sm text-amber-400">
                        {(selectedListing.listing_agent?.name || 'A')[0]}
                      </div>
                    )}
                    <div>
                      <span className="font-bold text-sm text-white block">
                        {selectedListing.listing_agent?.name || 'Unassigned Listing Agent'}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        {selectedListing.listing_agent?.email || 'agent@mattsmithrealestategroup.com'}
                      </span>
                    </div>
                  </div>

                  {selectedListing.listing_agent?.phone && (
                    <a
                      href={`tel:${selectedListing.listing_agent.phone}`}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all font-semibold flex items-center gap-1.5"
                    >
                      <Phone className="h-3 w-3" />
                      <span>Call</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Client / Seller Info */}
              <div className="space-y-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Seller Client Details
                </h4>
                <div className="p-3.5 rounded-xl bg-[#162035]/40 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">
                      {selectedListing.client_name || 'Seller Client'}
                    </span>
                    {selectedListing.client_phone && (
                      <a
                        href={`tel:${selectedListing.client_phone}`}
                        className="text-amber-400 hover:underline font-mono"
                      >
                        {selectedListing.client_phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Sisu System Fields */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex items-center justify-between text-slate-400 text-[11px]">
                  <span>System Created:</span>
                  <span className="font-mono text-slate-300">
                    {new Date(selectedListing.created_at).toLocaleDateString()}
                  </span>
                </div>
                {selectedListing.sisu_transaction_id && (
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Sisu Cloud Reference:</span>
                    <span className="font-mono text-amber-400">
                      SISU-CLIENT-{selectedListing.sisu_transaction_id}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 bg-[#0d121f] flex items-center justify-between gap-3">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${selectedListing.property_address}, ${selectedListing.city || ''}, ${selectedListing.state || 'MO'}`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#162035] hover:bg-white/10 text-slate-300 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open in Google Maps</span>
              </a>

              <button
                onClick={() => setSelectedListing(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 transition-all cursor-pointer font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
