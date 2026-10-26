-- Migration: Add last_sign_in_at and last_active_at to public.profiles
-- Enables tracking when users last logged into the site and audits active usage.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Ensure permissions
GRANT ALL ON public.profiles TO anon, authenticated, service_role;

-- Backfill last_sign_in_at from auth.users if matching accounts exist
DO $$
BEGIN
  UPDATE public.profiles p
  SET last_sign_in_at = u.last_sign_in_at,
      last_active_at = COALESCE(u.last_sign_in_at, p.updated_at)
  FROM auth.users u
  WHERE (p.id = u.id OR LOWER(p.email) = LOWER(u.email))
    AND u.last_sign_in_at IS NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
