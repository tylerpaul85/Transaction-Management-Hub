-- Add lender, loan, title, and co-op contact columns to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS lender_name TEXT NULL,
ADD COLUMN IF NOT EXISTS lender_email TEXT NULL,
ADD COLUMN IF NOT EXISTS lender_phone TEXT NULL,
ADD COLUMN IF NOT EXISTS loan_type TEXT NULL,
ADD COLUMN IF NOT EXISTS title_company TEXT NULL,
ADD COLUMN IF NOT EXISTS other_party_email TEXT NULL;
