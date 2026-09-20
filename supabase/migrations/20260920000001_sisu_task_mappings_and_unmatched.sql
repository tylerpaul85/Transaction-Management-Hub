-- ==============================================================================
-- MSREG Marketing Hub — Sisu Checklist Task-Level Milestone Sync
-- ==============================================================================

-- 1. Ensure 'complete' is an allowed value in milestone_status_enum
DO $$ BEGIN
    ALTER TYPE public.milestone_status_enum ADD VALUE IF NOT EXISTS 'complete';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Sisu Task Mappings Table
CREATE TABLE IF NOT EXISTS public.sisu_task_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sisu_task_name TEXT UNIQUE NOT NULL,
    milestone_field TEXT NOT NULL,
    milestone_table TEXT NOT NULL DEFAULT 'milestones',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create Sisu Unmatched Tasks Table
CREATE TABLE IF NOT EXISTS public.sisu_unmatched_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_name TEXT NOT NULL,
    transaction_id TEXT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    task_payload JSONB NULL
);

-- 4. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_sisu_task_mappings_name ON public.sisu_task_mappings(sisu_task_name);
CREATE INDEX IF NOT EXISTS idx_sisu_task_mappings_active ON public.sisu_task_mappings(active);
CREATE INDEX IF NOT EXISTS idx_sisu_unmatched_tasks_name ON public.sisu_unmatched_tasks(task_name);
CREATE INDEX IF NOT EXISTS idx_sisu_unmatched_tasks_detected ON public.sisu_unmatched_tasks(detected_at DESC);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.sisu_task_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sisu_unmatched_tasks ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS: sisu_task_mappings
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Task mappings viewable by ops and admin" ON public.sisu_task_mappings;
CREATE POLICY "Task mappings viewable by ops and admin"
ON public.sisu_task_mappings
FOR SELECT
TO authenticated
USING (public.is_ops_user());

DROP POLICY IF EXISTS "Task mappings manageable by admin" ON public.sisu_task_mappings;
CREATE POLICY "Task mappings manageable by admin"
ON public.sisu_task_mappings
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- RLS: sisu_unmatched_tasks
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Unmatched tasks viewable by ops and admin" ON public.sisu_unmatched_tasks;
CREATE POLICY "Unmatched tasks viewable by ops and admin"
ON public.sisu_unmatched_tasks
FOR SELECT
TO authenticated
USING (public.is_ops_user());

DROP POLICY IF EXISTS "Unmatched tasks insertable by authenticated and service" ON public.sisu_unmatched_tasks;
CREATE POLICY "Unmatched tasks insertable by authenticated and service"
ON public.sisu_unmatched_tasks
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Unmatched tasks manageable by admin" ON public.sisu_unmatched_tasks;
CREATE POLICY "Unmatched tasks manageable by admin"
ON public.sisu_unmatched_tasks
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 6. Grant Permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sisu_task_mappings TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sisu_unmatched_tasks TO authenticated, service_role;
