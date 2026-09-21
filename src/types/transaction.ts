export type TransactionStage =
  | 'intake'
  | 'escrow_opened'
  | 'inspection'
  | 'appraisal_loan'
  | 'clear_to_close'
  | 'closed';

export type RepresentationType = 'Buyer' | 'Seller' | 'Dual' | 'Tenant' | 'Landlord';

export type PropertyType =
  | 'Single Family'
  | 'Condo / Loft'
  | 'Townhome'
  | 'Multi-Family'
  | 'Luxury Penthouse'
  | 'Estate';

export type TransactionHealth = 'on_track' | 'attention_required' | 'urgent_deadline' | 'completed';

export type ContingencyStatus = 'pending' | 'satisfied' | 'complete' | 'waived' | 'overdue';

export interface Contingency {
  id: string;
  name: string;
  dueDate: string;
  status: ContingencyStatus;
  required: boolean;
  notes?: string;
  resolvedDate?: string;
}

export type DocumentCategory = 'Contract' | 'Disclosures' | 'Financial & Title' | 'Closing';
export type DocumentStatus = 'needed' | 'uploaded' | 'in_review' | 'approved' | 'signed';

export interface ComplianceDocument {
  id: string;
  name: string;
  category: DocumentCategory;
  required: boolean;
  status: DocumentStatus;
  uploadedAt?: string;
  fileSize?: string;
  notes?: string;
}

export interface PartyContact {
  id: string;
  role:
    | 'Buyer'
    | 'Seller'
    | 'Listing Agent'
    | 'Buying Agent'
    | 'Co-op Agent'
    | 'Transaction Coordinator'
    | 'Title / Escrow Officer'
    | 'Escrow Company'
    | 'Mortgage Lender'
    | 'Home Inspector'
    | 'Real Estate Attorney'
    | 'Appraiser';
  name: string;
  company?: string;
  email: string;
  phone: string;
  address?: string;
  isPrimary?: boolean;
}

export interface CommissionBreakdown {
  purchasePrice: number;
  commissionRate: number; // e.g. 2.5%
  grossCommission: number;
  agentSplitPercentage: number; // e.g. 85%
  agentGrossPayout: number;
  brokerageGrossSplit: number;
  transactionCoordinatorFee: number; // e.g. $450
  eoInsuranceFee: number; // e.g. $50
  adminFee: number; // e.g. $195
  otherDeductions: number;
  netAgentPayout: number;
  escrowCompany: string;
  escrowOfficer: string;
  escrowEmail: string;
  cdaNumber: string;
  cdaStatus: 'Draft' | 'Approved' | 'Sent to Title' | 'Paid';
  settlementDate?: string;
  disbursementDate?: string;
}

export interface ActivityNote {
  id: string;
  author: string;
  role: string;
  avatar?: string;
  content: string;
  createdAt: string;
  type: 'note' | 'status_change' | 'document' | 'contingency' | 'email';
  isPinned?: boolean;
}

export interface MilestoneItem {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
  completedAt?: string;
  assignedTo?: string;
}

export interface Transaction {
  id: string;
  fileNumber: string; // e.g. TRX-2026-042
  address: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
  mlsId?: string;
  photoUrl: string;
  propertyType: PropertyType;
  contractPrice: number;
  mutualAcceptanceDate: string;
  targetClosingDate: string;
  actualClosingDate?: string;
  stage: TransactionStage;
  representation: RepresentationType;
  health: TransactionHealth;
  agentName: string;
  agentEmail: string;
  agentPhone: string;
  agentAvatar: string;
  tcName: string;
  tcAvatar: string;
  clientNames: string[];
  contingencies: Contingency[];
  documents: ComplianceDocument[];
  parties: PartyContact[];
  commission: CommissionBreakdown;
  milestones: MilestoneItem[];
  customFields?: Record<string, any>;
  sisuTransactionId?: string;
  activityLog: ActivityNote[];
}

export const STAGE_CONFIG: Record<
  TransactionStage,
  { label: string; description: string; step: number; color: string }
> = {
  intake: {
    label: 'Intake & Review',
    description: 'Contract received, initial document check',
    step: 1,
    color: 'text-slate-400',
  },
  escrow_opened: {
    label: 'Escrow & EMD',
    description: 'Title opened, earnest money deposit verification',
    step: 2,
    color: 'text-amber-400',
  },
  inspection: {
    label: 'Inspection & Diligence',
    description: 'Physical inspection & repair resolutions',
    step: 3,
    color: 'text-sky-400',
  },
  appraisal_loan: {
    label: 'Appraisal & Financing',
    description: 'Lender underwriting & appraisal review',
    step: 4,
    color: 'text-indigo-400',
  },
  clear_to_close: {
    label: 'Clear to Close',
    description: 'Final walkthrough & closing disclosure approval',
    step: 5,
    color: 'text-emerald-400',
  },
  closed: {
    label: 'Closed & Disbursed',
    description: 'Funds wired, recorded & commission distributed',
    step: 6,
    color: 'text-emerald-500',
  },
};
