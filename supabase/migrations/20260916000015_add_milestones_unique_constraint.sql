-- Add UNIQUE constraint on (transaction_id, milestone_type) to support upserts
DO $$ BEGIN
    ALTER TABLE public.milestones 
    ADD CONSTRAINT milestones_tx_type_unique UNIQUE (transaction_id, milestone_type);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
