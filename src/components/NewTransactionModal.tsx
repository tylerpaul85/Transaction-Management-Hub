import React, { useState } from 'react';
import { useTransactions } from '../context/TransactionContext';
import { RepresentationType, PropertyType, Transaction } from '../types/transaction';
import { X, Building, DollarSign, Calendar, Users, Sparkles } from 'lucide-react';
import { addDays, format } from 'date-fns';
import confetti from 'canvas-confetti';

export const NewTransactionModal: React.FC = () => {
  const { isNewModalOpen, setIsNewModalOpen, createTransaction } = useTransactions();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const defaultCloseStr = format(addDays(new Date(), 35), 'yyyy-MM-dd');

  const [address, setAddress] = useState('');
  const [unit, setUnit] = useState('');
  const [city, setCity] = useState('Waynesville');
  const [state, setState] = useState('MO');
  const [zip, setZip] = useState('65583');
  const [mlsId, setMlsId] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('Single Family');
  const [representation, setRepresentation] = useState<RepresentationType>('Buyer');
  const [contractPrice, setContractPrice] = useState('350000');
  const [mutualAcceptanceDate, setMutualAcceptanceDate] = useState(todayStr);
  const [targetClosingDate, setTargetClosingDate] = useState(defaultCloseStr);
  const [clientNames, setClientNames] = useState('');
  const [agentName, setAgentName] = useState('');
  const [tcName, setTcName] = useState('');

  if (!isNewModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !contractPrice) return;

    const price = parseFloat(contractPrice) || 0;
    const baseAcceptance = new Date(mutualAcceptanceDate);
    const closeDate = new Date(targetClosingDate);

    // Auto-generate standard contingencies
    const emdDue = format(addDays(baseAcceptance, 3), 'yyyy-MM-dd');
    const inspectionDue = format(addDays(baseAcceptance, 10), 'yyyy-MM-dd');
    const hoaDue = format(addDays(baseAcceptance, 14), 'yyyy-MM-dd');
    const appraisalDue = format(addDays(baseAcceptance, 21), 'yyyy-MM-dd');
    const loanDue = format(addDays(baseAcceptance, 28), 'yyyy-MM-dd');
    const walkthroughDue = format(addDays(closeDate, -1), 'yyyy-MM-dd');

    const contingencies = [
      {
        id: `c-${Date.now()}-1`,
        name: 'Initial Earnest Money Deposit ($25,000)',
        dueDate: emdDue,
        status: 'pending' as const,
        required: true,
        notes: 'Wire transfer to Title escrow account',
      },
      {
        id: `c-${Date.now()}-2`,
        name: 'Home Inspection & Repair Resolution',
        dueDate: inspectionDue,
        status: 'pending' as const,
        required: true,
      },
      {
        id: `c-${Date.now()}-3`,
        name: 'Condominium 22.1 / HOA Disclosures',
        dueDate: hoaDue,
        status: 'pending' as const,
        required: true,
      },
      {
        id: `c-${Date.now()}-4`,
        name: 'Appraisal Report Contingency',
        dueDate: appraisalDue,
        status: 'pending' as const,
        required: true,
      },
      {
        id: `c-${Date.now()}-5`,
        name: 'Full Mortgage Loan Commitment',
        dueDate: loanDue,
        status: 'pending' as const,
        required: true,
      },
      {
        id: `c-${Date.now()}-6`,
        name: 'Final Walkthrough Inspection',
        dueDate: walkthroughDue,
        status: 'pending' as const,
        required: true,
      },
    ];

    const documents = [
      {
        id: `doc-${Date.now()}-1`,
        name: 'Fully Executed Multi-Board Purchase Contract 7.0',
        category: 'Contract' as const,
        required: true,
        status: 'uploaded' as const,
        uploadedAt: todayStr,
      },
      {
        id: `doc-${Date.now()}-2`,
        name: 'Illinois Real Property Disclosure Report',
        category: 'Disclosures' as const,
        required: true,
        status: 'uploaded' as const,
        uploadedAt: todayStr,
      },
      {
        id: `doc-${Date.now()}-3`,
        name: 'EPA Lead-Based Paint & Radon Hazard Disclosure',
        category: 'Disclosures' as const,
        required: true,
        status: 'uploaded' as const,
        uploadedAt: todayStr,
      },
      {
        id: `doc-${Date.now()}-4`,
        name: 'Earnest Money Deposit Slip',
        category: 'Financial & Title' as const,
        required: true,
        status: 'needed' as const,
      },
      {
        id: `doc-${Date.now()}-5`,
        name: 'Preliminary Title Commitment',
        category: 'Financial & Title' as const,
        required: true,
        status: 'needed' as const,
      },
    ];

    // Commission
    const commRate = 2.5;
    const grossComm = price * (commRate / 100);
    const agentSplit = 85;
    const agentGross = grossComm * (agentSplit / 100);
    const houseGross = grossComm - agentGross;
    const tc = 450;
    const eo = 50;
    const admin = 195;
    const netAgent = agentGross - tc - eo - admin;

    const commission = {
      purchasePrice: price,
      commissionRate: commRate,
      grossCommission: grossComm,
      agentSplitPercentage: agentSplit,
      agentGrossPayout: agentGross,
      brokerageGrossSplit: houseGross,
      transactionCoordinatorFee: tc,
      eoInsuranceFee: eo,
      adminFee: admin,
      otherDeductions: 0,
      netAgentPayout: netAgent,
      escrowCompany: 'Chicago Title Insurance Company',
      escrowOfficer: 'Catherine Morales',
      escrowEmail: 'cmorales@ctic.com',
      cdaNumber: `CDA-2026-${Math.floor(100 + Math.random() * 900)}`,
      cdaStatus: 'Draft' as const,
      settlementDate: targetClosingDate,
    };

    const clients = clientNames.trim()
      ? clientNames.split(',').map((s) => s.trim())
      : ['New Client'];

    const parties = [
      {
        id: `p-${Date.now()}-1`,
        role: representation === 'Buyer' ? ('Buyer' as const) : ('Seller' as const),
        name: clients[0],
        email: 'client@example.com',
        phone: '(312) 555-0190',
        isPrimary: true,
      },
      {
        id: `p-${Date.now()}-2`,
        role: 'Title / Escrow Officer' as const,
        name: 'Catherine Morales',
        company: 'Chicago Title Insurance Company',
        email: 'cmorales@ctic.com',
        phone: '(312) 555-9030',
      },
    ];

    const milestones = [
      { id: `m-${Date.now()}-1`, title: 'Contract Intake & File Creation', completed: true, completedAt: todayStr },
      { id: `m-${Date.now()}-2`, title: 'Confirm EMD Wire Instructions', completed: false, dueDate: emdDue },
      { id: `m-${Date.now()}-3`, title: 'Physical Inspection Resolution', completed: false, dueDate: inspectionDue },
      { id: `m-${Date.now()}-4`, title: 'Appraisal Report Satisfied', completed: false, dueDate: appraisalDue },
      { id: `m-${Date.now()}-5`, title: 'Lender Clear to Close', completed: false, dueDate: loanDue },
      { id: `m-${Date.now()}-6`, title: 'Generate & Deliver CDA', completed: false, dueDate: format(addDays(closeDate, -3), 'yyyy-MM-dd') },
      { id: `m-${Date.now()}-7`, title: 'Closing Settlement & Funding', completed: false, dueDate: targetClosingDate },
    ];

    createTransaction({
      address: address.trim(),
      unit: unit.trim() || undefined,
      city: city.trim(),
      state: state.trim(),
      zip: zip.trim(),
      mlsId: mlsId.trim() || undefined,
      photoUrl:
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80',
      propertyType,
      contractPrice: price,
      mutualAcceptanceDate,
      targetClosingDate,
      stage: 'intake',
      representation,
      health: 'on_track',
      agentName,
      agentEmail: 'tyler@msreg.com',
      agentPhone: '(312) 555-0142',
      agentAvatar: agentName
        .split(' ')
        .map((s) => s[0])
        .join(''),
      tcName,
      tcAvatar: 'SJ',
      clientNames: clients,
      contingencies,
      documents,
      parties,
      commission,
      milestones,
    });

    // Celebrate with confetti
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#d97706', '#10b981', '#f8fafc'],
      });
    } catch {
      // ignore
    }

    setIsNewModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#1a2235] border border-[#334155] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#131826] border-b border-[#334155] p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#d97706]/15 border border-[#d97706]/30 text-[#d97706]">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-editorial text-lg sm:text-xl font-bold text-[#f8fafc]">
                New Transaction Intake
              </h3>
              <p className="text-xs text-[#94a3b8]">
                Setup contract file and auto-generate compliance timeline
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsNewModalOpen(false)}
            className="p-2 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-[#94a3b8] hover:text-[#f8fafc] border border-[#334155] transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* Section 1: Property Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#d97706] uppercase tracking-wider">
              1. Property Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs text-[#94a3b8] mb-1">Street Address *</label>
                <input
                  type="text"
                  placeholder="e.g. 1500 N Astor Street"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94a3b8] mb-1">Unit / Apt</label>
                <input
                  type="text"
                  placeholder="Unit 12B"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[#94a3b8] mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94a3b8] mb-1">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94a3b8] mb-1">Zip Code</label>
                <input
                  type="text"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#94a3b8] mb-1">Property Type</label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                  className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                >
                  <option value="Condo / Loft">Condo / Loft</option>
                  <option value="Single Family">Single Family</option>
                  <option value="Townhome">Townhome</option>
                  <option value="Luxury Penthouse">Luxury Penthouse</option>
                  <option value="Estate">Estate</option>
                  <option value="Multi-Family">Multi-Family</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#94a3b8] mb-1">MLS # (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 11988204"
                  value={mlsId}
                  onChange={(e) => setMlsId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Contract Financials & Representation */}
          <div className="space-y-3 pt-3 border-t border-[#334155]">
            <h4 className="text-xs font-bold text-[#d97706] uppercase tracking-wider">
              2. Contract & Representation
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#94a3b8] mb-1">Representation *</label>
                <select
                  value={representation}
                  onChange={(e) => setRepresentation(e.target.value as RepresentationType)}
                  className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                >
                  <option value="Buyer">Buyer Representation</option>
                  <option value="Seller">Seller Representation</option>
                  <option value="Dual">Dual Agency / Intermediary</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-[#94a3b8] mb-1">Contract Purchase Price ($) *</label>
                <input
                  type="number"
                  placeholder="1250000"
                  value={contractPrice}
                  onChange={(e) => setContractPrice(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[#334155] rounded-xl text-base text-[#f8fafc] font-mono-code focus:outline-none focus:border-[#d97706]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#94a3b8] mb-1">Client Name(s) *</label>
              <input
                type="text"
                placeholder="e.g. John & Jennifer Smith"
                value={clientNames}
                onChange={(e) => setClientNames(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
              />
            </div>
          </div>

          {/* Section 3: Key Dates */}
          <div className="space-y-3 pt-3 border-t border-[#334155]">
            <h4 className="text-xs font-bold text-[#d97706] uppercase tracking-wider">
              3. Contract Dates
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#94a3b8] mb-1">Mutual Acceptance Date</label>
                <input
                  type="date"
                  value={mutualAcceptanceDate}
                  onChange={(e) => setMutualAcceptanceDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94a3b8] mb-1">Target Closing Date</label>
                <input
                  type="date"
                  value={targetClosingDate}
                  onChange={(e) => setTargetClosingDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#1e293b] border border-[#334155] rounded-xl text-base text-[#f8fafc] focus:outline-none focus:border-[#d97706]"
                />
              </div>
            </div>
            <p className="text-[11px] text-[#94a3b8] italic">
              Contingency deadlines (EMD 3-day, Inspection 10-day, Appraisal 21-day, Loan 28-day)
              will be auto-calculated from these dates.
            </p>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#334155]">
            <button
              type="button"
              onClick={() => setIsNewModalOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-[#334155] text-sm font-semibold text-[#94a3b8] hover:text-[#f8fafc] hover:bg-[#1e293b] min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#d97706] text-[#0f172a] hover:bg-[#d97706]/90 font-bold text-sm flex items-center gap-2 active:scale-[0.98] transition-all shadow-lg min-h-[44px]"
            >
              <Sparkles className="h-4 w-4" />
              <span>Create Transaction File</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
