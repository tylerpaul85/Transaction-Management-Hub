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
  custom_fields?: Record<string, any> | null;
  milestones: OpsMilestone[];
}

export const MILESTONE_ORDER: {
  type: MilestoneType;
  label: string;
  shortLabel: string;
  subTypes?: MilestoneType[];
}[] = [
  { type: 'earnest_money', label: 'Earnest Money', shortLabel: 'Earnest Money' },
  {
    type: 'inspection_10day',
    label: 'Inspection',
    shortLabel: 'Inspection',
    subTypes: ['inspection_ordered', 'inspection_notice_sent', 'inspection_10day'],
  },
  { type: 'financing_contingency', label: 'Financing', shortLabel: 'Financing' },
  {
    type: 'appraisal_satisfied',
    label: 'Appraisal',
    shortLabel: 'Appraisal',
    subTypes: ['appraisal_received', 'appraisal_satisfied'],
  },
  { type: 'title', label: 'Title Clearance', shortLabel: 'Title' },
  { type: 'cds_obtained', label: 'CDs Obtained', shortLabel: 'CDs Obtained' },
  { type: 'ctc', label: 'Clear to Close', shortLabel: 'Clear to Close' },
  { type: 'closing_scheduled', label: 'Closing Scheduled', shortLabel: 'Closing Scheduled' },
  { type: 'walk_through', label: 'Walkthrough', shortLabel: 'Walkthrough' },
];

export const ALL_MILESTONES_CONFIG: {
  type: MilestoneType;
  label: string;
  shortLabel: string;
  description: string;
  isSubItem?: boolean;
  parentGroup?: 'inspection' | 'appraisal' | 'closing';
}[] = [
  { type: 'earnest_money', label: 'Earnest Money Deposited', shortLabel: 'Earnest Money', description: 'Initial escrow deposit slip and verification' },
  { type: 'inspection_ordered', label: 'Inspection Ordered', shortLabel: 'Inspection Ordered', description: 'Home inspector booked by buyer/agent', isSubItem: true, parentGroup: 'inspection' },
  { type: 'inspection_notice_sent', label: 'Inspection Notice Sent', shortLabel: 'Notice Sent', description: 'Inspection report and amendment notice delivered', isSubItem: true, parentGroup: 'inspection' },
  { type: 'inspection_10day', label: 'Inspection Satisfied', shortLabel: 'Inspection Satisfied', description: 'Contractual inspection deadline and repair resolution', isSubItem: true, parentGroup: 'inspection' },
  { type: 'appraisal_received', label: 'Appraisal Received', shortLabel: 'Appraisal Received', description: 'Appraisal report delivered to buyer/lender', isSubItem: true, parentGroup: 'appraisal' },
  { type: 'financing_contingency', label: 'Financing / Loan Commitment', shortLabel: 'Financing / Loan', description: 'Mortgage lender approval condition deadline' },
  { type: 'appraisal_satisfied', label: 'Appraisal Satisfied', shortLabel: 'Appraisal Satisfied', description: 'Appraisal valuation condition met', isSubItem: true, parentGroup: 'appraisal' },
  { type: 'title', label: 'Title Commitment & Clearance', shortLabel: 'Title Clearance', description: 'Preliminary title Schedule B review and clearance' },
  { type: 'cds_obtained', label: 'CDs Obtained', shortLabel: 'CDs Obtained', description: 'Closing Disclosures obtained and acknowledged' },
  { type: 'ctc', label: 'Clear-to-Close (CTC)', shortLabel: 'Clear to Close', description: 'Final underwriter loan clearance' },
  { type: 'closing_scheduled', label: 'Closing Scheduled', shortLabel: 'Closing Scheduled', description: 'Settlement time and location confirmed with title and clients' },
  { type: 'walk_through', label: 'Final Walkthrough', shortLabel: 'Walkthrough', description: 'Pre-closing property inspection' },
  { type: 'insurance_binder', label: 'Insurance Binder Obtained', shortLabel: 'Insurance Binder', description: 'Homeowners insurance binder delivered to lender/title' },
];

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
      tc_email: 'katie.harold@mattsmithrealestategroup.com',
      tc_id: '5580daa6-415d-4385-986a-69bc94421c0c',
    };
  }

  return {
    tc_name: 'Ashley Charette',
    tc_email: 'ashley.charette@mattsmithrealestategroup.com',
    tc_id: 'f4436dcc-4d52-4a26-af80-05096b76067e',
  };
}

