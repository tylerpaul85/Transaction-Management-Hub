-- ==============================================================================
-- Migration: Add insurance_binder to milestone_type_enum and purge placeholder deals
-- ==============================================================================

-- 1. Add insurance_binder to milestone_type_enum
DO $$
BEGIN
    ALTER TYPE public.milestone_type_enum ADD VALUE IF NOT EXISTS 'insurance_binder';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Purge placeholder transactions without a genuine street address
DELETE FROM public.transactions
WHERE property_address IS NULL
   OR TRIM(property_address) = ''
   OR LOWER(TRIM(property_address)) = 'pending address'
   OR LOWER(TRIM(property_address)) LIKE 'pending address%'
   OR LOWER(TRIM(property_address)) = 'tbd'
   OR LOWER(TRIM(property_address)) LIKE 'tbd address%';
