-- Migration: 20261007000002_sync_tc_ops_and_allowlist_emails.sql
-- Goal: Reconcile duplicate ops_users with canonical User Allowlist (profiles table)
-- Ashley Charette canonical: ops_user_id '4dbc2470-7089-4c1a-8e1d-db9fb1d31a42', email 'ashley@mattsmithrealestategroup.com'
-- Katie Harold canonical: ops_user_id '4e85c640-675c-443f-8284-628f89552ac5', email 'kathryn@mattsmithrealestategroup.com'

-- 1. Re-point transactions assigned to legacy duplicate Ashley rows to canonical ops_user_id
UPDATE public.transactions
SET assigned_tc_id = '4dbc2470-7089-4c1a-8e1d-db9fb1d31a42'
WHERE assigned_tc_id IN (
  'f4436dcc-4d52-4a26-af80-05096b76067e', -- legacy ashley.charette@
  '9462752f-c0de-4894-bb76-6b3adcac54b0'  -- typo ashely@
);

-- 2. Re-point transactions assigned to legacy duplicate Katie rows to canonical ops_user_id
UPDATE public.transactions
SET assigned_tc_id = '4e85c640-675c-443f-8284-628f89552ac5'
WHERE assigned_tc_id IN (
  '5580daa6-415d-4385-986a-69bc94421c0c', -- legacy katie.harold@
  'ee3b9e45-cae6-4d4c-821f-3d002014bb30'  -- legacy katie@
);

-- 3. Delete obsolete duplicate ops_users rows now that transactions are remapped
DELETE FROM public.ops_users
WHERE id IN (
  'f4436dcc-4d52-4a26-af80-05096b76067e',
  '9462752f-c0de-4894-bb76-6b3adcac54b0',
  '5580daa6-415d-4385-986a-69bc94421c0c',
  'ee3b9e45-cae6-4d4c-821f-3d002014bb30'
);

-- 4. Ensure canonical profiles in user allowlist are active
UPDATE public.profiles
SET active = true,
    updated_at = NOW()
WHERE email IN (
  'ashley@mattsmithrealestategroup.com',
  'kathryn@mattsmithrealestategroup.com',
  'zack@mattsmithrealestategroup.com',
  'susan@mattsmithrealestategroup.com'
);

-- 5. Sanitize transactions tc_email column if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'transactions' 
      AND column_name = 'tc_email'
  ) THEN
    UPDATE public.transactions
    SET tc_email = 'ashley@mattsmithrealestategroup.com'
    WHERE tc_email ILIKE '%ashley%' OR tc_email ILIKE '%charette%';

    UPDATE public.transactions
    SET tc_email = 'kathryn@mattsmithrealestategroup.com'
    WHERE tc_email ILIKE '%katie%';
  END IF;
END $$;
