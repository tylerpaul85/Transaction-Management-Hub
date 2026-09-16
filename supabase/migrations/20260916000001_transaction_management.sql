-- ==============================================================================
-- MSREG Marketing Hub — Transaction Management Module Schema & Access Control
-- ==============================================================================

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE ops_role AS ENUM ('tc', 'listing_coordinator', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('agent', 'tc', 'listing_coordinator', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE milestone_type_enum AS ENUM (
        'earnest_money',
        'inspection_ordered',
        'inspection_notice_sent',
        'inspection_10day',
        'sale_contingency',
        'financing_contingency',
        'appraisal_ordered',
        'appraisal_received',
        'appraisal_satisfied',
        'title',
        'walk_through',
        'ctc',
        'closing'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE milestone_status_enum AS ENUM (
        'pending',
        'ordered',
        'notice_sent',
        'satisfied',
        'waived',
        'na'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE milestone_source_enum AS ENUM ('sisu', 'manual');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Profiles Table (extends Supabase auth.users with app role)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role app_role NOT NULL DEFAULT 'agent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Agents Table
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    sisu_agent_id TEXT,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Ops Users Table
CREATE TABLE IF NOT EXISTS public.ops_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role ops_role NOT NULL DEFAULT 'tc',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sisu_transaction_id TEXT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    property_address TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Chicago',
    side TEXT NOT NULL DEFAULT 'buyer',
    client_name TEXT NOT NULL,
    client_phone TEXT,
    other_party_name TEXT,
    other_party_agent TEXT,
    listing_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    selling_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    assigned_tc_id UUID REFERENCES public.ops_users(id) ON DELETE SET NULL,
    contract_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Milestones Table
CREATE TABLE IF NOT EXISTS public.milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    milestone_type milestone_type_enum NOT NULL,
    target_date DATE,
    actual_date DATE,
    status milestone_status_enum NOT NULL DEFAULT 'pending',
    source milestone_source_enum NOT NULL DEFAULT 'manual',
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 7. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_listing_agent ON public.transactions(listing_agent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_selling_agent ON public.transactions(selling_agent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_assigned_tc ON public.transactions(assigned_tc_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_milestones_transaction_id ON public.milestones(transaction_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON public.milestones(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ==============================================================================
-- Row-Level Security (RLS) Helper Functions
-- ==============================================================================

-- Get the caller's role from profiles
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Check if caller is an Ops User (tc, listing_coordinator, admin)
CREATE OR REPLACE FUNCTION public.is_ops_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IN ('tc', 'listing_coordinator', 'admin')
    );
$$;

-- Check if caller is an Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role = 'admin'
    );
$$;

-- Get the agent id corresponding to the authenticated user
CREATE OR REPLACE FUNCTION public.get_auth_agent_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT a.id FROM public.agents a
    WHERE a.profile_id = auth.uid()
       OR a.email = auth.jwt() ->> 'email'
    LIMIT 1;
$$;

-- ==============================================================================
-- Enable Row Level Security (RLS)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- RLS: public.profiles
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles are readable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles are readable by authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid() OR public.is_admin());

-- ------------------------------------------------------------------------------
-- RLS: public.agents
-- ------------------------------------------------------------------------------
-- All authenticated users can view agents (for directory and dropdown assignment)
DROP POLICY IF EXISTS "Agents viewable by authenticated users" ON public.agents;
CREATE POLICY "Agents viewable by authenticated users"
ON public.agents
FOR SELECT
TO authenticated
USING (true);

-- Only Admin can INSERT / UPDATE / DELETE agents
DROP POLICY IF EXISTS "Agents manageable by admin" ON public.agents;
CREATE POLICY "Agents manageable by admin"
ON public.agents
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- RLS: public.ops_users
-- ------------------------------------------------------------------------------
-- All authenticated users can view ops users (for TC assignment)
DROP POLICY IF EXISTS "Ops users viewable by authenticated users" ON public.ops_users;
CREATE POLICY "Ops users viewable by authenticated users"
ON public.ops_users
FOR SELECT
TO authenticated
USING (true);

-- Only Admin can INSERT / UPDATE / DELETE ops_users
DROP POLICY IF EXISTS "Ops users manageable by admin" ON public.ops_users;
CREATE POLICY "Ops users manageable by admin"
ON public.ops_users
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- RLS: public.transactions
-- ------------------------------------------------------------------------------
-- 1. SELECT Policy:
--    - Ops users (tc, listing_coordinator, admin) see all transactions.
--    - Agents only see transactions where they are listing_agent_id OR selling_agent_id.
DROP POLICY IF EXISTS "Transactions SELECT policy" ON public.transactions;
CREATE POLICY "Transactions SELECT policy"
ON public.transactions
FOR SELECT
TO authenticated
USING (
    public.is_ops_user()
    OR listing_agent_id = public.get_auth_agent_id()
    OR selling_agent_id = public.get_auth_agent_id()
);

-- 2. INSERT / UPDATE Policy:
--    - Ops users (tc, listing_coordinator, admin) can insert and update transactions.
DROP POLICY IF EXISTS "Transactions INSERT policy for ops" ON public.transactions;
CREATE POLICY "Transactions INSERT policy for ops"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (public.is_ops_user());

DROP POLICY IF EXISTS "Transactions UPDATE policy for ops" ON public.transactions;
CREATE POLICY "Transactions UPDATE policy for ops"
ON public.transactions
FOR UPDATE
TO authenticated
USING (public.is_ops_user())
WITH CHECK (public.is_ops_user());

-- 3. DELETE Policy:
--    - Only Admins can delete transactions
DROP POLICY IF EXISTS "Transactions DELETE policy for admin" ON public.transactions;
CREATE POLICY "Transactions DELETE policy for admin"
ON public.transactions
FOR DELETE
TO authenticated
USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- RLS: public.milestones
-- ------------------------------------------------------------------------------
-- 1. SELECT Policy:
--    - Ops users see all milestones.
--    - Agents can SELECT (not edit) milestones related to transactions they have access to.
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
              t.listing_agent_id = public.get_auth_agent_id()
              OR t.selling_agent_id = public.get_auth_agent_id()
          )
    )
);

-- 2. INSERT / UPDATE / DELETE Policy:
--    - ops_users (tc, listing_coordinator, admin) can INSERT and UPDATE all milestones.
--    - Agents have NO edit permissions on milestones.
DROP POLICY IF EXISTS "Milestones INSERT policy for ops" ON public.milestones;
CREATE POLICY "Milestones INSERT policy for ops"
ON public.milestones
FOR INSERT
TO authenticated
WITH CHECK (public.is_ops_user());

DROP POLICY IF EXISTS "Milestones UPDATE policy for ops" ON public.milestones;
CREATE POLICY "Milestones UPDATE policy for ops"
ON public.milestones
FOR UPDATE
TO authenticated
USING (public.is_ops_user())
WITH CHECK (public.is_ops_user());

DROP POLICY IF EXISTS "Milestones DELETE policy for ops" ON public.milestones;
CREATE POLICY "Milestones DELETE policy for ops"
ON public.milestones
FOR DELETE
TO authenticated
USING (public.is_ops_user());

-- ==============================================================================
-- Automatic updated_at Trigger
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_milestones_updated_at ON public.milestones;
CREATE TRIGGER trg_milestones_updated_at
BEFORE UPDATE ON public.milestones
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
