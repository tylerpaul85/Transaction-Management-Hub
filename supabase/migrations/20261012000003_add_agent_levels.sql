-- Add agent level column to agents and profiles tables
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;

-- Ensure permissions
GRANT ALL ON public.agents TO anon, authenticated, service_role;
GRANT ALL ON public.profiles TO anon, authenticated, service_role;

-- Seed initial agent levels as of October 01, 2026

-- Level 5
UPDATE public.agents SET level = 5 WHERE name ILIKE ANY(ARRAY['%Tasha McBride%', '%Ryan Reagan%']);

-- Level 4
UPDATE public.agents SET level = 4 WHERE name ILIKE ANY(ARRAY['%Kent Wheelock%', '%Yuba Martinez%', '%Erik Kean%', '%Nicole Shaffer%']);

-- Level 3
UPDATE public.agents SET level = 3 WHERE name ILIKE ANY(ARRAY['%Amy Reid%', '%Lance Lewis%', '%Nick Lein%', '%Britney Rembold%']);

-- Level 2
UPDATE public.agents SET level = 2 WHERE name ILIKE ANY(ARRAY[
  '%Jonathan Pimentel%', '%Shawn McArthur%', '%Luis Padilla Aparicio%',
  '%Joshua Kiehne%', '%Shawn Witzemann%', '%Mike Odle%', '%Michael Odle%',
  '%Kody Jones%', '%Jenette Richardson%', '%Kristen Reagan%'
]);

-- Level 1
UPDATE public.agents SET level = 1 WHERE name ILIKE ANY(ARRAY[
  '%Robert Montenegro%', '%Chayce Switzer%', '%Michael Dimond%', '%Ben Blickhan%',
  '%Josh Chapman%', '%Haley Bradshaw%', '%Sebastian Rush%', '%Storm Kittel%',
  '%Ian Brand%', '%Joseph Bahr%', '%Grant Lutz%', '%Lance Burris%',
  '%Kirk Kerber%', '%Leslie Morris%', '%Ciara Giacomini%', '%Brianna Gould%',
  '%Marissa Beatty%', '%Seda Evans%', '%Brittney Soto%', '%Alisha Stapleton%',
  '%Austin Taylor%', '%Cody Rossman%', '%Jennifer Blickhan%', '%Leigh Anne DeParle%'
]);

-- Also sync profiles.level from agents.level
UPDATE public.profiles p
SET level = a.level
FROM public.agents a
WHERE p.agent_id = a.id AND a.level IS NOT NULL;
