-- Migration: Active Listings Support and Sisu Ingestion
-- Created At: 2026-10-13
-- Purpose: Add performance indexes for active listings and backfill unimported Live Listings from Sisu webhook logs

-- 1. Ensure indexes for high-speed listing queries
CREATE INDEX IF NOT EXISTS idx_transactions_status_side ON public.transactions(status, side);
CREATE INDEX IF NOT EXISTS idx_transactions_listing_agent ON public.transactions(listing_agent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_city ON public.transactions(city);

-- 2. Backfill unimported Live Listings from sisu_webhook_log
DO $$
DECLARE
  rec RECORD;
  v_agent_id UUID;
  v_address TEXT;
  v_city TEXT;
  v_state TEXT;
  v_zip TEXT;
  v_client_name TEXT;
  v_client_phone TEXT;
  v_price NUMERIC;
  v_created_ts TIMESTAMPTZ;
BEGIN
  FOR rec IN (
    WITH ranked_logs AS (
      SELECT 
        (payload->'data_objects'->0->'object_data'->'full_object'->>'client_id') AS sisu_id,
        (payload->'data_objects'->0->'object_data'->'full_object'->>'address_1') AS address_1,
        (payload->'data_objects'->0->'object_data'->'full_object'->>'city') AS city,
        (payload->'data_objects'->0->'object_data'->'full_object'->>'state') AS state,
        (payload->'data_objects'->0->'object_data'->'full_object'->>'zip') AS zip,
        (payload->'data_objects'->0->'object_data'->'full_object'->>'price') AS price_str,
        (payload->'data_objects'->0->'object_data'->'full_object'->>'first_name') AS first_name,
        (payload->'data_objects'->0->'object_data'->'full_object'->>'last_name') AS last_name,
        (payload->'data_objects'->0->'object_data'->'full_object'->>'mobile_phone') AS mobile_phone,
        (payload->'data_objects'->0->'object_data'->'agent_record'->>'email') AS agent_email,
        (payload->'data_objects'->0->'object_data'->'agent_record'->>'first_name') AS agent_first,
        (payload->'data_objects'->0->'object_data'->'agent_record'->>'last_name') AS agent_last,
        received_at,
        ROW_NUMBER() OVER(
          PARTITION BY (payload->'data_objects'->0->'object_data'->'full_object'->>'client_id')
          ORDER BY received_at DESC
        ) AS rn
      FROM public.sisu_webhook_log
      WHERE (payload->'data_objects'->0->'object_data'->'full_object'->>'pipeline_status') = 'Live Listing'
        AND (payload->'data_objects'->0->'object_data'->'full_object'->>'address_1') IS NOT NULL
        AND length(trim(payload->'data_objects'->0->'object_data'->'full_object'->>'address_1')) > 3
    )
    SELECT * FROM ranked_logs WHERE rn = 1
  ) LOOP
    -- Only import if not already tracked in transactions
    IF NOT EXISTS (
      SELECT 1 FROM public.transactions 
      WHERE sisu_transaction_id = rec.sisu_id
    ) THEN
      -- Resolve listing agent
      v_agent_id := NULL;
      IF rec.agent_email IS NOT NULL AND trim(rec.agent_email) <> '' THEN
        SELECT id INTO v_agent_id 
        FROM public.agents 
        WHERE lower(email) = lower(trim(rec.agent_email))
        LIMIT 1;
      END IF;

      IF v_agent_id IS NULL AND rec.agent_first IS NOT NULL THEN
        SELECT id INTO v_agent_id 
        FROM public.agents 
        WHERE lower(name) = lower(trim(rec.agent_first || ' ' || coalesce(rec.agent_last, '')))
        LIMIT 1;
      END IF;

      -- Parse price
      v_price := NULL;
      IF rec.price_str IS NOT NULL AND rec.price_str ~ '^[0-9]+(\.[0-9]+)?$' THEN
        v_price := rec.price_str::NUMERIC;
      END IF;

      v_address := trim(rec.address_1);
      v_city := coalesce(nullif(trim(rec.city), ''), 'Waynesville');
      IF v_city = 'Chicago' THEN v_city := 'Waynesville'; END IF;
      v_state := coalesce(nullif(trim(rec.state), ''), 'MO');
      IF v_state = 'IL' THEN v_state := 'MO'; END IF;
      v_zip := nullif(trim(rec.zip), '');

      v_client_name := trim(coalesce(rec.first_name, '') || ' ' || coalesce(rec.last_name, ''));
      IF v_client_name = '' THEN v_client_name := 'Seller Client'; END IF;
      v_client_phone := nullif(trim(rec.mobile_phone), '');

      INSERT INTO public.transactions (
        sisu_transaction_id,
        status,
        property_address,
        city,
        state,
        zip,
        side,
        client_name,
        client_phone,
        price,
        list_price,
        listing_agent_id,
        created_at,
        updated_at
      ) VALUES (
        rec.sisu_id,
        'Live Listing',
        v_address,
        v_city,
        v_state,
        v_zip,
        'seller',
        v_client_name,
        v_client_phone,
        v_price,
        v_price,
        v_agent_id,
        rec.received_at,
        now()
      );
    END IF;
  END LOOP;
END $$;
