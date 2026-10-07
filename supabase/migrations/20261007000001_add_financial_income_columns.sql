-- Migration: Add financial income columns to public.transactions
-- Supports agent gross paid income, GCI, commission rate, and closed settlement date

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS gross_agent_paid_income NUMERIC NULL,
ADD COLUMN IF NOT EXISTS gci NUMERIC NULL,
ADD COLUMN IF NOT EXISTS commission_rate NUMERIC NULL,
ADD COLUMN IF NOT EXISTS closed_date DATE NULL;

-- Indexes for lightning-fast financial queries
CREATE INDEX IF NOT EXISTS idx_transactions_closed_date ON public.transactions(closed_date);
CREATE INDEX IF NOT EXISTS idx_transactions_gross_agent_income ON public.transactions(gross_agent_paid_income);
CREATE INDEX IF NOT EXISTS idx_transactions_agent_financials ON public.transactions(listing_agent_id, status, closed_date);
CREATE INDEX IF NOT EXISTS idx_transactions_selling_financials ON public.transactions(selling_agent_id, status, closed_date);
