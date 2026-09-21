-- ==============================================================================
-- MSREG Marketing Hub — Fix TC/Agent RLS & Populate Unassigned TCs
-- ==============================================================================

-- 1. Enable SELECT on ops_users and agents for public/anon clients
--    (Ensures the web app can always resolve assigned_tc and agent names)
DROP POLICY IF EXISTS "Ops users viewable by authenticated users" ON public.ops_users;
DROP POLICY IF EXISTS "Ops users viewable by public" ON public.ops_users;
CREATE POLICY "Ops users viewable by public" ON public.ops_users FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Agents viewable by authenticated users" ON public.agents;
DROP POLICY IF EXISTS "Agents viewable by public" ON public.agents;
CREATE POLICY "Agents viewable by public" ON public.agents FOR SELECT TO public USING (true);

-- 2. Populate assigned_tc_id for all unassigned transactions using the broker's dedicated Agent-to-TC roster
UPDATE public.transactions t
SET assigned_tc_id = 'f4436dcc-4d52-4a26-af80-05096b76067e' -- Ashley Charette
FROM public.agents a
WHERE (t.listing_agent_id = a.id OR t.selling_agent_id = a.id)
  AND t.assigned_tc_id IS NULL
  AND LOWER(a.name) IN (
    'ben blickhan', 'brittney soto', 'chayce switzer', 'ciara giacomini', 
    'haley bradshaw', 'ian brand', 'jonathan pimentel', 'kent wheelock', 
    'kody jones', 'kristen reagan', 'lance lewis', 'michael dimond', 
    'nick lein', 'tasha mcbride', 'tyler paul', 'yuba martinez', 'storm kittel'
  );

UPDATE public.transactions t
SET assigned_tc_id = '5580daa6-415d-4385-986a-69bc94421c0c' -- Katie Harold
FROM public.agents a
WHERE (t.listing_agent_id = a.id OR t.selling_agent_id = a.id)
  AND t.assigned_tc_id IS NULL
  AND LOWER(a.name) IN (
    'amy reid', 'britney rembold', 'erik kean', 'jenette richardson', 
    'joseph bahr', 'josh chapman', 'joshua kiehne', 'luis padilla aparicio', 
    'marissa beatty', 'michael odle', 'robert montenegro', 'ryan reagan', 
    'sebastian rush', 'shawn mcarthur', 'shawn witzemann'
  );

-- For any remaining transaction with null agent or unmapped, default to Ashley Charette
UPDATE public.transactions
SET assigned_tc_id = 'f4436dcc-4d52-4a26-af80-05096b76067e'
WHERE assigned_tc_id IS NULL;
