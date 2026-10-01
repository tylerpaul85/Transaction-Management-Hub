-- Add avatar_url to agents and profiles tables for headshot support
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Enable RLS update permissions for avatar_url
GRANT ALL ON public.agents TO anon, authenticated, service_role;
GRANT ALL ON public.profiles TO anon, authenticated, service_role;
