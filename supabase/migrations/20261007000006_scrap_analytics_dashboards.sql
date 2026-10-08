-- ==============================================================================
-- Migration: Scrap Fall-Through and Market Comparison Dashboards
-- ==============================================================================

-- 1. Remove seeded test cancelled transactions
DELETE FROM public.transactions WHERE LOWER(status) = 'cancelled';

-- 2. Drop Dashboard Tables First (CASCADE to drop dependent RLS policies)
DROP TABLE IF EXISTS public.cancellation_reasons CASCADE;
DROP TABLE IF EXISTS public.transaction_status_history CASCADE;
DROP TABLE IF EXISTS public.lender_aliases CASCADE;
DROP TABLE IF EXISTS public.territory_mappings CASCADE;
DROP TABLE IF EXISTS public.price_bands CASCADE;
DROP TABLE IF EXISTS public.dashboard_role_permissions CASCADE;

-- 3. Drop Analytical RPC Functions & Views
DROP FUNCTION IF EXISTS public.get_fall_through_analytics(DATE, DATE, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_market_comparison_analytics(DATE, DATE, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.resolve_transaction_territory(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.resolve_normalized_lender(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.has_dashboard_access(TEXT) CASCADE;

-- 4. Remove Analytics Columns from transactions table
ALTER TABLE public.transactions
  DROP COLUMN IF EXISTS cancellation_reason_id,
  DROP COLUMN IF EXISTS stage_before_cancelled,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude,
  DROP COLUMN IF EXISTS geocoded_at,
  DROP COLUMN IF EXISTS geocode_status;

-- 5. Restore previous clean purge trigger for released/lost transactions
DROP TRIGGER IF EXISTS trigger_preserve_cancelled_transactions_before_insert ON public.transactions;
DROP TRIGGER IF EXISTS trigger_preserve_cancelled_transactions_before_update ON public.transactions;
DROP TRIGGER IF EXISTS trigger_log_transaction_status_change ON public.transactions;
DROP FUNCTION IF EXISTS public.handle_lost_or_released_transaction_trigger();
DROP FUNCTION IF EXISTS public.log_transaction_status_change();

CREATE OR REPLACE FUNCTION public.purge_released_or_lost_transactions()
RETURNS TRIGGER AS $$
BEGIN
  IF LOWER(COALESCE(NEW.status, '')) IN ('lost', 'released', 'cancelled', 'terminated', 'fell through')
     OR LOWER(COALESCE(NEW.status, '')) LIKE '%lost%'
     OR LOWER(COALESCE(NEW.status, '')) LIKE '%release%'
     OR LOWER(COALESCE(NEW.status, '')) LIKE '%cancel%'
     OR LOWER(COALESCE(NEW.status, '')) LIKE '%terminate%' THEN
    DELETE FROM public.transactions WHERE id = NEW.id;
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_purge_released_transactions_update ON public.transactions;
CREATE TRIGGER trigger_purge_released_transactions_update
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.purge_released_or_lost_transactions();
