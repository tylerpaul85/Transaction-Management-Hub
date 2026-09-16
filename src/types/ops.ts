import { MilestoneType, MilestoneStatus, MilestoneSource } from './database.types';

export interface OpsMilestone {
  id: string;
  transaction_id: string;
  milestone_type: MilestoneType;
  target_date: string | null;
  actual_date: string | null;
  status: MilestoneStatus;
  source: MilestoneSource;
  notes: string | null;
  updated_at: string;
  updated_by?: string | null;
}

export type ListingStage = 'pre_listing' | 'coming_soon' | 'active_listing' | 'price_improved' | 'under_contract' | 'closed';

export interface OpsTransaction {
  id: string;
  sisu_transaction_id: string | null;
  status: 'active' | 'pending' | 'closed' | 'terminated' | 'under_contract' | 'pre_listing' | 'coming_soon';
  property_address: string;
  city: string;
  state?: string;
  zip?: string;
  side: 'buyer' | 'seller' | 'dual';
  client_name: string;
  client_phone: string | null;
  client_email?: string | null;
  
  // Listing & Financial Details
  price?: number | null;
  list_price?: number | null;
  mls_number?: string | null;
  listing_date?: string | null;
  expiration_date?: string | null;
  days_on_market?: number | null;
  
  // LC Checklist Status
  photography_status?: 'pending' | 'scheduled' | 'completed';
  sign_lockbox_status?: 'pending' | 'installed' | 'removed';
  mls_status?: 'draft' | 'active' | 'pending' | 'closed';
  open_house_date?: string | null;

  // Other Agent Info (always source='manual')
  other_party_name: string | null;
  other_party_agent: string | null;
  other_party_phone?: string | null;
  other_party_brokerage?: string | null;
  
  // Relationships
  listing_agent_id: string | null;
  selling_agent_id: string | null;
  assigned_tc_id: string | null;
  agent_name: string;
  agent_email?: string;
  tc_name: string;
  tc_email?: string;
  
  // Dates & Flags
  contract_date: string | null;
  target_closing_date?: string | null;
  flagged_for_review: boolean; // Friday TC double-check verification
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  created_at: string;
  updated_at: string;
  milestones: OpsMilestone[];
}

export const MILESTONE_ORDER: { type: MilestoneType; label: string; shortLabel: string }[] = [
  { type: 'earnest_money', label: 'Earnest Money Deposit', shortLabel: 'EMD' },
  { type: 'inspection_10day', label: 'Home Inspection', shortLabel: 'INSP' },
  { type: 'appraisal_satisfied', label: 'Appraisal Report', shortLabel: 'APP' },
  { type: 'financing_contingency', label: 'Loan Commitment', shortLabel: 'FIN' },
  { type: 'title', label: 'Title Clearance', shortLabel: 'TITLE' },
  { type: 'ctc', label: 'Clear to Close', shortLabel: 'CTC' },
  { type: 'closing', label: 'Closing & Funding', shortLabel: 'CLOSE' },
];

export const ALL_MILESTONES_CONFIG: { type: MilestoneType; label: string; description: string }[] = [
  { type: 'earnest_money', label: 'Earnest Money Deposit (EMD)', description: 'Initial escrow deposit slip and verification' },
  { type: 'inspection_ordered', label: 'Inspection Ordered', description: 'Home inspector booked by buyer/agent' },
  { type: 'inspection_notice_sent', label: 'Inspection Notice Sent', description: 'Repair requests & addenda delivered to other party' },
  { type: 'inspection_10day', label: '10-Day Inspection Contingency', description: 'Contractual inspection deadline' },
  { type: 'sale_contingency', label: 'Sale Contingency', description: 'Buyer home sale contingency (if applicable)' },
  { type: 'financing_contingency', label: 'Financing / Loan Commitment', description: 'Mortgage lender approval deadline' },
  { type: 'appraisal_ordered', label: 'Appraisal Ordered', description: 'Lender valuation appraisal scheduled' },
  { type: 'appraisal_received', label: 'Appraisal Received', description: 'Appraisal report delivered to buyer/lender' },
  { type: 'appraisal_satisfied', label: 'Appraisal Satisfied', description: 'Appraisal valuation condition met' },
  { type: 'title', label: 'Title Commitment & Clearance', description: 'Preliminary title Schedule B review' },
  { type: 'walk_through', label: 'Final Walkthrough', description: 'Pre-closing property inspection' },
  { type: 'ctc', label: 'Clear-to-Close (CTC)', description: 'Final underwriter loan clearance' },
  { type: 'closing', label: 'Closing Settlement & Funding', description: 'Final deed recording and escrow funding' },
];
