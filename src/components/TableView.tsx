import React, { useState } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { Transaction, STAGE_CONFIG } from '../types/transaction';
import {
  ArrowUpDown,
  FileText,
  Clock,
  ArrowRight,
  ExternalLink,
  DollarSign,
  User,
  ShieldAlert,
  Compass,
} from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';

type SortField = 'fileNumber' | 'address' | 'contractPrice' | 'targetClosingDate' | 'stage';
type SortOrder = 'asc' | 'desc';

export const TableView: React.FC = () => {
  const { filteredTransactions, setSelectedTransactionId, openCdaModal } = useTransactions();
  const [sortField, setSortField] = useState<SortField>('targetClosingDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    if (sortField === 'stage') {
      aVal = STAGE_CONFIG[a.stage].step;
      bVal = STAGE_CONFIG[b.stage].step;
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-[#111726] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-[#0d121f] text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th
                  onClick={() => handleSort('fileNumber')}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>File #</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('address')}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Property Address</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Role</th>
                <th
                  onClick={() => handleSort('contractPrice')}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Price / Net Comm.</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('stage')}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Stage</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('targetClosingDate')}
                  className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Closing Date</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Agent & TC</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {sortedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                sortedTransactions.map((trx) => {
                  const stageInfo = STAGE_CONFIG[trx.stage];
                  const today = new Date();
                  let daysToClose = 0;
                  try {
                    daysToClose = differenceInDays(parseISO(trx.targetClosingDate), today);
                  } catch {
                    daysToClose = 0;
                  }

                  return (
                    <tr
                      key={trx.id}
                      onClick={() => setSelectedTransactionId(trx.id)}
                      className="hover:bg-white/[0.03] cursor-pointer transition-colors group"
                    >
                      {/* File # & Photo */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={trx.photoUrl}
                            alt=""
                            className="h-10 w-12 rounded-lg object-cover bg-slate-900 border border-white/10 flex-shrink-0"
                            onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                          />
                          <div>
                            <span className="font-mono text-xs font-bold text-slate-200 block tabular-nums">
                              {trx.fileNumber}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {trx.propertyType.split(' ')[0]}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Address */}
                      <td className="py-3.5 px-4">
                        <div className="max-w-[220px]">
                          <span className="text-sm font-semibold text-slate-100 group-hover:text-amber-400 transition-colors block truncate">
                            {trx.address} {trx.unit ? `(${trx.unit})` : ''}
                          </span>
                          <span className="text-xs text-slate-400 truncate block">
                            {trx.clientNames.join(', ')}
                          </span>
                        </div>
                      </td>

                      {/* Representation */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            trx.representation === 'Buyer'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : trx.representation === 'Seller'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                          }`}
                        >
                          {trx.representation}
                        </span>
                      </td>

                      {/* Price & Comm */}
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-mono text-sm font-bold text-slate-200 block tabular-nums">
                            {formatCurrency(trx.contractPrice)}
                          </span>
                          <span className="font-mono text-xs text-amber-400 font-medium block tabular-nums">
                            Net: {formatCurrency(trx.commission?.netAgentPayout || 0)}
                          </span>
                        </div>
                      </td>

                      {/* Stage */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-amber-400" />
                          <span className="text-xs font-medium text-slate-200">
                            {stageInfo.label}
                          </span>
                        </div>
                      </td>

                      {/* Closing Date */}
                      <td className="py-3.5 px-4">
                        <div>
                          <span className="font-mono text-xs font-semibold text-slate-200 block tabular-nums">
                            {trx.targetClosingDate}
                          </span>
                          <span
                            className={`text-[11px] font-medium tabular-nums ${
                              trx.stage === 'closed'
                                ? 'text-emerald-400'
                                : daysToClose <= 5
                                ? 'text-amber-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {trx.stage === 'closed'
                              ? 'Closed'
                              : daysToClose < 0
                              ? 'Overdue'
                              : `${daysToClose}d remaining`}
                          </span>
                        </div>
                      </td>

                      {/* Agent & TC */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs">
                          <span className="text-slate-200 font-medium block">{trx.agentName}</span>
                          <span className="text-slate-400 text-[11px] block">TC: {trx.tcName}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`/hub?tx=${trx.id}`}
                            title="Open in Transaction Hub"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/15 hover:bg-sky-500 text-sky-400 hover:text-slate-950 border border-sky-500/30 text-xs font-semibold transition-all min-h-[36px]"
                          >
                            <Compass className="h-3.5 w-3.5" />
                            <span>Hub</span>
                          </a>
                          <button
                            onClick={() => openCdaModal(trx)}
                            title="Generate Official CDA"
                            className="p-1.5 rounded-lg bg-[#162035] hover:bg-amber-400 text-slate-400 hover:text-slate-950 border border-white/10 transition-all min-h-[36px] min-w-[36px] flex items-center justify-center"
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setSelectedTransactionId(trx.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-400 text-amber-400 hover:text-slate-950 border border-amber-500/30 text-xs font-semibold transition-all min-h-[36px]"
                          >
                            <span>Open</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
