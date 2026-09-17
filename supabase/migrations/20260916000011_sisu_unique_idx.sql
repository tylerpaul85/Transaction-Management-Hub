-- Migration: Add unique index on sisu_transaction_id for clean upserts
-- Date: 2026-09-16

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_sisu_id_unique 
ON public.transactions(sisu_transaction_id) 
WHERE sisu_transaction_id IS NOT NULL;

COMMIT;
