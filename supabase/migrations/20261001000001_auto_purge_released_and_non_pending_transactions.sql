-- Auto-purge mutual releases, signed, and non-pending transactions completely
-- Ensures any transaction with status 'signed' (reverted from pending / mutual release), 'lost', 'mutual release', 'cancelled', 'terminated' is immediately purged from the Hub.

CREATE OR REPLACE FUNCTION public.handle_lost_or_released_transaction_trigger()
RETURNS TRIGGER AS $$
DECLARE
  stat text;
BEGIN
  stat := LOWER(COALESCE(NEW.status, ''));
  -- If transaction status is lost, signed (reverted from pending / mutual release), mutual release, cancelled, terminated, fell through, or expired
  IF stat = 'lost' OR stat LIKE '%lost%' OR
     stat = 'signed' OR stat LIKE '%signed%' OR
     stat LIKE '%release%' OR
     stat LIKE '%cancel%' OR
     stat LIKE '%terminate%' OR
     stat LIKE '%fell through%' OR
     stat LIKE '%expired%' OR
     stat LIKE '%appt%' OR
     stat LIKE '%pipeline%' THEN
    IF TG_OP = 'UPDATE' THEN
      DELETE FROM public.transactions WHERE id = NEW.id;
      RETURN NULL;
    ELSIF TG_OP = 'INSERT' THEN
      -- Cancel insertion completely for non-pending / released transactions
      RETURN NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_purge_lost_transactions_insert ON public.transactions;
DROP TRIGGER IF EXISTS trigger_purge_lost_transactions_update ON public.transactions;
DROP TRIGGER IF EXISTS trigger_purge_released_transactions_insert ON public.transactions;
DROP TRIGGER IF EXISTS trigger_purge_released_transactions_update ON public.transactions;

CREATE TRIGGER trigger_purge_released_transactions_insert
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_lost_or_released_transaction_trigger();

CREATE TRIGGER trigger_purge_released_transactions_update
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_lost_or_released_transaction_trigger();

-- Clean up any remaining non-pending, signed, or released transactions
DELETE FROM public.transactions
WHERE LOWER(COALESCE(status, '')) = 'lost'
   OR LOWER(COALESCE(status, '')) LIKE '%lost%'
   OR LOWER(COALESCE(status, '')) = 'signed'
   OR LOWER(COALESCE(status, '')) LIKE '%signed%'
   OR LOWER(COALESCE(status, '')) LIKE '%release%'
   OR LOWER(COALESCE(status, '')) LIKE '%cancel%'
   OR LOWER(COALESCE(status, '')) LIKE '%terminate%'
   OR LOWER(COALESCE(status, '')) LIKE '%fell through%'
   OR LOWER(COALESCE(status, '')) LIKE '%expired%';

-- Normalize all remaining active contract statuses to 'Pending' so the Hub matches Sisu's exact stage name
UPDATE public.transactions
SET status = 'Pending'
WHERE LOWER(COALESCE(status, '')) LIKE '%under%contract%'
   OR LOWER(COALESCE(status, '')) = 'pending';

