import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Download,
  Building,
  DollarSign,
  User,
  Calendar,
  AlertCircle,
  CheckCircle2,
  FileText,
  ExternalLink,
} from 'lucide-react';

export interface DrillDownDeal {
  id: string;
  property_address: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  status: string;
  price?: number | null;
  side?: string | null;
  agent_name?: string | null;
  client_name?: string | null;
  lender_name?: string | null;
  contract_date?: string | null;
  closed_date?: string | null;
  cancellation_reason?: string | null;
  stage_before_cancelled?: string | null;
  territory?: string | null;
  loan_type?: string | null;
}

interface DealDrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  deals: DrillDownDeal[];
  onSelectDeal?: (dealId: string) => void;
}

export const DealDrillDownModal: React.FC<DealDrillDownModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  deals,
  onSelectDeal,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'closed' | 'cancelled'>('all');

  const filteredDeals = useMemo(() => {
    return deals.filter((d) => {
      const q = search.toLowerCase().trim();
      const matchQuery =
        !q ||
        d.property_address?.toLowerCase().includes(q) ||
        d.agent_name?.toLowerCase().includes(q) ||
        d.client_name?.toLowerCase().includes(q) ||
        d.lender_name?.toLowerCase().includes(q) ||
        d.cancellation_reason?.toLowerCase().includes(q);

      const isClosed = (d.status || '').toLowerCase() === 'closed';
      const isCancelled = (d.status || '').toLowerCase() === 'cancelled';

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'closed' && isClosed) ||
        (statusFilter === 'cancelled' && isCancelled);

      return matchQuery && matchStatus;
    });
  }, [deals, search, statusFilter]);

  const handleExportCsv = () => {
    if (filteredDeals.length === 0) return;
    const headers = [
      'Property Address',
      'City',
      'ZIP',
      'Status',
      'Price',
      'Side',
      'Agent',
      'Client',
      'Lender',
      'Loan Type',
      'Contract Date',
      'Closed Date',
      'Cancellation Reason',
      'Stage Before Cancelled',
    ];

    const rows = filteredDeals.map((d) => [
      `"${d.property_address || ''}"`,
      `"${d.city || ''}"`,
      `"${d.zip || ''}"`,
      `"${d.status || ''}"`,
      d.price || '',
      `"${d.side || ''}"`,
      `"${d.agent_name || ''}"`,
      `"${d.client_name || ''}"`,
      `"${d.lender_name || ''}"`,
      `"${d.loan_type || ''}"`,
      `"${d.contract_date || ''}"`,
      `"${d.closed_date || ''}"`,
      `"${d.cancellation_reason || ''}"`,
      `"${d.stage_before_cancelled || ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `drilldown_deals_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl max-h-[90vh] bg-[#1e293b] border border-[#334155] rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#334155] bg-[#131826]/60">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-bold font-editorial text-white tracking-tight">
                {title}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {deals.length} {deals.length === 1 ? 'Deal' : 'Deals'}
              </span>
            </div>
            {subtitle && (
              <p className="text-xs sm:text-sm text-slate-400 mt-1 font-mono-code">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-amber-400" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="p-4 sm:px-6 border-b border-[#334155] bg-[#172033] flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by address, agent, client, lender, or reason..."
              className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-700/80 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-900/80 p-1 border border-slate-700/80 rounded-xl text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({deals.length})
            </button>
            <button
              onClick={() => setStatusFilter('closed')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'closed'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Closed (
              {deals.filter((d) => (d.status || '').toLowerCase() === 'closed').length}
              )
            </button>
            <button
              onClick={() => setStatusFilter('cancelled')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                statusFilter === 'cancelled'
                  ? 'bg-rose-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cancelled (
              {deals.filter((d) => (d.status || '').toLowerCase() === 'cancelled').length}
              )
            </button>
          </div>
        </div>

        {/* Deals Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredDeals.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <FileText className="h-10 w-10 mx-auto text-slate-500 mb-2 opacity-50" />
              <p className="text-sm font-medium">No matching deals found.</p>
              <p className="text-xs text-slate-500 mt-1">Try broadening your search query.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-700/70 rounded-2xl bg-slate-900/60 shadow-inner">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/60 text-slate-300 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Property</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Price</th>
                    <th className="py-3 px-4">Agent & Side</th>
                    <th className="py-3 px-4">Lender</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Cancellation Reason / Stage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredDeals.map((d) => {
                    const isClosed = (d.status || '').toLowerCase() === 'closed';
                    const isCancelled = (d.status || '').toLowerCase() === 'cancelled';

                    return (
                      <tr
                        key={d.id}
                        onClick={() => onSelectDeal && onSelectDeal(d.id)}
                        className={`hover:bg-slate-800/50 transition-colors ${
                          onSelectDeal ? 'cursor-pointer' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">
                            {d.property_address || 'Address Pending'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {[d.city, d.state, d.zip].filter(Boolean).join(', ')}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                              isClosed
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : isCancelled
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {isClosed ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <AlertCircle className="h-3 w-3" />
                            )}
                            {d.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-white font-bold">
                          {d.price ? `$${Number(d.price).toLocaleString()}` : '—'}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-200">{d.agent_name || 'Agent'}</div>
                          <div className="text-[11px] text-slate-400 capitalize">
                            {d.side || 'Buyer'} Side
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-slate-200 font-medium truncate max-w-[150px]">
                            {d.lender_name || '—'}
                          </div>
                          {d.loan_type && (
                            <div className="text-[10px] text-amber-400/90 font-mono">
                              {d.loan_type}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-xs font-mono text-slate-300">
                          {d.closed_date
                            ? `Closed: ${d.closed_date}`
                            : d.contract_date
                            ? `UC: ${d.contract_date}`
                            : '—'}
                        </td>

                        <td className="py-3 px-4">
                          {isCancelled ? (
                            <div>
                              <div className="text-rose-300 font-semibold text-xs">
                                {d.cancellation_reason || (
                                  <span className="italic text-amber-400/80">Missing Reason</span>
                                )}
                              </div>
                              {d.stage_before_cancelled && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  Prior Stage: {d.stage_before_cancelled}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
