-- ==============================================================================
-- MSREG Marketing Hub — Fix RLS Helper Functions & Sync Profiles IDs
-- ==============================================================================

-- 1. Sync profiles.id with auth.users.id for all existing accounts
UPDATE public.profiles p
SET id = u.id
FROM auth.users u
WHERE LOWER(p.email) = LOWER(u.email)
  AND p.id != u.id;

-- 2. Update is_ops_user() to check email fallback alongside auth.uid()
CREATE OR REPLACE FUNCTION public.is_ops_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE (id = auth.uid() OR LOWER(email) = LOWER(auth.jwt() ->> 'email'))
          AND role IN ('tc', 'listing_coordinator', 'admin')
          AND active = true
    );
$$;

-- 3. Update is_admin() to check email fallback alongside auth.uid()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE (id = auth.uid() OR LOWER(email) = LOWER(auth.jwt() ->> 'email'))
          AND role = 'admin'
          AND active = true
    );
$$;

-- 4. Update get_auth_agent_id() to check profiles first
CREATE OR REPLACE FUNCTION public.get_auth_agent_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT a.id FROM public.agents a
    JOIN public.profiles p ON (a.profile_id = p.id OR LOWER(a.email) = LOWER(p.email))
    WHERE (p.id = auth.uid() OR LOWER(p.email) = LOWER(auth.jwt() ->> 'email'))
    LIMIT 1;
$$;
