-- Migration: Allow all authenticated and anon users to view reconciliation runs
-- Date: 2026-09-16

BEGIN;

DROP POLICY IF EXISTS "Reconciliation runs viewable by ops and admin" ON public.reconciliation_runs;
DROP POLICY IF EXISTS "Reconciliation runs viewable by all" ON public.reconciliation_runs;

CREATE POLICY "Reconciliation runs viewable by all"
ON public.reconciliation_runs
FOR SELECT
TO authenticated, anon
USING (true);

COMMIT;
