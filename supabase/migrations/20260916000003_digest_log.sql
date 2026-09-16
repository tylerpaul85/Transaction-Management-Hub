-- ==============================================================================
-- MSREG Marketing Hub — Weekly Agent Digest Log & Scheduling
-- ==============================================================================

-- 1. Digest Log Table
CREATE TABLE IF NOT EXISTS public.digest_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    transaction_count INTEGER NOT NULL DEFAULT 0,
    resend_message_id TEXT NULL,
    status TEXT NOT NULL DEFAULT 'sent', -- 'sent' | 'failed' | 'skipped'
    error TEXT NULL,
    metadata JSONB NULL -- stores array of transaction IDs and summary
);

-- 2. Indexes for fast query & verification
CREATE INDEX IF NOT EXISTS idx_digest_log_agent_sent ON public.digest_log(agent_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_digest_log_sent_at ON public.digest_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_digest_log_resend_id ON public.digest_log(resend_message_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.digest_log ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS: digest_log
-- ------------------------------------------------------------------------------

-- Agents can view their own digest delivery records
DROP POLICY IF EXISTS "Agents can view their own digest logs" ON public.digest_log;
CREATE POLICY "Agents can view their own digest logs"
ON public.digest_log
FOR SELECT
TO authenticated
USING (
    agent_id IN (
        SELECT a.id FROM public.agents a
        WHERE a.profile_id = auth.uid()
           OR a.email = auth.jwt() ->> 'email'
    )
);

-- Ops users (TCs, Listing Coordinators) and Admins can view all digest logs
DROP POLICY IF EXISTS "Ops and Admin can view all digest logs" ON public.digest_log;
CREATE POLICY "Ops and Admin can view all digest logs"
ON public.digest_log
FOR SELECT
TO authenticated
USING (
    public.is_ops_user() OR public.is_admin()
);

-- Admin and service role can insert and manage digest logs
DROP POLICY IF EXISTS "Admin and service role can manage digest logs" ON public.digest_log;
CREATE POLICY "Admin and service role can manage digest logs"
ON public.digest_log
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 4. Supabase pg_cron Schedule Setup (Runs every Monday at 7:00 AM Central / 12:00 UTC)
-- Note: Enable the pg_cron & pg_net extensions in Supabase Dashboard -> Database -> Extensions.
-- ------------------------------------------------------------------------------
-- Example pg_cron invocation:
-- SELECT cron.schedule(
--   'weekly-agent-digest-monday-7am',
--   '0 7 * * 1', -- Every Monday at 7:00 AM
--   $$
--   SELECT
--     net.http_post(
--         url:=(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/weekly-agent-digest',
--         headers:=jsonb_build_object(
--             'Content-Type', 'application/json',
--             'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
--         ),
--         body:=jsonb_build_object('triggered_by', 'pg_cron_monday_7am')
--     ) as request_id;
--   $$
-- );
