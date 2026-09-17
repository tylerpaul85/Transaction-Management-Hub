-- Add client_email, other_party_phone, and other_party_brokerage to public.transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS client_email TEXT NULL,
ADD COLUMN IF NOT EXISTS other_party_phone TEXT NULL,
ADD COLUMN IF NOT EXISTS other_party_brokerage TEXT NULL;
