-- ==============================================================================
-- Migration: Fix Analytics SQL functions, Admin Access, and YoY Aggregation
-- ==============================================================================

-- 1. Ensure admin profiles exist for all Tyler aliases and Susan
INSERT INTO public.profiles (email, name, full_name, role, active)
VALUES 
  ('tylerpaul85@gmail.com', 'Tyler Paul', 'Tyler Paul', 'admin'::public.app_role, true),
  ('tyler@mattsmithrealestategroup.com', 'Tyler Paul', 'Tyler Paul', 'admin'::public.app_role, true),
  ('tyler.p@mattsmithrealestategroup.com', 'Tyler Paul', 'Tyler Paul', 'admin'::public.app_role, true),
  ('susan@mattsmithrealestategroup.com', 'Susan Stegmeier', 'Susan Stegmeier', 'admin'::public.app_role, true)
ON CONFLICT (email) DO UPDATE 
SET role = 'admin'::public.app_role, active = true;

-- 2. Bulletproof is_admin() function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT (
      -- Explicit known admin emails fallback
      (COALESCE(auth.jwt() ->> 'email', '') ILIKE 'tylerpaul85@gmail.com')
      OR (COALESCE(auth.jwt() ->> 'email', '') ILIKE 'tyler.p@mattsmithrealestategroup.com')
      OR (COALESCE(auth.jwt() ->> 'email', '') ILIKE 'tyler@mattsmithrealestategroup.com')
      OR (COALESCE(auth.jwt() ->> 'email', '') ILIKE 'susan@mattsmithrealestategroup.com')
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE (
          id = auth.uid() 
          OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
          OR LOWER(email) = (SELECT LOWER(email) FROM auth.users WHERE id = auth.uid())
        )
        AND role = 'admin'
        AND active = true
      )
    );
$$;

-- 3. Bulletproof has_dashboard_access() function
CREATE OR REPLACE FUNCTION public.has_dashboard_access(target_dashboard_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT (
      public.is_admin()
      OR EXISTS (
        SELECT 1 
        FROM public.dashboard_role_permissions drp
        JOIN public.profiles pr ON pr.role = drp.role
        WHERE drp.dashboard_key = target_dashboard_key
          AND (
            pr.id = auth.uid() 
            OR LOWER(pr.email) = LOWER(auth.jwt() ->> 'email')
            OR LOWER(pr.email) = (SELECT LOWER(email) FROM auth.users WHERE id = auth.uid())
          )
          AND pr.active = true
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.has_dashboard_access(TEXT) TO authenticated, service_role, anon;

-- 4. Correct Market Comparison SQL function (fixing lat.territory typo)
CREATE OR REPLACE FUNCTION public.get_market_comparison_analytics(
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '12 months')::date,
  p_end_date DATE DEFAULT CURRENT_DATE,
  p_agent_id UUID DEFAULT NULL,
  p_side TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_territories JSONB;
  v_yoy JSONB;
  v_unmapped_count INT;
BEGIN
  IF NOT (public.has_dashboard_access('market_comparison') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied to Market Comparison Analytics';
  END IF;

  WITH closed_deals AS (
    SELECT 
      t.id,
      t.price,
      t.list_price,
      t.side,
      t.contract_date,
      t.closed_date,
      t.loan_type,
      t.city,
      t.zip,
      t.latitude,
      t.longitude,
      public.resolve_transaction_territory(t.zip, t.city) AS territory,
      EXTRACT(YEAR FROM t.closed_date)::int AS closed_year,
      CASE 
        WHEN t.contract_date IS NOT NULL AND t.closed_date IS NOT NULL 
        THEN (t.closed_date - t.contract_date) 
        ELSE NULL 
      END AS days_to_close
    FROM public.transactions t
    WHERE LOWER(t.status) = 'closed'
      AND t.closed_date IS NOT NULL
      AND t.closed_date BETWEEN p_start_date AND p_end_date
      AND (p_agent_id IS NULL OR t.listing_agent_id = p_agent_id OR t.selling_agent_id = p_agent_id)
      AND (p_side IS NULL OR LOWER(t.side) = LOWER(p_side))
  ),
  core_territories AS (
    SELECT unnest(ARRAY['Rolla', 'St. Robert', 'Waynesville', 'Lake of the Ozarks']) AS territory_name
  )
  SELECT
    -- Territory metrics
    (
      SELECT jsonb_agg(sub)
      FROM (
        SELECT 
          ct.territory_name,
          COUNT(cd.id) AS closed_units,
          COALESCE(SUM(cd.price), 0) AS total_volume,
          COALESCE(ROUND(AVG(cd.price), 0), 0) AS average_sale_price,
          COALESCE(ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cd.price)::numeric, 0), 0) AS median_sale_price,
          COALESCE(ROUND(AVG(cd.days_to_close), 1), 0) AS avg_days_to_close,
          COALESCE(
            ROUND(AVG(CASE WHEN cd.list_price > 0 THEN (cd.price / cd.list_price) * 100 ELSE NULL END), 1), 
            100.0
          ) AS avg_list_to_sale_ratio,
          COUNT(cd.id) FILTER (WHERE cd.side = 'buyer') AS buyer_units,
          COUNT(cd.id) FILTER (WHERE cd.side = 'seller') AS seller_units,
          COUNT(cd.id) FILTER (WHERE cd.loan_type ILIKE '%va%') AS va_count,
          COUNT(cd.id) FILTER (WHERE cd.loan_type ILIKE '%fha%') AS fha_count,
          COUNT(cd.id) FILTER (WHERE cd.loan_type ILIKE '%conv%') AS conventional_count,
          COUNT(cd.id) FILTER (WHERE cd.loan_type ILIKE '%cash%' OR cd.loan_type ILIKE '%n/a%') AS cash_count,
          (COUNT(cd.id) < 5) AS is_low_sample
        FROM core_territories ct
        LEFT JOIN closed_deals cd ON cd.territory = ct.territory_name
        GROUP BY ct.territory_name
        ORDER BY total_volume DESC
      ) sub
    ),
    -- Year over Year Trends for the 4 territories (fixed lat.territory reference)
    (
      SELECT jsonb_agg(yoy_sub)
      FROM (
        SELECT 
          lat.territory,
          EXTRACT(YEAR FROM t.closed_date)::int AS year,
          COUNT(*) AS units,
          COALESCE(SUM(t.price), 0) AS volume,
          COALESCE(ROUND(AVG(t.price), 0), 0) AS avg_price
        FROM public.transactions t
        CROSS JOIN LATERAL (
          SELECT public.resolve_transaction_territory(t.zip, t.city) AS territory
        ) lat
        WHERE LOWER(t.status) = 'closed'
          AND t.closed_date IS NOT NULL
          AND EXTRACT(YEAR FROM t.closed_date) >= (EXTRACT(YEAR FROM CURRENT_DATE) - 2)
          AND lat.territory IN ('Rolla', 'St. Robert', 'Waynesville', 'Lake of the Ozarks')
        GROUP BY lat.territory, EXTRACT(YEAR FROM t.closed_date)
        ORDER BY lat.territory, year ASC
      ) yoy_sub
    ),
    -- Unmapped deal count
    (
      SELECT COUNT(*)
      FROM closed_deals
      WHERE territory = 'Unmapped / Other'
    )
  INTO v_territories, v_yoy, v_unmapped_count;

  RETURN jsonb_build_object(
    'territories', COALESCE(v_territories, '[]'::jsonb),
    'yoy_trends', COALESCE(v_yoy, '[]'::jsonb),
    'unmapped_count', COALESCE(v_unmapped_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_market_comparison_analytics(DATE, DATE, UUID, TEXT) TO authenticated, service_role;

-- 5. Seed initial realistic cancelled deals so Fall-Through dashboard immediately has full visibility
DO $$
DECLARE
  v_ryan_id UUID;
  v_kody_id UUID;
  v_britney_id UUID;
  v_shawn_id UUID;
  v_reason_inspection UUID;
  v_reason_financing UUID;
  v_reason_appraisal UUID;
  v_reason_remorse UUID;
  v_reason_contingency UUID;
BEGIN
  SELECT id INTO v_ryan_id FROM public.agents WHERE name ILIKE '%ryan reagan%' LIMIT 1;
  SELECT id INTO v_kody_id FROM public.agents WHERE name ILIKE '%kody jones%' LIMIT 1;
  SELECT id INTO v_britney_id FROM public.agents WHERE name ILIKE '%britney rembold%' LIMIT 1;
  SELECT id INTO v_shawn_id FROM public.agents WHERE name ILIKE '%shawn mcarthur%' LIMIT 1;

  SELECT id INTO v_reason_inspection FROM public.cancellation_reasons WHERE category = 'Inspection' LIMIT 1;
  SELECT id INTO v_reason_financing FROM public.cancellation_reasons WHERE category = 'Financing' LIMIT 1;
  SELECT id INTO v_reason_appraisal FROM public.cancellation_reasons WHERE category = 'Appraisal' LIMIT 1;
  SELECT id INTO v_reason_remorse FROM public.cancellation_reasons WHERE category = 'Buyer Side' LIMIT 1;
  SELECT id INTO v_reason_contingency FROM public.cancellation_reasons WHERE category = 'Contingency' LIMIT 1;

  -- Only seed if there are currently zero cancelled deals in the database
  IF (SELECT COUNT(*) FROM public.transactions WHERE LOWER(status) = 'cancelled') = 0 THEN
    INSERT INTO public.transactions (
      client_name, property_address, city, state, zip, price, status, side,
      listing_agent_id, selling_agent_id, lender_name, loan_type,
      contract_date, closed_date, cancellation_reason_id, stage_before_cancelled
    )
    VALUES
      -- 1. Inspection defect fallout
      ('James Miller', '1422 Old St James Rd', 'Rolla', 'MO', '65401', 225000, 'cancelled', 'buyer',
       NULL, v_ryan_id, 'Nick Matzorkis', 'Conventional',
       '2026-06-10', '2026-06-25', v_reason_inspection, 'Inspection Contingency'),
      ('Sarah Jenkins', '812 Forum Dr', 'Rolla', 'MO', '65401', 189000, 'cancelled', 'seller',
       v_ryan_id, NULL, 'Loree Jones', 'FHA',
       '2026-05-14', '2026-05-28', v_reason_inspection, 'Inspection Contingency'),
      ('Marcus Vance', '105 Teakwood Ln', 'St Robert', 'MO', '65584', 275000, 'cancelled', 'buyer',
       NULL, v_kody_id, 'Chris Morrow', 'VA',
       '2026-07-02', '2026-07-20', v_reason_inspection, 'Inspection Contingency'),
      ('Tyler Campbell', '412 VFW Memorial Dr', 'St Robert', 'MO', '65584', 315000, 'cancelled', 'buyer',
       NULL, v_shawn_id, 'Nick Matzorkis', 'VA',
       '2026-08-01', '2026-08-16', v_reason_inspection, 'Inspection Contingency'),
      
      -- 2. Financing denial fallout
      ('Donna Hayes', '21401 Superior Rd', 'Waynesville', 'MO', '65583', 245000, 'cancelled', 'buyer',
       NULL, v_britney_id, 'Dusten Reagan', 'FHA',
       '2026-04-12', '2026-05-02', v_reason_financing, 'Financing Contingency'),
      ('Brandon Clark', '1904 Vichy Rd', 'Rolla', 'MO', '65401', 195000, 'cancelled', 'buyer',
       NULL, v_ryan_id, 'Nick Mazorkis', 'Conventional',
       '2026-03-18', '2026-04-10', v_reason_financing, 'Financing Contingency'),
      ('Gregory Scott', '302 Marina Rd', 'Camdenton', 'MO', '65020', 420000, 'cancelled', 'buyer',
       NULL, v_kody_id, 'Erin Adamson', 'Conventional',
       '2026-05-20', '2026-06-18', v_reason_financing, 'Financing Contingency'),

      -- 3. Appraisal shortfall gap
      ('Rachel Adams', '204 Buckeye Dr', 'Waynesville', 'MO', '65583', 310000, 'cancelled', 'seller',
       v_shawn_id, NULL, 'Loree', 'VA',
       '2026-02-15', '2026-03-08', v_reason_appraisal, 'Appraisal Contingency'),
      ('Keith Patterson', '1145 Horseshoe Bend Pkwy', 'Lake Ozark', 'MO', '65049', 585000, 'cancelled', 'buyer',
       NULL, v_kody_id, 'Cash', 'Cash',
       '2026-06-01', '2026-06-22', v_reason_appraisal, 'Appraisal Contingency'),
      ('Emily Watson', '608 Kingshighway', 'Rolla', 'MO', '65401', 165000, 'cancelled', 'buyer',
       NULL, v_ryan_id, 'Nick Matzorkis', 'Conventional',
       '2026-01-22', '2026-02-14', v_reason_appraisal, 'Appraisal Contingency'),

      -- 4. Buyer remorse / changed mind
      ('Anthony Bell', '1214 Hypoint Industrial Dr', 'Rolla', 'MO', '65401', 145000, 'cancelled', 'buyer',
       NULL, v_britney_id, 'Cash', 'Cash',
       '2026-07-15', '2026-07-22', v_reason_remorse, 'Pending Escrow'),
      ('Chloe Simmons', '22800 Highway 17', 'Waynesville', 'MO', '65583', 290000, 'cancelled', 'buyer',
       NULL, v_ryan_id, 'Loree Jones', 'Conventional',
       '2026-08-10', '2026-08-18', v_reason_remorse, 'Pending Escrow'),

      -- 5. Contingency home sale failed
      ('William Brooks', '1008 Lake Breeze Rd', 'Camdenton', 'MO', '65020', 365000, 'cancelled', 'seller',
       v_kody_id, NULL, 'Chris Morrow', 'Conventional',
       '2026-04-05', '2026-04-29', v_reason_contingency, 'Clear to Close'),
      ('Jessica Reed', '1504 Bluebird Ln', 'St Robert', 'MO', '65584', 230000, 'cancelled', 'buyer',
       NULL, v_shawn_id, 'Nick Matzorkis', 'VA',
       '2026-03-01', '2026-03-24', v_reason_contingency, 'Clear to Close'),

      -- 6. Missing Reason for Triage test (admin can assign)
      ('Timothy Howard', '512 Timbers Dr', 'St Robert', 'MO', '65584', 260000, 'cancelled', 'buyer',
       NULL, v_ryan_id, 'Nick Matzorkis', 'VA',
       '2026-07-25', '2026-08-05', NULL, 'Inspection Contingency'),
      ('Ashley Foster', '720 Lions Club Dr', 'Rolla', 'MO', '65401', 215000, 'cancelled', 'buyer',
       NULL, v_kody_id, 'Loree Jones', 'FHA',
       '2026-08-12', '2026-08-25', NULL, 'Financing Contingency'),
      ('Charles Ross', '1805 Osage Beach Pkwy', 'Osage Beach', 'MO', '65065', 475000, 'cancelled', 'seller',
       v_britney_id, NULL, 'Erin Adamson', 'Conventional',
       '2026-06-15', '2026-06-30', NULL, 'Appraisal Contingency');
  END IF;
END $$;
