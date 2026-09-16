-- ==============================================================================
-- MSREG Marketing Hub — Transaction Management Seed Data
-- ==============================================================================

-- 1. Insert Sample Profiles (for local dev / seed)
INSERT INTO public.profiles (id, email, full_name, role)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'tyler.agent@msreg.com', 'Tyler Miller', 'agent'),
    ('22222222-2222-2222-2222-222222222222', 'sophia.agent@msreg.com', 'Sophia Montgomery', 'agent'),
    ('33333333-3333-3333-3333-333333333333', 'brandon.agent@msreg.com', 'Brandon Walsh', 'agent'),
    ('44444444-4444-4444-4444-444444444444', 'sarah.tc@msreg.com', 'Sarah Jenkins', 'tc'),
    ('55555555-5555-5555-5555-555555555555', 'michael.lc@msreg.com', 'Michael Chang', 'listing_coordinator'),
    ('66666666-6666-6666-6666-666666666666', 'admin@msreg.com', 'David Admin', 'admin')
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

-- 2. Insert Agents
INSERT INTO public.agents (id, profile_id, name, email, phone, sisu_agent_id, active)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Tyler Miller', 'tyler.agent@msreg.com', '(312) 555-0142', 'SISU-AGT-101', true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Sophia Montgomery', 'sophia.agent@msreg.com', '(312) 555-0188', 'SISU-AGT-102', true),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'Brandon Walsh', 'brandon.agent@msreg.com', '(312) 555-0199', 'SISU-AGT-103', true)
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    sisu_agent_id = EXCLUDED.sisu_agent_id,
    active = EXCLUDED.active;

-- 3. Insert Ops Users (TC, Listing Coordinator, Admin)
INSERT INTO public.ops_users (id, profile_id, name, email, role)
VALUES
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '44444444-4444-4444-4444-444444444444', 'Sarah Jenkins', 'sarah.tc@msreg.com', 'tc'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '55555555-5555-5555-5555-555555555555', 'Michael Chang', 'michael.lc@msreg.com', 'listing_coordinator'),
    ('ffffffff-ffff-ffff-ffff-ffffffffffff', '66666666-6666-6666-6666-666666666666', 'David Admin', 'admin@msreg.com', 'admin')
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role;

-- 4. Insert Sample Transactions
-- Transaction 1: Buyer side deal (Tyler Miller) in inspection phase
INSERT INTO public.transactions (
    id,
    sisu_transaction_id,
    status,
    property_address,
    city,
    side,
    client_name,
    client_phone,
    other_party_name,
    other_party_agent,
    listing_agent_id,
    selling_agent_id,
    assigned_tc_id,
    contract_date,
    created_at
)
VALUES (
    't1111111-1111-1111-1111-111111111111',
    'SISU-TRX-8901',
    'active',
    '2100 N Lincoln Park West, Unit 18A',
    'Chicago',
    'buyer',
    'Dr. Marcus Vance & Elena Rostova',
    '(312) 555-8921',
    'Vanderbilt Trust',
    'Victoria Sterling (Sotheby’s)',
    NULL,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', -- Tyler Miller (Buyer Rep)
    'dddddddd-dddd-dddd-dddd-dddddddddddd', -- Sarah Jenkins (TC)
    '2026-09-08',
    '2026-09-08 10:00:00+00'
) ON CONFLICT (id) DO NOTHING;

-- Transaction 2: Seller side deal (Sophia Montgomery) in Clear to Close phase
INSERT INTO public.transactions (
    id,
    sisu_transaction_id,
    status,
    property_address,
    city,
    side,
    client_name,
    client_phone,
    other_party_name,
    other_party_agent,
    listing_agent_id,
    selling_agent_id,
    assigned_tc_id,
    contract_date,
    created_at
)
VALUES (
    't2222222-2222-2222-2222-222222222222',
    'SISU-TRX-8902',
    'active',
    '1428 N State Parkway',
    'Chicago',
    'seller',
    'Harrison & Claire Vanderbilt',
    '(312) 555-7001',
    'Jonathan Sterling',
    'Alexander Wright (@properties)',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', -- Sophia Montgomery (Listing Rep)
    NULL,
    'dddddddd-dddd-dddd-dddd-dddddddddddd', -- Sarah Jenkins (TC)
    '2026-08-20',
    '2026-08-20 14:30:00+00'
) ON CONFLICT (id) DO NOTHING;

-- Transaction 3: Buyer side deal (Tyler Miller) in early Escrow & EMD phase
INSERT INTO public.transactions (
    id,
    sisu_transaction_id,
    status,
    property_address,
    city,
    side,
    client_name,
    client_phone,
    other_party_name,
    other_party_agent,
    listing_agent_id,
    selling_agent_id,
    assigned_tc_id,
    contract_date,
    created_at
)
VALUES (
    't3333333-3333-3333-3333-333333333333',
    'SISU-TRX-8903',
    'pending',
    '450 E Waterside Drive, Penthouse 4201',
    'Chicago',
    'buyer',
    'Liam & Vivienne Sterling',
    '(312) 555-3211',
    'Waterside Holdings LLC',
    'Erika Thorne (Compass)',
    NULL,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', -- Tyler Miller (Buyer Rep)
    'dddddddd-dddd-dddd-dddd-dddddddddddd', -- Sarah Jenkins (TC)
    '2026-09-12',
    '2026-09-12 09:15:00+00'
) ON CONFLICT (id) DO NOTHING;

-- 5. Insert Sample Milestones for Transaction 1
INSERT INTO public.milestones (transaction_id, milestone_type, target_date, actual_date, status, source, notes)
VALUES
    ('t1111111-1111-1111-1111-111111111111', 'earnest_money', '2026-09-11', '2026-09-10', 'satisfied', 'manual', 'Initial $50k wire confirmed by Chicago Title.'),
    ('t1111111-1111-1111-1111-111111111111', 'inspection_ordered', '2026-09-12', '2026-09-11', 'satisfied', 'manual', 'Home inspection scheduled with Elite Inspection Group.'),
    ('t1111111-1111-1111-1111-111111111111', 'inspection_notice_sent', '2026-09-16', '2026-09-15', 'notice_sent', 'manual', 'Inspection report and repair amendment delivered to seller attorney.'),
    ('t1111111-1111-1111-1111-111111111111', 'inspection_10day', '2026-09-18', NULL, 'pending', 'manual', '10-day inspection contingency deadline.'),
    ('t1111111-1111-1111-1111-111111111111', 'sale_contingency', NULL, NULL, 'na', 'manual', 'No buyer home sale contingency.'),
    ('t1111111-1111-1111-1111-111111111111', 'financing_contingency', '2026-10-06', NULL, 'pending', 'manual', 'JPMorgan Chase loan commitment deadline.'),
    ('t1111111-1111-1111-1111-111111111111', 'appraisal_ordered', '2026-09-15', '2026-09-14', 'ordered', 'manual', 'Appraisal ordered through Chase AMC.'),
    ('t1111111-1111-1111-1111-111111111111', 'appraisal_received', '2026-09-26', NULL, 'pending', 'manual', 'Awaiting appraiser report delivery.'),
    ('t1111111-1111-1111-1111-111111111111', 'appraisal_satisfied', '2026-09-29', NULL, 'pending', 'manual', 'Appraisal condition clearance.'),
    ('t1111111-1111-1111-1111-111111111111', 'title', '2026-09-22', NULL, 'pending', 'manual', 'Chicago Title commitment Schedule B review.'),
    ('t1111111-1111-1111-1111-111111111111', 'walk_through', '2026-10-14', NULL, 'pending', 'manual', 'Pre-closing final inspection.'),
    ('t1111111-1111-1111-1111-111111111111', 'ctc', '2026-10-09', NULL, 'pending', 'manual', 'Target Clear-To-Close.'),
    ('t1111111-1111-1111-1111-111111111111', 'closing', '2026-10-15', NULL, 'pending', 'manual', 'Scheduled settlement at Chicago Title.');

-- 6. Insert Sample Milestones for Transaction 2 (Clear to Close)
INSERT INTO public.milestones (transaction_id, milestone_type, target_date, actual_date, status, source, notes)
VALUES
    ('t2222222-2222-2222-2222-222222222222', 'earnest_money', '2026-08-24', '2026-08-22', 'satisfied', 'manual', 'Earnest money $100k verified.'),
    ('t2222222-2222-2222-2222-222222222222', 'inspection_ordered', '2026-08-23', '2026-08-22', 'satisfied', 'manual', 'Buyer inspection conducted.'),
    ('t2222222-2222-2222-2222-222222222222', 'inspection_10day', '2026-08-30', '2026-08-29', 'satisfied', 'manual', 'Inspection repair credit agreed at $4,500.'),
    ('t2222222-2222-2222-2222-222222222222', 'financing_contingency', '2026-09-14', '2026-09-13', 'satisfied', 'manual', 'Full loan commitment granted.'),
    ('t2222222-2222-2222-2222-222222222222', 'appraisal_satisfied', '2026-09-08', '2026-09-07', 'satisfied', 'manual', 'Appraised at full contract value of $3,850,000.'),
    ('t2222222-2222-2222-2222-222222222222', 'title', '2026-09-10', '2026-09-10', 'satisfied', 'manual', 'First American Title cleared all liens.'),
    ('t2222222-2222-2222-2222-222222222222', 'ctc', '2026-09-14', '2026-09-14', 'satisfied', 'manual', 'Clear To Close delivered.'),
    ('t2222222-2222-2222-2222-222222222222', 'walk_through', '2026-09-21', NULL, 'pending', 'manual', 'Scheduled for 10:00 AM.'),
    ('t2222222-2222-2222-2222-222222222222', 'closing', '2026-09-22', NULL, 'pending', 'manual', 'Settlement at First American Title.');

-- 7. Insert Sample Milestones for Transaction 3 (Early Escrow)
INSERT INTO public.milestones (transaction_id, milestone_type, target_date, actual_date, status, source, notes)
VALUES
    ('t3333333-3333-3333-3333-333333333333', 'earnest_money', '2026-09-17', NULL, 'pending', 'manual', 'Initial wire instructions issued.'),
    ('t3333333-3333-3333-3333-333333333333', 'inspection_ordered', '2026-09-18', '2026-09-15', 'ordered', 'manual', 'Inspector booked for Friday.'),
    ('t3333333-3333-3333-3333-333333333333', 'inspection_10day', '2026-09-24', NULL, 'pending', 'manual', '10-day period begins upon mutual acceptance.'),
    ('t3333333-3333-3333-3333-333333333333', 'appraisal_ordered', '2026-09-25', NULL, 'pending', 'manual', 'Lender to order appraisal.'),
    ('t3333333-3333-3333-3333-333333333333', 'financing_contingency', '2026-10-18', NULL, 'pending', 'manual', 'Mortgage commitment due.'),
    ('t3333333-3333-3333-3333-333333333333', 'title', '2026-09-28', NULL, 'pending', 'manual', 'Near North Title commitment order.'),
    ('t3333333-3333-3333-3333-333333333333', 'closing', '2026-10-28', NULL, 'pending', 'manual', 'Target closing date.');
