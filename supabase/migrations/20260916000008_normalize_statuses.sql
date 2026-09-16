-- Migration: Normalize transaction statuses in public.transactions table
UPDATE public.transactions
SET status = 'under_contract'
WHERE status ILIKE '%under%contract%';

UPDATE public.transactions
SET status = 'pending'
WHERE status ILIKE 'pending';

UPDATE public.transactions
SET status = 'listing'
WHERE status ILIKE 'listing';

UPDATE public.transactions
SET status = 'closed'
WHERE status ILIKE 'closed';

UPDATE public.transactions
SET status = 'signed'
WHERE status ILIKE 'signed';

UPDATE public.transactions
SET status = 'set'
WHERE status ILIKE 'set';

UPDATE public.transactions
SET status = 'met'
WHERE status ILIKE 'met';

UPDATE public.transactions
SET status = 'pre_listing'
WHERE status ILIKE 'pre-listing' OR status ILIKE 'pre_listing';

UPDATE public.transactions
SET status = 'active'
WHERE status ILIKE 'active';
