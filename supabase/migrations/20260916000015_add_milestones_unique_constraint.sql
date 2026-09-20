-- Add UNIQUE constraint on (transaction_id, milestone_type) to support upserts
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'milestones_tx_type_unique'
    ) THEN
        ALTER TABLE public.milestones ADD CONSTRAINT milestones_tx_type_unique UNIQUE (transaction_id, milestone_type);
    END IF;
END $$;

