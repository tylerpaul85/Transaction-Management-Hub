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
  status: 'active' | 'pending' | 'Pending' | 'closed' | 'terminated' | 'under_contract' | 'pre_listing' | 'coming_soon' | 'lost' | 'mutual_release' | 'signed';
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
  gross_agent_paid_income?: number | null;
  gci?: number | null;
  commission_rate?: number | null;
  closed_date?: string | null;
  
  // LC Checklist Status
  photography_status?: 'pending' | 'scheduled' | 'completed';
  sign_lockbox_status?: 'pending' | 'installed' | 'removed';
  mls_status?: 'draft' | 'active' | 'pending' | 'closed';
  open_house_date?: string | null;

  // Other Agent Info (auto-pulled from forms / editable)
  other_party_name: string | null;
  other_party_agent: string | null;
  other_party_phone?: string | null;
  other_party_email?: string | null;
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
  custom_fields?: Record<string, any> | null;
  milestones: OpsMilestone[];
}

export function getMilestoneOrder(side?: 'buyer' | 'seller' | 'dual' | string): {
  type: MilestoneType;
  label: string;
  shortLabel: string;
  subTypes?: MilestoneType[];
}[] {
  const isSeller = side === 'seller';
  return [
    { type: 'earnest_money', label: 'Earnest Money Deposited', shortLabel: 'Earnest Money' },
    { type: 'inspection_ordered', label: 'Inspection Ordered', shortLabel: 'Inspection Ordered' },
    {
      type: 'inspection_notice_sent',
      label: isSeller ? 'Inspection Notice Received? - Listing' : 'Inspection Notice Sent? - Buyer',
      shortLabel: isSeller ? 'Inspection Notice Received' : 'Inspection Notice Sent',
    },
    { type: 'inspection_10day', label: 'Inspection Satisfied', shortLabel: 'Inspection Satisfied' },
    { type: 'appraisal_received', label: 'Appraisal Received', shortLabel: 'Appraisal Received' },
    { type: 'financing_contingency', label: 'Financing / Loan Commitment', shortLabel: 'Financing / Loan' },
    { type: 'appraisal_satisfied', label: 'Appraisal Satisfied', shortLabel: 'Appraisal Satisfied' },
    { type: 'title', label: 'Title Commitment & Clearance', shortLabel: 'Title Clearance' },
    { type: 'cds_obtained', label: 'CD Sent for Review', shortLabel: 'CD Sent for Review' },
    { type: 'ctc', label: 'Clear-to-Close (CTC)', shortLabel: 'Clear to Close' },
    { type: 'closing_scheduled', label: 'Closing Scheduled', shortLabel: 'Closing Scheduled' },
    { type: 'walk_through', label: 'Walkthrough Complete', shortLabel: 'Walkthrough Complete' },
  ];
}

export const MILESTONE_ORDER = getMilestoneOrder('buyer');

export function getAllMilestonesConfig(side?: 'buyer' | 'seller' | 'dual' | string): {
  type: MilestoneType;
  label: string;
  shortLabel: string;
  description: string;
  isSubItem?: boolean;
  parentGroup?: 'inspection' | 'appraisal' | 'closing';
}[] {
  const isSeller = side === 'seller';
  return [
    { type: 'earnest_money', label: 'Earnest Money Deposited', shortLabel: 'Earnest Money', description: 'Initial escrow deposit slip and verification' },
    { type: 'inspection_ordered', label: 'Inspection Ordered', shortLabel: 'Inspection Ordered', description: 'Home inspector booked by buyer/agent', isSubItem: true, parentGroup: 'inspection' },
    {
      type: 'inspection_notice_sent',
      label: isSeller ? 'Inspection Notice Received? - Listing' : 'Inspection Notice Sent? - Buyer',
      shortLabel: isSeller ? 'Inspection Notice Received' : 'Inspection Notice Sent',
      description: isSeller ? 'Inspection report and repair amendment notice received from buyer agent' : 'Inspection report and amendment notice delivered to listing agent',
      isSubItem: true,
      parentGroup: 'inspection',
    },
    { type: 'inspection_10day', label: 'Inspection Satisfied', shortLabel: 'Inspection Satisfied', description: 'Contractual inspection deadline and repair resolution', isSubItem: true, parentGroup: 'inspection' },
    { type: 'appraisal_received', label: 'Appraisal Received', shortLabel: 'Appraisal Received', description: 'Appraisal report delivered to buyer/lender', isSubItem: true, parentGroup: 'appraisal' },
    { type: 'financing_contingency', label: 'Financing / Loan Commitment', shortLabel: 'Financing / Loan', description: 'Mortgage lender approval condition deadline' },
    { type: 'appraisal_satisfied', label: 'Appraisal Satisfied', shortLabel: 'Appraisal Satisfied', description: 'Appraisal valuation condition met', isSubItem: true, parentGroup: 'appraisal' },
    { type: 'title', label: 'Title Commitment & Clearance', shortLabel: 'Title Clearance', description: 'Preliminary title Schedule B review and clearance' },
    { type: 'cds_obtained', label: 'CD Sent for Review', shortLabel: 'CD Sent for Review', description: 'Closing disclosure sent for review and acknowledgment' },
    { type: 'ctc', label: 'Clear-to-Close (CTC)', shortLabel: 'Clear to Close', description: 'Final underwriter loan clearance' },
    { type: 'closing_scheduled', label: 'Closing Scheduled', shortLabel: 'Closing Scheduled', description: 'Settlement time and location confirmed with title and clients' },
    { type: 'walk_through', label: 'Walkthrough Complete', shortLabel: 'Walkthrough Complete', description: 'Pre-closing property inspection complete' },
    { type: 'insurance_binder', label: 'Insurance Binder Obtained', shortLabel: 'Insurance Binder', description: 'Homeowners insurance binder delivered to lender/title' },
  ];
}

export const ALL_MILESTONES_CONFIG = getAllMilestonesConfig('buyer');

/**
 * Universal evaluator for Sisu 4-choice values (Yes, No, In Progress, N/A)
 * Sisu multiple choice form indices:
 * Option 1 ("Yes") -> "0"
 * Option 2 ("No")  -> "1"
 * Option 3 ("In Progress") -> "2"
 * Option 4 ("N/A") -> "3"
 */
export function evaluateMilestoneValue(val: any): 'complete' | 'in_progress' | 'na' | 'pending' {
  if (val === null || val === undefined) return 'pending';
  const str = String(val).trim().toLowerCase();
  if (str === '' || str === 'null' || str === 'undefined' || str === '- select -' || str === 'select one' || str === '-1') {
    return 'pending';
  }

  // Option 4: N/A / Waived / Not applicable
  if (
    str === '3' ||
    str === 'n/a' ||
    str === 'na' ||
    str === 'n / a' ||
    str === 'not applicable' ||
    str === 'not_applicable' ||
    str === 'waived'
  ) {
    return 'na';
  }

  // Option 3: In Progress
  if (
    str === '2' ||
    str === 'in progress' ||
    str === 'in_progress' ||
    str === 'inprogress' ||
    str === 'progress' ||
    str === 'started' ||
    str === 'ordered' ||
    str === 'notice_sent'
  ) {
    return 'in_progress';
  }

  // Option 1: Complete / Satisfied / Yes
  if (
    str === '0' ||
    str === 'yes' ||
    str === 'y' ||
    str === 'true' ||
    str === 'completed' ||
    str === 'complete' ||
    str === 'satisfied' ||
    str === 'done' ||
    val === true
  ) {
    return 'complete';
  }

  // Option 2: Pending / No
  if (
    str === '1' ||
    str === 'no' ||
    str === 'n' ||
    str === 'false' ||
    str === 'pending' ||
    val === false
  ) {
    return 'pending';
  }

  return 'pending';
}

export interface SisuTaskMapping {
  id: string;
  sisu_task_name: string;
  milestone_field: string;
  milestone_table: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SisuUnmatchedTask {
  id: string;
  task_name: string;
  transaction_id: string | null;
  detected_at: string;
  task_payload?: any;
}

export function resolveTcForAgent(agentName: string | null | undefined): { tc_name: string; tc_email: string; tc_id: string } {
  const check = (agentName || '').toLowerCase();
  const KATIE_AGENTS = [
    'amy reid', 'britney rembold', 'erik kean', 'jenette richardson', 
    'joseph bahr', 'josh chapman', 'joshua kiehne', 'luis padilla aparicio', 
    'marissa beatty', 'michael odle', 'robert montenegro', 'ryan reagan', 
    'sebastian rush', 'shawn mcarthur', 'shawn witzemann'
  ];

  if (KATIE_AGENTS.some((a) => check.includes(a))) {
    return {
      tc_name: 'Katie Harold',
      tc_email: 'kathryn@mattsmithrealestategroup.com',
      tc_id: '4e85c640-675c-443f-8284-628f89552ac5',
    };
  }

  return {
    tc_name: 'Ashley Charette',
    tc_email: 'ashley@mattsmithrealestategroup.com',
    tc_id: '4dbc2470-7089-4c1a-8e1d-db9fb1d31a42',
  };
}

/**
 * Normalizes any TC name or email against the active user allowlist (profiles table).
 */
export function normalizeTcEmailFromAllowlist(tcNameOrEmail?: string | null): string {
  if (!tcNameOrEmail) return 'ashley@mattsmithrealestategroup.com';
  const val = tcNameOrEmail.toLowerCase().trim();
  if (val.includes('ashley')) {
    return 'ashley@mattsmithrealestategroup.com';
  }
  if (val.includes('katie') || val.includes('kathryn')) {
    return 'kathryn@mattsmithrealestategroup.com';
  }
  if (val.includes('zack')) {
    return 'zack@mattsmithrealestategroup.com';
  }
  if (val.includes('susan')) {
    return 'susan@mattsmithrealestategroup.com';
  }
  return tcNameOrEmail;
}

