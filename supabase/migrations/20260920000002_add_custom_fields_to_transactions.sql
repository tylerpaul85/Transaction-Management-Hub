-- Add custom_fields JSONB column to public.transactions for storing Sisu custom form responses
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.transactions.custom_fields IS 'Stores all custom form fields and user responses from Sisu (e.g. Under Contract form, inspection/EMD toggles).';
