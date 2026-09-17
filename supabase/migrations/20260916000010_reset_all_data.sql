-- Migration: Purge all data from public schema transaction tables to start fresh from scratch
-- Date: 2026-09-16

BEGIN;

-- Truncate all transaction & sync tables cleanly
TRUNCATE TABLE 
    public.milestones,
    public.sync_conflicts,
    public.reconciliation_runs,
    public.digest_log,
    public.sisu_webhook_log,
    public.transactions
CASCADE;

COMMIT;
