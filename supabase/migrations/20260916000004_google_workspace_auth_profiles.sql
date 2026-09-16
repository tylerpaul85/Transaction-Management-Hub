-- ==============================================================================
-- MSREG Marketing Hub — Google Workspace Auth & Admin Allowlist Profiles
-- ==============================================================================

-- 1. Ensure profiles table supports admin pre-provisioning with active status
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS ops_user_id UUID REFERENCES public.ops_users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Update existing profiles with name if missing
UPDATE public.profiles SET name = full_name WHERE name IS NULL AND full_name IS NOT NULL;

-- 2. Create unique constraint on email for quick lookup
DO $$ BEGIN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
EXCEPTION
    WHEN duplicate_table OR duplicate_object THEN null;
END $$;

-- 3. Indexes for fast authentication allowlist checks
CREATE INDEX IF NOT EXISTS idx_profiles_email_active ON public.profiles(email, active);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 4. Row-Level Security Policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view their own profile by email or user ID
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
    email = (auth.jwt() ->> 'email')
    OR id = auth.uid()
    OR public.is_ops_user()
    OR public.is_admin()
);

-- Only Admins can insert new profiles (Add User flow)
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- Only Admins can update profiles (e.g. deactivate user or change role)
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Only Admins can delete profiles
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (public.is_admin());

-- 5. Helper function for auth verification
CREATE OR REPLACE FUNCTION public.check_user_access(user_email TEXT)
RETURNS TABLE (
    id UUID,
    email TEXT,
    name TEXT,
    role app_role,
    agent_id UUID,
    ops_user_id UUID,
    active BOOLEAN
) 
LANGUAGE sql 
SECURITY DEFINER
AS $$
    SELECT p.id, p.email, COALESCE(p.name, p.full_name, p.email) as name, p.role, p.agent_id, p.ops_user_id, p.active
    FROM public.profiles p
    WHERE LOWER(p.email) = LOWER(user_email)
    LIMIT 1;
$$;
