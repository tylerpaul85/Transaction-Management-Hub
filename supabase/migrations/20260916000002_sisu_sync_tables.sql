-- ==============================================================================
-- MSREG Marketing Hub — Sisu Sync, Webhook Logs & Conflict Tracking
-- ==============================================================================

-- 1. Sisu Webhook Ingestion Log Table
CREATE TABLE IF NOT EXISTS public.sisu_webhook_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payload JSONB NOT NULL,
    headers JSONB,
    event_type TEXT,
    transaction_id TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed BOOLEAN NOT NULL DEFAULT false,
    error TEXT NULL,
    processed_at TIMESTAMPTZ NULL
);

-- 2. Sync Conflicts Table (Manual edits preservation log)
CREATE TABLE IF NOT EXISTS public.sync_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
    sisu_transaction_id TEXT,
    milestone_type milestone_type_enum NOT NULL,
    current_manual_value JSONB NOT NULL,
    incoming_sisu_value JSONB NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved BOOLEAN NOT NULL DEFAULT false,
    resolution_action TEXT NULL, -- 'kept_manual' | 'accepted_sisu' | 'dismissed'
    resolution_notes TEXT NULL,
    resolved_at TIMESTAMPTZ NULL,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. Nightly Reconciliation Runs Table
CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    transactions_checked INTEGER NOT NULL DEFAULT 0,
    transactions_updated INTEGER NOT NULL DEFAULT 0,
    conflicts_found INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'completed',
    details JSONB NULL
);

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_sisu_webhook_log_received ON public.sisu_webhook_log(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_sisu_webhook_log_processed ON public.sisu_webhook_log(processed);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_tx_id ON public.sync_conflicts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_sync_conflicts_resolved ON public.sync_conflicts(resolved);
CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_run_at ON public.reconciliation_runs(run_at DESC);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.sisu_webhook_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS: sisu_webhook_log
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Webhook log viewable by ops and admin" ON public.sisu_webhook_log;
CREATE POLICY "Webhook log viewable by ops and admin"
ON public.sisu_webhook_log
FOR SELECT
TO authenticated
USING (public.is_ops_user());

DROP POLICY IF EXISTS "Webhook log manageable by service role and admin" ON public.sisu_webhook_log;
CREATE POLICY "Webhook log manageable by service role and admin"
ON public.sisu_webhook_log
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- RLS: sync_conflicts
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Sync conflicts viewable by ops and admin" ON public.sync_conflicts;
CREATE POLICY "Sync conflicts viewable by ops and admin"
ON public.sync_conflicts
FOR SELECT
TO authenticated
USING (public.is_ops_user());

DROP POLICY IF EXISTS "Sync conflicts resolvable by ops and admin" ON public.sync_conflicts;
CREATE POLICY "Sync conflicts resolvable by ops and admin"
ON public.sync_conflicts
FOR UPDATE
TO authenticated
USING (public.is_ops_user())
WITH CHECK (public.is_ops_user());

DROP POLICY IF EXISTS "Sync conflicts manageable by admin" ON public.sync_conflicts;
CREATE POLICY "Sync conflicts manageable by admin"
ON public.sync_conflicts
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- RLS: reconciliation_runs
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Reconciliation runs viewable by ops and admin" ON public.reconciliation_runs;
CREATE POLICY "Reconciliation runs viewable by ops and admin"
ON public.reconciliation_runs
FOR SELECT
TO authenticated
USING (public.is_ops_user());

DROP POLICY IF EXISTS "Reconciliation runs manageable by admin" ON public.reconciliation_runs;
CREATE POLICY "Reconciliation runs manageable by admin"
ON public.reconciliation_runs
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
