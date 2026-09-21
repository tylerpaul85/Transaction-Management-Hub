-- Migration: Add 'in_progress' to milestone_status_enum, and 'cds_obtained', 'closing_scheduled' to milestone_type_enum
ALTER TYPE milestone_status_enum ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE milestone_type_enum ADD VALUE IF NOT EXISTS 'cds_obtained';
ALTER TYPE milestone_type_enum ADD VALUE IF NOT EXISTS 'closing_scheduled';
