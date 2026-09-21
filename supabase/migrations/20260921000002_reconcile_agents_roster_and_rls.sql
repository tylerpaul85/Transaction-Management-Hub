-- ==============================================================================
-- Migration: Reconcile Agents Roster, Enable Public/Authenticated Management,
-- and Deduplicate Database Records
-- ==============================================================================

-- 1. Add role & category columns to agents if not present
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS category TEXT;

-- 2. Ensure RLS policies allow authenticated and public to manage agents (directory & roster sync)
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Agents viewable by public" ON public.agents;
DROP POLICY IF EXISTS "Agents manageable by public" ON public.agents;
DROP POLICY IF EXISTS "Agents manageable by admin" ON public.agents;
DROP POLICY IF EXISTS "Agents manageable by authenticated" ON public.agents;

CREATE POLICY "Agents viewable by public" ON public.agents FOR SELECT TO public USING (true);
CREATE POLICY "Agents manageable by public" ON public.agents FOR ALL TO public USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO anon, authenticated, service_role;

-- 3. Temporary staging table with the verified Google Sheet Roster
CREATE TEMP TABLE verified_roster (
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT,
  category TEXT
) ON COMMIT DROP;

INSERT INTO verified_roster (name, email, phone, role, category) VALUES
  ('Lauren Pimentel', 'lauren@mattsmithrealestategroup.com', '573-433-9087', 'Director of Sales', 'Operations'),
  ('Melanie Rivers', 'melanie@mattsmithrealestategroup.com', '573-528-8239', 'Listing Coordinator', 'Operations'),
  ('Katie Harold', 'kathryn@mattsmithrealestategroup.com', '240-676-3096', 'Transaction Coordinator', 'Operations'),
  ('Ashley Charette', 'ashley@mattsmithrealestategroup.com', '207-869-0811', 'Transaction Coordinator', 'Operations'),
  ('Nancy Grim', 'nancy@mattsmithrealestategroup.com', '573-337-4446', 'Client Care and Referral Specialist', 'Operations'),
  ('AJ Cabanes', 'aj@mattsmithrealestategroup.com', '573-202-5882', 'Videographer', 'Operations'),
  ('Cortney Russ', 'cortney@mattsmithrealestategroup.com', '573-578-1261', 'Head of Agent Growth & Development', 'Operations'),
  ('Susan Stegmeier', 'susan@mattsmithrealestategroup.com', '573-337-5570', 'Director of Operations', 'Operations'),
  ('Tyler Paul', 'tyler.p@mattsmithrealestategroup.com', NULL, 'Marketing Coordinator', 'Operations'),
  ('Alex Ambat', 'alex@mattsmithrealestategroup.com', NULL, 'Video Editor VA', 'Operations'),
  ('Ermm Canete', 'ermm@mattsmithrealestategroup.com', NULL, 'Lead Management Specialist VA', 'Operations'),
  ('Jhonalyn Soledad', 'jhonalyn@mattsmithrealestategroup.com', NULL, 'Database Manager', 'Operations'),
  ('Regina Montilla', 'regina@mattsmithrealestategroup.com', NULL, 'LC/TC Coordinator', 'Operations'),
  ('Zach Detalo', 'zack@mattsmithrealestategroup.com', NULL, 'TC VA', 'Operations'),
  ('Nina Dicdican', 'nina@mattsmithrealestategroup.com', NULL, 'Recruiting Support VA', 'Operations'),
  ('Maria Regine Dayao', 'regine@mattsmithrealestategroup.com', NULL, 'Market Assistant VA', 'Operations'),
  ('Shawn McArthur', 'shawn@mattsmithrealestategroup.com', '817-781-3306', 'STR Agent', 'Buyer Specialist'),
  ('Joseph Bahr', 'joseph@mattsmithrealestategroup.com', '573-937-9235', 'STR Agent', 'Buyer Specialist'),
  ('Britney Rembold', 'britney@mattsmithrealestategroup.com', '573-836-2317', 'STR Agent / Listing Specialist', 'Buyer Specialist'),
  ('Lance Burris', 'lance.b@mattsmithrealestategroup.com', '573-280-2364', 'STR Agent', 'Buyer Specialist'),
  ('Sebastian Rush', 'sebastian@mattsmithrealestategroup.com', '660-428-5583', 'STR Agent', 'Buyer Specialist'),
  ('Daniel Rolufs', 'daniel.r@mattsmithrealestategroup.com', '417-612-2833', 'STR Agent', 'Buyer Specialist'),
  ('Storm Kittel', 'storm@mattsmithrealestategroup.com', '(573) 999-6043', 'STR Agent', 'Buyer Specialist'),
  ('Marissa Beatty', 'marissa@mattsmithrealestategroup.com', '(503) 888-3426', 'STR Agent', 'Buyer Specialist'),
  ('Amy Reid', 'amy.r@mattsmithrealestategroup.com', '(417) 631-7716', 'STR Agent', 'Buyer Specialist'),
  ('Haley Bradshaw', 'haley@mattsmithrealestategroup.com', '(573) 238-6278', 'STR Agent / Listing Specialist', 'Buyer Specialist'),
  ('Robert Montenegro', 'robert@mattsmithrealestategroup.com', '405-361-0352', 'STR Agent', 'Buyer Specialist'),
  ('Tasha McBride', 'tasha@mattsmithrealestategroup.com', '573-578-4163', 'Rolla Agent', 'Buyer Specialist'),
  ('Chayce Switzer', 'chayce@mattsmithrealestategroup.com', '573-308-5722', 'Rolla Agent / Listing Specialist', 'Buyer Specialist'),
  ('Nicole Shaffer', 'nicole@mattsmithrealestategroup.com', '314-406-1256', 'Rolla Agent', 'Buyer Specialist'),
  ('Lance Lewis', 'lance@mattsmithrealestategroup.com', '573-201-4907', 'Rolla Agent', 'Buyer Specialist'),
  ('Kirk Kerber', 'kirk@mattsmithrealestategroup.com', '573-578-5760', 'Rolla Agent', 'Buyer Specialist'),
  ('Shawn Witzemann', 'shawn.w@mattsmithrealestategroup.com', '505-419-0223', 'Rolla Agent', 'Buyer Specialist'),
  ('Brittney Soto', 'brittney.s@mattsmithrealestategroup.com', '(573) 202-5872', 'Rolla Agent', 'Buyer Specialist'),
  ('Austin Taylor', 'austin.t@mattsmithrealestategroup.com', '(573) 851-9186', 'Rolla Agent', 'Buyer Specialist'),
  ('Jeanette Yates', 'jeanette@mattsmithrealestategroup.com', '(573) 205-2682', 'Rolla Agent', 'Buyer Specialist'),
  ('Cody Rossman', 'cody@mattsmithrealestategroup.com', '(814) 386-5778', 'Rolla Agent', 'Buyer Specialist'),
  ('Leigh Anne DeParle', 'leigh@mattsmithrealestategroup.com', '(573) 205-0369', 'Rolla Agent', 'Buyer Specialist'),
  ('Alisha Stapleton', 'alisha@mattsmithrealestategroup.com', '(417) 365-3453', 'Rolla Agent', 'Buyer Specialist'),
  ('Jonathan Pimentel', 'jon@mattsmithrealestategroup.com', '573-528-7053', 'Lake Specialist / Listing Specialist', 'Buyer Specialist'),
  ('Kent Wheelock', 'kent@mattsmithrealestategroup.com', '573-337-5042', 'Lake Specialist / Listing Specialist', 'Buyer Specialist'),
  ('Kody Jones', 'kody@mattsmithrealestategroup.com', '641 208-4536', 'Lake Specialist / Listing Specialist', 'Buyer Specialist'),
  ('Michael Dimond', 'miked@mattsmithrealestategroup.com', '573-881-8178', 'Lake Specialist', 'Buyer Specialist'),
  ('Ben Blickhan', 'ben@mattsmithrealestategroup.com', '816-679-6968', 'Lake Specialist', 'Buyer Specialist'),
  ('Grant Lutz', 'grant@mattsmithrealestategroup.com', '913-957-2365', 'Lake Specialist', 'Buyer Specialist'),
  ('Brianna Gould', 'bri@mattsmithrealestategroup.com', '(573) 261-5532', 'Lake Specialist', 'Buyer Specialist'),
  ('Ciara Giacomini', 'ciara@mattsmithrealestategroup.com', '(916) 410-2358', 'Lake Specialist', 'Buyer Specialist'),
  ('Leslie Morris', 'leslie@mattsmithrealestategroup.com', '(816) 419-9120', 'Lake Specialist', 'Buyer Specialist'),
  ('Seda Evans', 'seda@mattsmithrealestategroup.com', '(573) 407-0347', 'Lake Specialist', 'Buyer Specialist'),
  ('Jennifer Blickhan', 'jennifer.b@mattsmithrealestategroup.com', '(816) 813-0125', 'Lake Specialist', 'Buyer Specialist'),
  ('Jenette Richardson', 'jenette@mattsmithrealestategroup.com', '573-855-4272', 'Listing Specialist - STR', 'Listing Specialist'),
  ('Yuba Martinez', 'yuba@mattsmithrealestategroup.com', '(321) 258-2331', 'Listing Specialist - STR', 'Listing Specialist'),
  ('Kristen Reagan', 'kristen@mattsmithrealestategroup.com', '(573) 465-6400', 'Listing Specialist - STR', 'Listing Specialist'),
  ('Luis Padilla Aparicio', 'luis@mattsmithrealestategroup.com', '907-888-0005', 'Listing Specialist - STR', 'Listing Specialist'),
  ('Mike Odle', 'mike@mattsmithrealestategroup.com', '573-433-0780', 'Listing Specialist - STR', 'Listing Specialist'),
  ('Nick Lein', 'nick.l@mattsmithrealestategroup.com', '573-586-9788', 'Listing Specialist - STR', 'Listing Specialist'),
  ('Josh Chapman', 'josh.c@mattsmithrealestategroup.com', '314-441-0480', 'Listing Specialist - Rolla', 'Listing Specialist'),
  ('Joshua Kiehne', 'joshua@mattsmithrealestategroup.com', '636-232-4109', 'Listing Specialist - Rolla', 'Listing Specialist'),
  ('Ryan Reagan', 'ryan@mattsmithrealestategroup.com', '573-578-9089', 'Listing Specialist - Rolla', 'Listing Specialist'),
  ('Erik Kean', 'erik@mattsmithrealestategroup.com', '573-368-9421', 'Listing Specialist - Rolla', 'Listing Specialist'),
  ('Deshawn Dell', 'deshawn@mattsmithrealestategroup.com', '617-704-7295', 'Hybrid Agent', 'Hybrid Agent'),
  ('Lena Nguyen', 'lena@mattsmithrealestategroup.com', '(314) 546-3068', 'Hybrid Agent', 'Hybrid Agent'),
  ('Amanda Smith', 'amanda@mattsmithrealestategroup.com', '573-253-8668', 'Owner', 'Owner'),
  ('Matt Smith', 'matt@mattsmithrealestategroup.com', '573-578-5999', 'Owner', 'Owner');

-- 4. Deduplicate and merge duplicate agent records:
DO $$
DECLARE
  r RECORD;
  canonical_id UUID;
  dupe_id UUID;
BEGIN
  FOR r IN (SELECT name, email, phone, role, category FROM verified_roster) LOOP
    -- Find canonical ID (matches exact email or matches clean name, prioritized by profile/sisu id)
    SELECT a.id INTO canonical_id
    FROM public.agents a
    WHERE LOWER(a.email) = LOWER(r.email)
       OR LOWER(REGEXP_REPLACE(a.name, '[^a-zA-Z]', '', 'g')) = LOWER(REGEXP_REPLACE(r.name, '[^a-zA-Z]', '', 'g'))
    ORDER BY 
      CASE WHEN LOWER(a.email) = LOWER(r.email) THEN 1 ELSE 2 END,
      CASE WHEN a.profile_id IS NOT NULL THEN 1 ELSE 2 END,
      CASE WHEN a.sisu_agent_id IS NOT NULL THEN 1 ELSE 2 END,
      a.created_at ASC
    LIMIT 1;

    IF canonical_id IS NOT NULL THEN
      -- Update canonical agent record with verified information
      UPDATE public.agents
      SET name = r.name,
          email = r.email,
          phone = COALESCE(r.phone, phone),
          role = r.role,
          category = r.category,
          active = true,
          updated_at = NOW()
      WHERE id = canonical_id;

      -- Repoint any other duplicate agents to the canonical ID and delete them
      FOR dupe_id IN (
        SELECT id FROM public.agents
        WHERE (LOWER(REGEXP_REPLACE(name, '[^a-zA-Z]', '', 'g')) = LOWER(REGEXP_REPLACE(r.name, '[^a-zA-Z]', '', 'g'))
           OR LOWER(email) = LOWER(r.email))
          AND id <> canonical_id
      ) LOOP
        -- Repoint transactions
        UPDATE public.transactions SET listing_agent_id = canonical_id WHERE listing_agent_id = dupe_id;
        UPDATE public.transactions SET selling_agent_id = canonical_id WHERE selling_agent_id = dupe_id;
        
        -- Repoint digest_log if present
        UPDATE public.digest_log SET agent_id = canonical_id WHERE agent_id = dupe_id;

        -- Repoint profiles if linked
        UPDATE public.profiles SET agent_id = canonical_id WHERE agent_id = dupe_id;

        -- Delete duplicate
        DELETE FROM public.agents WHERE id = dupe_id;
      END LOOP;
    ELSE
      -- Insert as brand new agent
      INSERT INTO public.agents (name, email, phone, role, category, active)
      VALUES (r.name, r.email, r.phone, r.role, r.category, true);
    END IF;
  END LOOP;
END $$;
