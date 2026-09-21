-- ==============================================================================
-- MSREG Marketing Hub — Deduplicate Deals, Normalize Sisu IDs, Clean Test Records
-- ==============================================================================

-- 1. Delete the 12 duplicate transactions that have redundant 'SISU-' prefixes
--    (Child records like milestones cascade delete automatically)
DELETE FROM public.transactions
WHERE sisu_transaction_id IN (
  'SISU-6319297', 'SISU-6489764', 'SISU-6763054', 'SISU-6743088',
  'SISU-6453236', 'SISU-6582448', 'SISU-6621116', 'SISU-6721977',
  'SISU-6656789', 'SISU-6643945', 'SISU-6583300', 'SISU-6689162'
);

-- 2. Delete the manual test transaction ('tyler test' / 713 Missouri Avenue)
DELETE FROM public.transactions
WHERE property_address = '713 Missouri Avenue'
  AND (sisu_transaction_id IS NULL OR client_name ILIKE '%test%');

-- 3. Archive/Update stale closed deals to 'Closed'
UPDATE public.transactions
SET status = 'Closed', updated_at = NOW()
WHERE sisu_transaction_id IN ('6162954', 'SISU-6162954', '6689162', 'SISU-6689162');

-- 4. Normalize all remaining 'SISU-' prefixed transactions to pure numeric Sisu IDs
UPDATE public.transactions
SET sisu_transaction_id = REPLACE(sisu_transaction_id, 'SISU-', '')
WHERE sisu_transaction_id LIKE 'SISU-%';

-- 5. Clean up any placeholder or blank address records if any exist
DELETE FROM public.transactions
WHERE property_address IS NULL 
   OR TRIM(property_address) = ''
   OR LOWER(TRIM(property_address)) IN ('tbd', 'pending address', 'unknown address');
