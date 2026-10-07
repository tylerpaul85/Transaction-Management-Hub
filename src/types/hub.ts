export type RoadmapTabType =
  | 'new_listing'
  | 'under_contract'
  | 'listing_guide'
  | 'selling_guide'
  | 'buyer_roadmap'
  | 'buyer_guide';

export type StepStatus = 'completed' | 'in_progress' | 'pending' | 'locked' | 'waived';

export interface HubRoadmapStep {
  id: string;
  roadmapCategory: RoadmapTabType;
  title: string;
  description?: string;
  status: StepStatus;
  date?: string | null;
  updatedAt?: string | null;
  required?: boolean;
  order: number;
  notes?: string | null;
  approvalData?: {
    approvalStatus: 'pending_tc_approval' | 'approved' | 'changes_requested';
    details: string;
    submittedByName: string;
    submittedByEmail?: string;
    submittedAt: string;
    assignedTcName?: string;
    assignedTcEmail?: string;
    documentLink?: string;
    tcNotes?: string;
    tcReviewedAt?: string;
    tcReviewedBy?: string;
  } | null;
}

export interface HubTeamMember {
  role: 'AGENT' | 'TC' | 'LC' | 'BROKER';
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  initials?: string;
}

export interface HubServicePartner {
  category: 'MORTGAGE' | 'TITLE' | 'INSPECTION' | 'INSURANCE' | 'HOME_WARRANTY';
  companyName: string;
  contactName: string;
  phone?: string;
  email?: string;
  initials?: string;
  statusBadge?: string;
}

export interface HubTransactionRecord {
  id: string;
  sisuId: string;
  createdAt: string;
  agent: HubTeamMember;
  tc?: HubTeamMember;
  status: 'Closed' | 'Active' | 'Pending' | 'Under Contract' | 'Pre-Listing' | 'Coming Soon';
  paymentsDetails?: string;
  roadmapsAppliedCount: number;
  clientFirstName: string;
  clientLastName: string;
  clientFullName: string;
  transactionType: 'Seller' | 'Buyer' | 'Dual';
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  price: number;
  mlsId?: string;
  completionPercentage: number;
  activeRoadmapTab: RoadmapTabType;
  roadmaps: Record<RoadmapTabType, HubRoadmapStep[]>;
  services: HubServicePartner[];
  coopAgent?: HubCoopAgent | null;
}

export interface HubCoopAgent {
  name: string;
  email?: string;
  phone?: string;
  brokerage?: string;
  sideRepresented?: string;
}
