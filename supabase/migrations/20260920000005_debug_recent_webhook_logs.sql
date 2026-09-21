CREATE OR REPLACE FUNCTION public.get_recent_webhook_logs(limit_count int DEFAULT 10)
RETURNS TABLE (
    id UUID,
    received_at TIMESTAMPTZ,
    transaction_id TEXT,
    payload JSONB
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT id, received_at, transaction_id, payload
    FROM public.sisu_webhook_log
    ORDER BY received_at DESC
    LIMIT limit_count;
$$;
GRANT EXECUTE ON FUNCTION public.get_recent_webhook_logs(int) TO anon, authenticated;
