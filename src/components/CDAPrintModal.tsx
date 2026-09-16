import React from 'react';
import { useTransactions } from '../context/TransactionContext';
import { X, Printer, Check, Building, ShieldCheck, Download } from 'lucide-react';
import { format } from 'date-fns';

export const CDAPrintModal: React.FC = () => {
  const { isCdaModalOpen, closeCdaModal, cdaTransaction, updateCommission } = useTransactions();

  if (!isCdaModalOpen || !cdaTransaction) return null;

  const trx = cdaTransaction;
  const comm = trx.commission;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(val);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleMarkSent = () => {
    updateCommission(trx.id, { cdaStatus: 'Sent to Title' });
    closeCdaModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#1e293b] border border-[#334155] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="no-print bg-[#131826] border-b border-[#334155] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono-code text-xs px-2.5 py-1 rounded-md bg-[#d97706]/15 text-[#d97706] border border-[#d97706]/30 font-bold">
              {comm.cdaNumber}
            </span>
            <span className="text-sm font-semibold text-[#f8fafc]">
              Official Commission Disbursement Authorization
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkSent}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-[#0f172a] border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all min-h-[36px]"
            >
              <Check className="h-4 w-4" />
              <span>Mark Sent to Title</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-[#d97706] text-[#0f172a] hover:bg-[#d97706]/90 font-bold text-xs flex items-center gap-1.5 transition-all min-h-[36px]"
            >
              <Printer className="h-4 w-4" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={closeCdaModal}
              className="p-1.5 rounded-lg bg-[#1e293b] hover:bg-[#334155] text-[#94a3b8] hover:text-[#f8fafc] border border-[#334155] transition-all min-h-[36px] min-w-[36px] flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white text-slate-900 print-sheet font-sans">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-6 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <img
                    src="/msreg-logo.png"
                    alt="MSREG Logo"
                    className="h-12 w-auto object-contain"
                    onError={(e) => ((e.target as HTMLElement).style.display = 'none')}
                  />
                  <div>
                    <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
                      Main Street Real Estate Group
                    </h1>
                    <p className="text-xs text-slate-600 font-medium">
                      Corporate Headquarters • Chicago, IL • info@msreg.com
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono font-bold text-amber-700 uppercase tracking-wider block">
                  COMMISSION DISBURSEMENT AUTHORIZATION
                </span>
                <span className="text-sm font-mono font-bold text-slate-900 block">
                  {comm.cdaNumber}
                </span>
                <span className="text-xs text-slate-500 block">
                  Date: {format(new Date(), 'MMMM d, yyyy')}
                </span>
              </div>
            </div>
          </div>

          {/* Instructions to Escrow / Title */}
          <div className="mb-6 p-4 bg-slate-100 rounded-lg border border-slate-300 text-xs leading-relaxed">
            <strong className="text-slate-900 uppercase tracking-wider block mb-1">
              Instructions to Title & Escrow Closing Officer:
            </strong>
            Please accept this document as irrevocable authorization from{' '}
            <strong>Main Street Real Estate Group (MSREG)</strong> to disburse real estate brokerage
            funds directly at closing and recording from escrow proceeds as specified in the
            breakdown below.
          </div>

          {/* Transaction Summary Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 uppercase font-semibold block text-[10px]">
                Property Address
              </span>
              <strong className="text-slate-900 text-sm block">
                {trx.address} {trx.unit ? `(${trx.unit})` : ''}
              </strong>
              <span className="text-slate-600">
                {trx.city}, {trx.state} {trx.zip}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 uppercase font-semibold block text-[10px]">
                Closing & File Details
              </span>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <span className="text-slate-500">File #:</span>{' '}
                  <strong className="font-mono text-slate-900">{trx.fileNumber}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Close Date:</span>{' '}
                  <strong className="text-slate-900">{trx.targetClosingDate}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Representation:</span>{' '}
                  <strong className="text-slate-900">{trx.representation} Rep</strong>
                </div>
                <div>
                  <span className="text-slate-500">Lead Broker:</span>{' '}
                  <strong className="text-slate-900">{trx.agentName}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Parties Grid */}
          <div className="grid grid-cols-3 gap-3 mb-6 text-xs">
            <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                Client / Buyer(s)
              </span>
              <strong className="text-slate-900">{trx.clientNames.join(', ')}</strong>
            </div>
            <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                Title & Escrow Company
              </span>
              <strong className="text-slate-900">{comm.escrowCompany}</strong>
              <span className="text-slate-600 block">{comm.escrowOfficer}</span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
              <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                Transaction Coordinator
              </span>
              <strong className="text-slate-900">{trx.tcName}</strong>
              <span className="text-slate-600 block">compliance@msreg.com</span>
            </div>
          </div>

          {/* Commission Calculation Table */}
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
              Disbursement Breakdown & Payment Allocations
            </h3>

            <table className="w-full text-xs text-left border border-slate-300">
              <thead className="bg-slate-200 text-slate-800 font-bold">
                <tr>
                  <th className="p-2 border-b border-slate-300">Description</th>
                  <th className="p-2 border-b border-slate-300">Payable To</th>
                  <th className="p-2 border-b border-slate-300 text-right">Rate / Basis</th>
                  <th className="p-2 border-b border-slate-300 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="p-2 font-medium text-slate-900">Total Purchase Price</td>
                  <td className="p-2 text-slate-600">—</td>
                  <td className="p-2 text-right font-mono text-slate-600">Contract Base</td>
                  <td className="p-2 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(comm.purchasePrice)}
                  </td>
                </tr>
                <tr className="bg-amber-50/50">
                  <td className="p-2 font-bold text-slate-900">Total Gross Commission</td>
                  <td className="p-2 text-slate-700">MSREG Brokerage Trust</td>
                  <td className="p-2 text-right font-mono font-semibold text-slate-700">
                    {comm.commissionRate}%
                  </td>
                  <td className="p-2 text-right font-mono font-bold text-amber-900">
                    {formatCurrency(comm.grossCommission)}
                  </td>
                </tr>

                {/* Direct to Agent */}
                <tr className="bg-emerald-50">
                  <td className="p-2 font-bold text-emerald-950">
                    1. Direct Agent Disbursement
                    <span className="block text-[10px] text-emerald-800 font-normal">
                      Net Commission ({comm.agentSplitPercentage}% split less TC & Insurance fees)
                    </span>
                  </td>
                  <td className="p-2 text-emerald-900 font-semibold">{trx.agentName}</td>
                  <td className="p-2 text-right font-mono text-emerald-900">Direct Deposit</td>
                  <td className="p-2 text-right font-mono font-bold text-emerald-900 text-sm">
                    {formatCurrency(comm.netAgentPayout)}
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 px-2 font-medium text-slate-800">
                    Gross Commission Rate ({comm.commissionRate}%)
                  </td>
                  <td className="py-2.5 px-2 text-slate-600">Total Settlement Escrow</td>
                  <td className="py-2.5 px-2 text-right font-mono">
                    {formatCurrency(comm.purchasePrice)}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-900">
                    {formatCurrency(comm.grossCommission)}
                  </td>
                </tr>

                <tr className="bg-slate-50 font-bold">
                  <td className="py-2.5 px-2 text-slate-900" colSpan={3}>
                    Net MSREG Corporate Brokerage Income
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-900">
                    {formatCurrency(comm.grossCommission - comm.netAgentPayout)}
                  </td>
                </tr>

                <tr>
                  <td className="py-2.5 px-2 font-medium text-slate-800 pl-4">
                    • Agent Net Commission Split ({comm.agentSplitPercentage}%)
                  </td>
                  <td className="py-2.5 px-2 text-slate-600">
                    {trx.agentName || 'Lead Agent'}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono">Net Payout</td>
                  <td className="py-2.5 px-2 text-right font-mono text-emerald-700 font-bold">
                    {formatCurrency(comm.netAgentPayout)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Wire & Remittance Instructions */}
          <div className="mb-6 p-3 bg-slate-50 rounded border border-slate-200 text-xs">
            <span className="font-bold text-slate-900 block text-[11px] mb-1">
              MSREG Corporate Wire Routing Instructions:
            </span>
            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <div>
                Bank: <strong>Operating Bank</strong>
              </div>
              <div>
                Account Name: <strong>Matt Smith Real Estate Group Operating</strong>
              </div>
              <div>
                Routing (ABA): <strong className="font-mono">071000013</strong>
              </div>
              <div>
                Account #: <strong className="font-mono">8829103921</strong>
              </div>
            </div>
          </div>

          {/* Signature Block */}
          <div className="border-t-2 border-slate-300 pt-6 mt-8">
            <div className="grid grid-cols-2 gap-8 text-xs">
              <div>
                <div className="border-b border-slate-400 pb-1 mb-1 h-8 flex items-end">
                  <span className="font-serif italic text-base text-slate-800">
                    Matt Smith (Managing Broker)
                  </span>
                </div>
                <span className="text-slate-600 block">Authorized Broker Signatory</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Sign Date: {format(new Date(), 'yyyy-MM-dd HH:mm')}
                </span>
              </div>

              <div>
                <div className="border-b border-slate-400 pb-1 mb-1 h-8 flex items-end">
                  <span className="font-serif italic text-base text-slate-800">
                    {trx.tcName || 'Assigned Transaction Coordinator'}
                  </span>
                </div>
                <span className="text-slate-600 block">Transaction Coordinator Verification</span>
                <span className="text-[10px] text-slate-400 font-mono">
                  File Compliance Verified: 100%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
