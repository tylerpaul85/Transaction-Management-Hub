-- ==============================================================================
-- Migration: Supabase Aggregation Views & Functions for Admin Analytics
-- ==============================================================================

-- 1. Helper function to resolve territory for any transaction
CREATE OR REPLACE FUNCTION public.resolve_transaction_territory(p_zip text, p_city text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT tm.territory_name 
      FROM public.territory_mappings tm 
      WHERE tm.zip IS NOT NULL AND tm.zip = TRIM(p_zip)
      LIMIT 1
    ),
    (
      SELECT tm.territory_name 
      FROM public.territory_mappings tm 
      WHERE tm.city IS NOT NULL AND LOWER(tm.city) = LOWER(TRIM(p_city))
      LIMIT 1
    ),
    'Unmapped / Other'
  );
$$;

-- 2. Helper function to resolve normalized lender name
CREATE OR REPLACE FUNCTION public.resolve_normalized_lender(p_raw_lender text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT la.canonical_name 
      FROM public.lender_aliases la 
      WHERE LOWER(TRIM(la.raw_name)) = LOWER(TRIM(p_raw_lender))
      LIMIT 1
    ),
    NULLIF(TRIM(p_raw_lender), ''),
    'Unassigned / Unknown'
  );
$$;

-- 3. Function to get Fall-Through Analysis Aggregations
CREATE OR REPLACE FUNCTION public.get_fall_through_analytics(
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
  v_summary JSONB;
  v_by_agent JSONB;
  v_by_lender JSONB;
  v_by_price_band JSONB;
  v_by_reason JSONB;
  v_by_stage JSONB;
BEGIN
  -- Check admin or dashboard permissions
  IF NOT (public.has_dashboard_access('fall_through') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Access denied to Fall-Through Analytics';
  END IF;

  -- Filtered Common Table Expression (CTE)
  WITH eligible_deals AS (
    SELECT 
      t.id,
      t.status,
      t.price,
      t.side,
      t.listing_agent_id,
      t.selling_agent_id,
      COALESCE(ag.name, 'Lead Agent') AS agent_name,
      public.resolve_normalized_lender(t.lender_name) AS lender_canonical,
      t.cancellation_reason_id,
      COALESCE(cr.reason, 'Reason Not Specified') AS cancellation_reason,
      COALESCE(t.stage_before_cancelled, 'Pending Escrow') AS stage_before_cancelled,
      COALESCE(t.closed_date, t.contract_date, t.created_at::date) AS effective_date
    FROM public.transactions t
    LEFT JOIN public.agents ag ON ag.id = COALESCE(
      CASE WHEN t.side = 'seller' THEN t.listing_agent_id ELSE t.selling_agent_id END,
      t.listing_agent_id,
      t.selling_agent_id
    )
    LEFT JOIN public.cancellation_reasons cr ON cr.id = t.cancellation_reason_id
    WHERE (LOWER(t.status) = 'closed' OR LOWER(t.status) = 'cancelled')
      AND (p_agent_id IS NULL OR t.listing_agent_id = p_agent_id OR t.selling_agent_id = p_agent_id)
      AND (p_side IS NULL OR LOWER(t.side) = LOWER(p_side))
      AND (
        (t.closed_date IS NOT NULL AND t.closed_date BETWEEN p_start_date AND p_end_date)
        OR (t.closed_date IS NULL AND t.contract_date IS NOT NULL AND t.contract_date BETWEEN p_start_date AND p_end_date)
        OR (t.closed_date IS NULL AND t.contract_date IS NULL AND t.created_at::date BETWEEN p_start_date AND p_end_date)
      )
  )
  SELECT
    -- High Level Summary KPI
    (
      SELECT jsonb_build_object(
        'total_deals', COUNT(*),
        'closed_count', COUNT(*) FILTER (WHERE LOWER(status) = 'closed'),
        'cancelled_count', COUNT(*) FILTER (WHERE LOWER(status) = 'cancelled'),
        'fall_through_rate', CASE 
          WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE LOWER(status) = 'cancelled')::numeric / COUNT(*)::numeric) * 100, 1)
          ELSE 0 
        END,
        'missing_reason_count', COUNT(*) FILTER (WHERE LOWER(status) = 'cancelled' AND (cancellation_reason_id IS NULL OR cancellation_reason = 'Reason Not Specified')),
        'is_low_sample', COUNT(*) < 5
      )
      FROM eligible_deals
    ),
    -- Breakdown by Agent
    (
      SELECT jsonb_agg(sub)
      FROM (
        SELECT 
          agent_name,
          COUNT(*) FILTER (WHERE LOWER(status) = 'closed') AS closed_count,
          COUNT(*) FILTER (WHERE LOWER(status) = 'cancelled') AS cancelled_count,
          COUNT(*) AS total_deals,
          CASE 
            WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE LOWER(status) = 'cancelled')::numeric / COUNT(*)::numeric) * 100, 1)
            ELSE 0 
          END AS fall_through_rate,
          (COUNT(*) < 5) AS is_low_sample
        FROM eligible_deals
        GROUP BY agent_name
        ORDER BY total_deals DESC, cancelled_count DESC
      ) sub
    ),
    -- Breakdown by Normalized Lender
    (
      SELECT jsonb_agg(sub)
      FROM (
        SELECT 
          lender_canonical AS lender_name,
          COUNT(*) FILTER (WHERE LOWER(status) = 'closed') AS closed_count,
          COUNT(*) FILTER (WHERE LOWER(status) = 'cancelled') AS cancelled_count,
          COUNT(*) AS total_deals,
          CASE 
            WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE LOWER(status) = 'cancelled')::numeric / COUNT(*)::numeric) * 100, 1)
            ELSE 0 
          END AS fall_through_rate,
          (COUNT(*) < 5) AS is_low_sample
        FROM eligible_deals
        WHERE lender_canonical IS NOT NULL AND lender_canonical != 'Unassigned / Unknown'
        GROUP BY lender_canonical
        ORDER BY total_deals DESC, cancelled_count DESC
      ) sub
    ),
    -- Breakdown by Configured Price Bands
    (
      SELECT jsonb_agg(sub)
      FROM (
        SELECT 
          pb.label AS band_label,
          pb.display_order,
          COUNT(ed.id) FILTER (WHERE LOWER(ed.status) = 'closed') AS closed_count,
          COUNT(ed.id) FILTER (WHERE LOWER(ed.status) = 'cancelled') AS cancelled_count,
          COUNT(ed.id) AS total_deals,
          CASE 
            WHEN COUNT(ed.id) > 0 THEN ROUND((COUNT(ed.id) FILTER (WHERE LOWER(ed.status) = 'cancelled')::numeric / COUNT(ed.id)::numeric) * 100, 1)
            ELSE 0 
          END AS fall_through_rate,
          (COUNT(ed.id) < 5) AS is_low_sample
        FROM public.price_bands pb
        LEFT JOIN eligible_deals ed ON (
          ed.price >= pb.min_price AND (pb.max_price IS NULL OR ed.price < pb.max_price)
        )
        GROUP BY pb.id, pb.label, pb.display_order
        ORDER BY pb.display_order
      ) sub
    ),
    -- Breakdown by Cancellation Reason
    (
      SELECT jsonb_agg(sub)
      FROM (
        SELECT 
          cancellation_reason AS reason,
          COUNT(*) AS deal_count,
          CASE 
            WHEN (SELECT COUNT(*) FROM eligible_deals WHERE LOWER(status) = 'cancelled') > 0 
            THEN ROUND((COUNT(*)::numeric / (SELECT COUNT(*) FROM eligible_deals WHERE LOWER(status) = 'cancelled')::numeric) * 100, 1)
            ELSE 0 
          END AS percentage,
          (COUNT(*) < 5) AS is_low_sample
        FROM eligible_deals
        WHERE LOWER(status) = 'cancelled'
        GROUP BY cancellation_reason
        ORDER BY deal_count DESC
      ) sub
    ),
    -- Breakdown by Stage Before Cancelled
    (
      SELECT jsonb_agg(sub)
      FROM (
        SELECT 
          stage_before_cancelled AS stage,
          COUNT(*) AS deal_count,
          CASE 
            WHEN (SELECT COUNT(*) FROM eligible_deals WHERE LOWER(status) = 'cancelled') > 0 
            THEN ROUND((COUNT(*)::numeric / (SELECT COUNT(*) FROM eligible_deals WHERE LOWER(status) = 'cancelled')::numeric) * 100, 1)
            ELSE 0 
          END AS percentage,
          (COUNT(*) < 5) AS is_low_sample
        FROM eligible_deals
        WHERE LOWER(status) = 'cancelled'
        GROUP BY stage_before_cancelled
        ORDER BY deal_count DESC
      ) sub
    )
  INTO v_summary, v_by_agent, v_by_lender, v_by_price_band, v_by_reason, v_by_stage;

  RETURN jsonb_build_object(
    'summary', COALESCE(v_summary, '{}'::jsonb),
    'by_agent', COALESCE(v_by_agent, '[]'::jsonb),
    'by_lender', COALESCE(v_by_lender, '[]'::jsonb),
    'by_price_band', COALESCE(v_by_price_band, '[]'::jsonb),
    'by_reason', COALESCE(v_by_reason, '[]'::jsonb),
    'by_stage', COALESCE(v_by_stage, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_fall_through_analytics(DATE, DATE, UUID, TEXT) TO authenticated, service_role;

-- 4. Function to get Market Comparison Aggregations
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
    -- Year over Year Trends for the 4 territories
    (
      SELECT jsonb_agg(yoy_sub)
      FROM (
        SELECT 
          t.territory,
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
          AND t.territory IN ('Rolla', 'St. Robert', 'Waynesville', 'Lake of the Ozarks')
        GROUP BY t.territory, EXTRACT(YEAR FROM t.closed_date)
        ORDER BY t.territory, year ASC
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
