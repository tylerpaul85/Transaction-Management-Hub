export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OpsRole = 'tc' | 'listing_coordinator' | 'admin';
export type AppRole = 'agent' | 'tc' | 'listing_coordinator' | 'admin';

export type MilestoneType =
  | 'earnest_money'
  | 'inspection_ordered'
  | 'inspection_notice_sent'
  | 'inspection_10day'
  | 'sale_contingency'
  | 'financing_contingency'
  | 'appraisal_ordered'
  | 'appraisal_received'
  | 'appraisal_satisfied'
  | 'insurance_binder'
  | 'title'
  | 'walk_through'
  | 'ctc'
  | 'closing';

export type MilestoneStatus =
  | 'pending'
  | 'ordered'
  | 'notice_sent'
  | 'satisfied'
  | 'complete'
  | 'waived'
  | 'na';

export type MilestoneSource = 'sisu' | 'manual';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          full_name: string | null;
          role: AppRole;
          agent_id: string | null;
          ops_user_id: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          full_name?: string | null;
          role?: AppRole;
          agent_id?: string | null;
          ops_user_id?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          full_name?: string | null;
          role?: AppRole;
          agent_id?: string | null;
          ops_user_id?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      agents: {
        Row: {
          id: string;
          profile_id: string | null;
          name: string;
          email: string;
          phone: string | null;
          sisu_agent_id: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          name: string;
          email: string;
          phone?: string | null;
          sisu_agent_id?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          name?: string;
          email?: string;
          phone?: string | null;
          sisu_agent_id?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      ops_users: {
        Row: {
          id: string;
          profile_id: string | null;
          name: string;
          email: string;
          role: OpsRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          name: string;
          email: string;
          role?: OpsRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          name?: string;
          email?: string;
          role?: OpsRole;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          sisu_transaction_id: string | null;
          status: string;
          property_address: string;
          city: string;
          state?: string;
          zip?: string;
          side: string;
          client_name: string;
          client_phone: string | null;
          other_party_name: string | null;
          other_party_agent: string | null;
          listing_agent_id: string | null;
          selling_agent_id: string | null;
          assigned_tc_id: string | null;
          contract_date: string | null;
          target_closing_date?: string | null;
          flagged_for_review?: boolean;
          price?: number | null;
          list_price?: number | null;
          mls_number?: string | null;
          listing_date?: string | null;
          photography_status?: string | null;
          sign_lockbox_status?: string | null;
          days_on_market?: number | null;
          lender_name?: string | null;
          lender_email?: string | null;
          lender_phone?: string | null;
          loan_type?: string | null;
          title_company?: string | null;
          other_party_email?: string | null;
          other_party_phone?: string | null;
          other_party_brokerage?: string | null;
          custom_fields?: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sisu_transaction_id?: string | null;
          status?: string;
          property_address: string;
          city?: string;
          state?: string;
          zip?: string;
          side?: string;
          client_name: string;
          client_phone?: string | null;
          other_party_name?: string | null;
          other_party_agent?: string | null;
          listing_agent_id?: string | null;
          selling_agent_id?: string | null;
          assigned_tc_id?: string | null;
          contract_date?: string | null;
          target_closing_date?: string | null;
          flagged_for_review?: boolean;
          price?: number | null;
          list_price?: number | null;
          mls_number?: string | null;
          listing_date?: string | null;
          photography_status?: string | null;
          sign_lockbox_status?: string | null;
          days_on_market?: number | null;
          lender_name?: string | null;
          lender_email?: string | null;
          lender_phone?: string | null;
          loan_type?: string | null;
          title_company?: string | null;
          other_party_email?: string | null;
          other_party_phone?: string | null;
          other_party_brokerage?: string | null;
          custom_fields?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sisu_transaction_id?: string | null;
          status?: string;
          property_address?: string;
          city?: string;
          state?: string;
          zip?: string;
          side?: string;
          client_name?: string;
          client_phone?: string | null;
          other_party_name?: string | null;
          other_party_agent?: string | null;
          listing_agent_id?: string | null;
          selling_agent_id?: string | null;
          assigned_tc_id?: string | null;
          contract_date?: string | null;
          target_closing_date?: string | null;
          flagged_for_review?: boolean;
          price?: number | null;
          list_price?: number | null;
          mls_number?: string | null;
          listing_date?: string | null;
          photography_status?: string | null;
          sign_lockbox_status?: string | null;
          days_on_market?: number | null;
          lender_name?: string | null;
          lender_email?: string | null;
          lender_phone?: string | null;
          loan_type?: string | null;
          title_company?: string | null;
          other_party_email?: string | null;
          other_party_phone?: string | null;
          other_party_brokerage?: string | null;
          custom_fields?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      milestones: {
        Row: {
          id: string;
          transaction_id: string;
          milestone_type: MilestoneType;
          target_date: string | null;
          actual_date: string | null;
          status: MilestoneStatus;
          source: MilestoneSource;
          notes: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          milestone_type: MilestoneType;
          target_date?: string | null;
          actual_date?: string | null;
          status?: MilestoneStatus;
          source?: MilestoneSource;
          notes?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          milestone_type?: MilestoneType;
          target_date?: string | null;
          actual_date?: string | null;
          status?: MilestoneStatus;
          source?: MilestoneSource;
          notes?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
      };
      sisu_webhook_log: {
        Row: {
          id: string;
          payload: Json;
          headers: Json | null;
          event_type: string | null;
          transaction_id: string | null;
          received_at: string;
          processed: boolean;
          error: string | null;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          payload: Json;
          headers?: Json | null;
          event_type?: string | null;
          transaction_id?: string | null;
          received_at?: string;
          processed?: boolean;
          error?: string | null;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          payload?: Json;
          headers?: Json | null;
          event_type?: string | null;
          transaction_id?: string | null;
          received_at?: string;
          processed?: boolean;
          error?: string | null;
          processed_at?: string | null;
        };
      };
      sync_conflicts: {
        Row: {
          id: string;
          transaction_id: string;
          sisu_transaction_id: string | null;
          milestone_type: MilestoneType;
          current_manual_value: Json;
          incoming_sisu_value: Json;
          detected_at: string;
          resolved: boolean;
          resolution_action: string | null;
          resolution_notes: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
        };
        Insert: {
          id?: string;
          transaction_id: string;
          sisu_transaction_id?: string | null;
          milestone_type: MilestoneType;
          current_manual_value: Json;
          incoming_sisu_value: Json;
          detected_at?: string;
          resolved?: boolean;
          resolution_action?: string | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Update: {
          id?: string;
          transaction_id?: string;
          sisu_transaction_id?: string | null;
          milestone_type?: MilestoneType;
          current_manual_value?: Json;
          incoming_sisu_value?: Json;
          detected_at?: string;
          resolved?: boolean;
          resolution_action?: string | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
      };
      reconciliation_runs: {
        Row: {
          id: string;
          run_at: string;
          transactions_checked: number;
          transactions_updated: number;
          conflicts_found: number;
          duration_ms: number;
          status: string;
          details: Json | null;
        };
        Insert: {
          id?: string;
          run_at?: string;
          transactions_checked?: number;
          transactions_updated?: number;
          conflicts_found?: number;
          duration_ms?: number;
          status?: string;
          details?: Json | null;
        };
        Update: {
          id?: string;
          run_at?: string;
          transactions_checked?: number;
          transactions_updated?: number;
          conflicts_found?: number;
          duration_ms?: number;
          status?: string;
          details?: Json | null;
        };
      };
      digest_log: {
        Row: {
          id: string;
          agent_id: string;
          sent_at: string;
          transaction_count: number;
          resend_message_id: string | null;
          status: string;
          error: string | null;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          agent_id: string;
          sent_at?: string;
          transaction_count?: number;
          resend_message_id?: string | null;
          status?: string;
          error?: string | null;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          agent_id?: string;
          sent_at?: string;
          transaction_count?: number;
          resend_message_id?: string | null;
          status?: string;
          error?: string | null;
          metadata?: Json | null;
        };
      };
      sisu_task_mappings: {
        Row: {
          id: string;
          sisu_task_name: string;
          milestone_field: string;
          milestone_table: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sisu_task_name: string;
          milestone_field: string;
          milestone_table?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sisu_task_name?: string;
          milestone_field?: string;
          milestone_table?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      sisu_unmatched_tasks: {
        Row: {
          id: string;
          task_name: string;
          transaction_id: string | null;
          detected_at: string;
          task_payload: Json | null;
        };
        Insert: {
          id?: string;
          task_name: string;
          transaction_id?: string | null;
          detected_at?: string;
          task_payload?: Json | null;
        };
        Update: {
          id?: string;
          task_name?: string;
          transaction_id?: string | null;
          detected_at?: string;
          task_payload?: Json | null;
        };
      };
    };
  };
}

export type DbProfile = Database['public']['Tables']['profiles']['Row'];
export type DbAgent = Database['public']['Tables']['agents']['Row'];
export type DbOpsUser = Database['public']['Tables']['ops_users']['Row'];
export type DbTransaction = Database['public']['Tables']['transactions']['Row'];
export type DbMilestone = Database['public']['Tables']['milestones']['Row'];
export type DbSisuWebhookLog = Database['public']['Tables']['sisu_webhook_log']['Row'];
export type DbSyncConflict = Database['public']['Tables']['sync_conflicts']['Row'];
export type DbReconciliationRun = Database['public']['Tables']['reconciliation_runs']['Row'];
export type DbDigestLog = Database['public']['Tables']['digest_log']['Row'];
export type DbSisuTaskMapping = Database['public']['Tables']['sisu_task_mappings']['Row'];
export type DbSisuUnmatchedTask = Database['public']['Tables']['sisu_unmatched_tasks']['Row'];


