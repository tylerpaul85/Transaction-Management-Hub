-- ==============================================================================
-- Migration: Bulletproof Agent RLS & Auto-Link Profiles with Agents Roster
-- Ensures invited agents (e.g. tasha@mattsmithrealestategroup.com) are auto-linked
-- to their verified agent record, can view only their own assigned transactions,
-- and CANNOT view anyone else's transactions.
-- ==============================================================================

-- 1. Ensure all active agents in agents table have a verified profile allowlist entry
INSERT INTO public.profiles (email, name, role, agent_id, active)
SELECT 
  LOWER(a.email),
  a.name,
  'agent'::app_role,
  a.id,
  true
FROM public.agents a
WHERE a.email IS NOT NULL 
  AND a.active = true
ON CONFLICT (email) DO UPDATE 
SET agent_id = EXCLUDED.agent_id,
    name = COALESCE(public.profiles.name, EXCLUDED.name),
    active = true;

-- 2. Link agents.profile_id back to profiles.id where matching email
UPDATE public.agents a
SET profile_id = p.id
FROM public.profiles p
WHERE LOWER(a.email) = LOWER(p.email)
  AND (a.profile_id IS NULL OR a.profile_id != p.id);

-- 3. Robust get_auth_agent_id() function
-- Matches by profile_id, profile.agent_id, or direct email match in agents
CREATE OR REPLACE FUNCTION public.get_auth_agent_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT COALESCE(
      p.agent_id,
      a.id
    )
    FROM public.agents a
    FULL OUTER JOIN public.profiles p 
      ON (a.id = p.agent_id OR LOWER(a.email) = LOWER(p.email))
    WHERE (
      p.id = auth.uid() 
      OR LOWER(p.email) = LOWER(auth.jwt() ->> 'email')
      OR LOWER(a.email) = LOWER(auth.jwt() ->> 'email')
    )
    AND a.active = true
    LIMIT 1;
$$;

-- 4. Tighten Transactions SELECT Policy
-- Ops/Admins can view all transactions.
-- Agents can ONLY view transactions where they are the listing agent, selling agent,
-- or where the transaction's agent_email matches their authenticated email.
DROP POLICY IF EXISTS "Transactions SELECT policy" ON public.transactions;
CREATE POLICY "Transactions SELECT policy"
ON public.transactions
FOR SELECT
TO authenticated
USING (
    public.is_ops_user()
    OR (
      public.get_auth_agent_id() IS NOT NULL 
      AND (
        listing_agent_id = public.get_auth_agent_id()
        OR selling_agent_id = public.get_auth_agent_id()
      )
    )
    OR (
      agent_email IS NOT NULL 
      AND LOWER(agent_email) = LOWER(auth.jwt() ->> 'email')
    )
);

-- 5. Milestones SELECT Policy: Agents can ONLY view milestones of transactions they own
DROP POLICY IF EXISTS "Milestones SELECT policy" ON public.milestones;
CREATE POLICY "Milestones SELECT policy"
ON public.milestones
FOR SELECT
TO authenticated
USING (
    public.is_ops_user()
    OR EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.id = milestones.transaction_id
          AND (
            (public.get_auth_agent_id() IS NOT NULL AND (t.listing_agent_id = public.get_auth_agent_id() OR t.selling_agent_id = public.get_auth_agent_id()))
            OR (t.agent_email IS NOT NULL AND LOWER(t.agent_email) = LOWER(auth.jwt() ->> 'email'))
          )
    )
);
