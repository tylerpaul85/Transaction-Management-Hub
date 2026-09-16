-- Migration: Clean up initial seed test data and add state column to transactions
-- 1. Add state column to public.transactions and default city/state to MO / Waynesville
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'MO';

ALTER TABLE public.transactions
ALTER COLUMN city SET DEFAULT 'Waynesville';

-- 2. Delete test seed transactions if present
DELETE FROM public.transactions
WHERE sisu_transaction_id IN ('SISU-TRX-8901', 'SISU-TRX-8902', 'SISU-TRX-8903');

-- 3. Delete test agents (Tyler Miller, Sophia Montgomery) and test TCs (Sarah Jenkins)
DELETE FROM public.agents
WHERE email IN ('tyler.agent@msreg.com', 'sophia.agent@msreg.com', 'sarah.tc@msreg.com')
   OR name IN ('Tyler Miller', 'Sophia Montgomery', 'Sarah Jenkins');

DELETE FROM public.ops_users
WHERE email IN ('tyler.agent@msreg.com', 'sophia.agent@msreg.com', 'sarah.tc@msreg.com')
   OR name IN ('Tyler Miller', 'Sophia Montgomery', 'Sarah Jenkins');

DELETE FROM public.profiles
WHERE email IN ('tyler.agent@msreg.com', 'sophia.agent@msreg.com', 'sarah.tc@msreg.com')
   OR name IN ('Tyler Miller', 'Sophia Montgomery', 'Sarah Jenkins');

-- 4. Update any existing Chicago/IL entries to Waynesville/MO
UPDATE public.transactions
SET state = 'MO'
WHERE state IS NULL OR state = 'IL' OR state = '';

UPDATE public.transactions
SET city = 'Waynesville'
WHERE city = 'Chicago';
