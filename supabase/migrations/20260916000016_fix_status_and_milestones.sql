-- Migration: Drop any legacy status check constraints and ensure milestones table unique constraint
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_transaction_status;
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;

-- Ensure milestones table has unique constraint on (transaction_id, milestone_type) for ON CONFLICT upserts
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'milestones_tx_type_unique'
    ) THEN
        ALTER TABLE public.milestones ADD CONSTRAINT milestones_tx_type_unique UNIQUE (transaction_id, milestone_type);
    END IF;
END $$;
