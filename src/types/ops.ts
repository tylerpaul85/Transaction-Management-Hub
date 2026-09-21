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
  { type: 'earnest_money', label: 'Earnest Money Deposit', shortLabel: 'EMD' },
  {
    type: 'inspection_10day',
    label: 'Home Inspection',
    shortLabel: 'INSP',
    subTypes: ['inspection_ordered', 'inspection_10day'],
  },
  { type: 'financing_contingency', label: 'Loan Commitment', shortLabel: 'FIN' },
  {
    type: 'appraisal_satisfied',
    label: 'Appraisal',
    shortLabel: 'APP',
    subTypes: ['appraisal_received', 'appraisal_satisfied'],
  },
  { type: 'insurance_binder', label: 'Insurance Binder', shortLabel: 'INS' },
  { type: 'title', label: 'Title Clearance', shortLabel: 'TITLE' },
  { type: 'ctc', label: 'Clear to Close', shortLabel: 'CTC' },
  { type: 'walk_through', label: 'Final Walkthrough', shortLabel: 'WALK' },
];

export const ALL_MILESTONES_CONFIG: {
  type: MilestoneType;
  label: string;
  description: string;
  isSubItem?: boolean;
  parentGroup?: 'inspection' | 'appraisal';
}[] = [
  { type: 'earnest_money', label: 'Earnest Money Deposited', description: 'Initial escrow deposit slip and verification' },
  { type: 'inspection_ordered', label: 'Inspection Ordered', description: 'Home inspector booked by buyer/agent', isSubItem: true, parentGroup: 'inspection' },
  { type: 'inspection_10day', label: 'Inspection Satisfied', description: 'Contractual inspection deadline and repair resolution', isSubItem: true, parentGroup: 'inspection' },
  { type: 'financing_contingency', label: 'Financing / Loan Commitment', description: 'Mortgage lender approval condition deadline' },
  { type: 'appraisal_received', label: 'Appraisal Received', description: 'Appraisal report delivered to buyer/lender', isSubItem: true, parentGroup: 'appraisal' },
  { type: 'appraisal_satisfied', label: 'Appraisal Satisfied', description: 'Appraisal valuation condition met', isSubItem: true, parentGroup: 'appraisal' },
  { type: 'insurance_binder', label: 'Insurance Binder Obtained', description: 'Homeowners insurance binder delivered to lender/title' },
  { type: 'title', label: 'Title Commitment & Clearance', description: 'Preliminary title Schedule B review and clearance' },
  { type: 'ctc', label: 'Clear-to-Close (CTC)', description: 'Final underwriter loan clearance' },
  { type: 'walk_through', label: 'Final Walkthrough', description: 'Pre-closing property inspection' },
];

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

