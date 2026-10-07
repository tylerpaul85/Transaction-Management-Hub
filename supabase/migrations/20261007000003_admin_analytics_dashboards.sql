-- ==============================================================================
-- Migration: Admin Dashboards (Fall-Through Analysis & Market Comparison)
-- ==============================================================================

-- 1. Extensible Dashboard Role Permissions
CREATE TABLE IF NOT EXISTS public.dashboard_role_permissions (
    dashboard_key TEXT NOT NULL,
    role public.app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (dashboard_key, role)
);

-- Seed initial admin-only access
INSERT INTO public.dashboard_role_permissions (dashboard_key, role)
VALUES 
    ('fall_through', 'admin'::public.app_role),
    ('market_comparison', 'admin'::public.app_role)
ON CONFLICT (dashboard_key, role) DO NOTHING;

-- Extensible security check function: checks if active profile has assigned role for dashboard
CREATE OR REPLACE FUNCTION public.has_dashboard_access(target_dashboard_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.dashboard_role_permissions drp
        JOIN public.profiles pr ON pr.role = drp.role
        WHERE drp.dashboard_key = target_dashboard_key
          AND (pr.id = auth.uid() OR LOWER(pr.email) = LOWER(auth.jwt() ->> 'email'))
          AND pr.active = true
    );
$$;

GRANT EXECUTE ON FUNCTION public.has_dashboard_access(TEXT) TO authenticated, service_role;

-- 2. Retire Hard Auto-Purge Triggers & Preserve Cancelled / Lost Transactions
CREATE OR REPLACE FUNCTION public.handle_lost_or_released_transaction_trigger()
RETURNS TRIGGER AS $$
DECLARE
  stat text;
BEGIN
  stat := LOWER(COALESCE(NEW.status, ''));
  -- If transaction is marked as cancelled, lost, terminated, mutual release, or fell through,
  -- preserve it as 'cancelled' instead of deleting so fall-through analytics can track it.
  IF stat = 'lost' OR stat LIKE '%lost%' OR
     stat LIKE '%release%' OR
     stat LIKE '%cancel%' OR
     stat LIKE '%terminate%' OR
     stat LIKE '%fell through%' THEN
    NEW.status := 'cancelled';
    IF TG_OP = 'UPDATE' AND OLD.status IS NOT NULL AND LOWER(OLD.status) != 'cancelled' THEN
      NEW.stage_before_cancelled := COALESCE(OLD.stage_before_cancelled, OLD.status);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_purge_released_transactions_insert ON public.transactions;
DROP TRIGGER IF EXISTS trigger_purge_released_transactions_update ON public.transactions;

CREATE TRIGGER trigger_preserve_cancelled_transactions_before_insert
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_lost_or_released_transaction_trigger();

CREATE TRIGGER trigger_preserve_cancelled_transactions_before_update
BEFORE UPDATE OF status ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_lost_or_released_transaction_trigger();

-- 3. Cancellation Reasons Table
CREATE TABLE IF NOT EXISTS public.cancellation_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reason TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'General',
    description TEXT,
    display_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.cancellation_reasons (reason, category, display_order)
VALUES
    ('Inspection / Major Repair Defects', 'Inspection', 1),
    ('Financing / Loan Commitment Denial', 'Financing', 2),
    ('Appraisal Shortfall / Valuation Gap', 'Appraisal', 3),
    ('Buyer Remorse / Changed Mind', 'Buyer Side', 4),
    ('Title Defect / Survey Issue', 'Title / Legal', 5),
    ('Seller Default / Home Uninhabitable', 'Seller Side', 6),
    ('Contingency Home Sale Failed', 'Contingency', 7),
    ('Job Loss / Employment Change', 'Financing', 8),
    ('Mutual Agreement / Unknown', 'Other', 9)
ON CONFLICT (reason) DO NOTHING;

-- 4. Status Transition History Tracking
CREATE TABLE IF NOT EXISTS public.transaction_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    from_stage TEXT,
    to_stage TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    changed_by TEXT,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_tx_status_history_tx_id ON public.transaction_status_history(transaction_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_transaction_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.transaction_status_history (
      transaction_id,
      from_status,
      to_status,
      from_stage,
      to_stage,
      changed_at,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      OLD.stage_before_cancelled,
      NEW.stage_before_cancelled,
      now(),
      COALESCE(auth.jwt() ->> 'email', 'system')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_transaction_status_change ON public.transactions;
CREATE TRIGGER trigger_log_transaction_status_change
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.log_transaction_status_change();

-- 5. Lender Aliases Table
CREATE TABLE IF NOT EXISTS public.lender_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_name TEXT NOT NULL UNIQUE,
    canonical_name TEXT NOT NULL,
    is_cash_or_none BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lender_aliases_raw ON public.lender_aliases(raw_name);

INSERT INTO public.lender_aliases (raw_name, canonical_name, is_cash_or_none)
VALUES
    ('Nick Matzorkis', 'Nick Matzorkis', false),
    ('Nick Mazorkis', 'Nick Matzorkis', false),
    ('Loree Jones', 'Loree Jones', false),
    ('Loree', 'Loree Jones', false),
    ('Chris Morrow', 'Chris Morrow', false),
    ('Dusten Reagan', 'Dusten Reagan', false),
    ('Erin Adamson', 'Erin Adamson', false),
    ('Brenn Bartz', 'Brenn Bartz', false),
    ('cash', 'Cash (No Lender)', true),
    ('Cash', 'Cash (No Lender)', true),
    ('None', 'Cash (No Lender)', true),
    ('N/A', 'Cash (No Lender)', true),
    ('NA', 'Cash (No Lender)', true),
    ('TBD', 'TBD / Pending Assignment', false)
ON CONFLICT (raw_name) DO NOTHING;

-- 6. Territory Mappings Table
CREATE TABLE IF NOT EXISTS public.territory_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    territory_name TEXT NOT NULL,
    zip TEXT,
    city TEXT,
    state TEXT NOT NULL DEFAULT 'MO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_territory_mappings_zip ON public.territory_mappings(zip);
CREATE INDEX IF NOT EXISTS idx_territory_mappings_city ON public.territory_mappings(LOWER(city));

-- Seed verified initial mappings for the 4 core territories
INSERT INTO public.territory_mappings (territory_name, zip, city)
VALUES
    -- Rolla
    ('Rolla', '65401', 'Rolla'),
    ('Rolla', '65402', 'Rolla'),
    ('Rolla', NULL, 'Rolla'),
    ('Rolla', '65559', 'St James'),
    ('Rolla', '65550', 'Newburg'),
    -- St. Robert
    ('St. Robert', '65584', 'St Robert'),
    ('St. Robert', '65584', 'St. Robert'),
    ('St. Robert', NULL, 'St Robert'),
    ('St. Robert', NULL, 'St. Robert'),
    -- Waynesville
    ('Waynesville', '65583', 'Waynesville'),
    ('Waynesville', NULL, 'Waynesville'),
    -- Lake of the Ozarks (spans Camden, Miller, Morgan counties)
    ('Lake of the Ozarks', '65020', 'Camdenton'),
    ('Lake of the Ozarks', '65065', 'Osage Beach'),
    ('Lake of the Ozarks', '65049', 'Lake Ozark'),
    ('Lake of the Ozarks', '65079', 'Sunrise Beach'),
    ('Lake of the Ozarks', '65026', 'Eldon'),
    ('Lake of the Ozarks', '65052', 'Linn Creek'),
    ('Lake of the Ozarks', '65037', 'Gravois Mills'),
    ('Lake of the Ozarks', '65072', 'Rocky Mount'),
    ('Lake of the Ozarks', NULL, 'Camdenton'),
    ('Lake of the Ozarks', NULL, 'Osage Beach'),
    ('Lake of the Ozarks', NULL, 'Lake Ozark'),
    ('Lake of the Ozarks', NULL, 'Sunrise Beach'),
    ('Lake of the Ozarks', NULL, 'Eldon'),
    ('Lake of the Ozarks', NULL, 'Linn Creek'),
    ('Lake of the Ozarks', NULL, 'Gravois Mills'),
    ('Lake of the Ozarks', NULL, 'Rocky Mount')
ON CONFLICT DO NOTHING;

-- 7. Configurable Price Bands Table
CREATE TABLE IF NOT EXISTS public.price_bands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    min_price NUMERIC NOT NULL DEFAULT 0,
    max_price NUMERIC, -- NULL means infinity (e.g. $500k+)
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.price_bands (label, min_price, max_price, display_order)
VALUES
    ('Under $150k', 0, 150000, 1),
    ('$150k - $250k', 150000, 250000, 2),
    ('$250k - $350k', 250000, 350000, 3),
    ('$350k - $500k', 350000, 500000, 4),
    ('$500k+', 500000, NULL, 5)
ON CONFLICT DO NOTHING;

-- 8. Add Required Analytics & Geocoding Columns to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS cancellation_reason_id UUID REFERENCES public.cancellation_reasons(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS stage_before_cancelled TEXT NULL,
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION NULL,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION NULL,
ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS geocode_status TEXT NULL DEFAULT 'pending';

-- 9. One-time backfill of closed_date from custom_fields or target_closing_date
UPDATE public.transactions
SET closed_date = COALESCE(
    closed_date,
    CASE 
        WHEN (custom_fields->>'closed_date') ~ '^\d{4}-\d{2}-\d{2}' 
        THEN (custom_fields->>'closed_date')::date 
        ELSE NULL 
    END,
    target_closing_date
)
WHERE status = 'Closed' AND closed_date IS NULL;

-- 10. Enable Row Level Security (RLS) on new admin tables
ALTER TABLE public.dashboard_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cancellation_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lender_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_bands ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow access ONLY to users with corresponding dashboard permissions or admins)
DROP POLICY IF EXISTS "Admin only dashboard permissions" ON public.dashboard_role_permissions;
CREATE POLICY "Admin only dashboard permissions"
ON public.dashboard_role_permissions
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Dashboard access for cancellation reasons" ON public.cancellation_reasons;
CREATE POLICY "Dashboard access for cancellation reasons"
ON public.cancellation_reasons
FOR ALL
TO authenticated
USING (public.has_dashboard_access('fall_through') OR public.is_admin())
WITH CHECK (public.has_dashboard_access('fall_through') OR public.is_admin());

DROP POLICY IF EXISTS "Dashboard access for status history" ON public.transaction_status_history;
CREATE POLICY "Dashboard access for status history"
ON public.transaction_status_history
FOR ALL
TO authenticated
USING (public.has_dashboard_access('fall_through') OR public.is_admin())
WITH CHECK (public.has_dashboard_access('fall_through') OR public.is_admin());

DROP POLICY IF EXISTS "Dashboard access for lender aliases" ON public.lender_aliases;
CREATE POLICY "Dashboard access for lender aliases"
ON public.lender_aliases
FOR ALL
TO authenticated
USING (public.has_dashboard_access('fall_through') OR public.is_admin())
WITH CHECK (public.has_dashboard_access('fall_through') OR public.is_admin());

DROP POLICY IF EXISTS "Dashboard access for territory mappings" ON public.territory_mappings;
CREATE POLICY "Dashboard access for territory mappings"
ON public.territory_mappings
FOR ALL
TO authenticated
USING (public.has_dashboard_access('market_comparison') OR public.is_admin())
WITH CHECK (public.has_dashboard_access('market_comparison') OR public.is_admin());

DROP POLICY IF EXISTS "Dashboard access for price bands" ON public.price_bands;
CREATE POLICY "Dashboard access for price bands"
ON public.price_bands
FOR ALL
TO authenticated
USING (public.has_dashboard_access('fall_through') OR public.is_admin())
WITH CHECK (public.has_dashboard_access('fall_through') OR public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cancellation_reasons TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_status_history TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lender_aliases TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.territory_mappings TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_bands TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_role_permissions TO authenticated, service_role;
