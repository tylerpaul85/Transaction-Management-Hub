-- Auto-purge lost transactions completely
-- Ensures any transaction with status 'lost' is immediately deleted or prevented from insertion

CREATE OR REPLACE FUNCTION public.handle_lost_transaction_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- If transaction status is updated to lost, delete it completely
  IF TG_OP = 'UPDATE' THEN
    IF LOWER(COALESCE(NEW.status, '')) = 'lost' OR LOWER(COALESCE(NEW.status, '')) LIKE '%lost%' THEN
      DELETE FROM public.transactions WHERE id = NEW.id;
      RETURN NULL;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    -- If inserted with lost, cancel insertion completely
    IF LOWER(COALESCE(NEW.status, '')) = 'lost' OR LOWER(COALESCE(NEW.status, '')) LIKE '%lost%' THEN
      RETURN NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_purge_lost_transactions_insert ON public.transactions;
DROP TRIGGER IF EXISTS trigger_purge_lost_transactions_update ON public.transactions;

CREATE TRIGGER trigger_purge_lost_transactions_insert
BEFORE INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_lost_transaction_trigger();

CREATE TRIGGER trigger_purge_lost_transactions_update
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW
WHEN (LOWER(COALESCE(NEW.status, '')) = 'lost' OR LOWER(COALESCE(NEW.status, '')) LIKE '%lost%')
EXECUTE FUNCTION public.handle_lost_transaction_trigger();

-- Clean up any remaining lost transactions
DELETE FROM public.transactions WHERE LOWER(status) = 'lost' OR LOWER(status) LIKE '%lost%';
