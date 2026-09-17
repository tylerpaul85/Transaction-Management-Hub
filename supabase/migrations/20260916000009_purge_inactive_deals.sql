-- Migration: Purge non-active lead and closed deals from public.transactions
-- Keep ONLY active escrow and listing files: 'under_contract', 'pending', 'escrow', 'listing', 'pre_listing', 'active'

DELETE FROM public.transactions
WHERE LOWER(status) NOT IN ('under_contract', 'pending', 'escrow', 'listing', 'pre_listing', 'active')
   OR status IS NULL;
