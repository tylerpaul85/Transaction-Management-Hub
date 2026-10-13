-- Migration: Add termite inspection milestones and task mappings
-- Adds termite_inspection_ordered and termite_inspection_received to milestone_type_enum

ALTER TYPE milestone_type_enum ADD VALUE IF NOT EXISTS 'termite_inspection_ordered';
ALTER TYPE milestone_type_enum ADD VALUE IF NOT EXISTS 'termite_inspection_received';

-- Seed task mappings for Sisu custom form / task fields
INSERT INTO public.sisu_task_mappings (sisu_task_name, milestone_field, milestone_table, active)
VALUES
    -- Termite Inspection Ordered (Seller roadmap)
    ('Termite Inspection Ordered', 'termite_inspection_ordered', 'milestones', true),
    ('Termite Inspection Ordered?', 'termite_inspection_ordered', 'milestones', true),
    ('Termite Inspection Ordered - Internal Use', 'termite_inspection_ordered', 'milestones', true),
    ('Termite Inspection Ordered? - Internal Use', 'termite_inspection_ordered', 'milestones', true),
    ('Termite Inspection Ordered (internal use)', 'termite_inspection_ordered', 'milestones', true),
    ('Termite Inspection Ordered? (internal use)', 'termite_inspection_ordered', 'milestones', true),
    ('termite_inspection_ordered', 'termite_inspection_ordered', 'milestones', true),
    ('termite_inspection_ordered_internal_use', 'termite_inspection_ordered', 'milestones', true),
    ('termite_inspection_ordereds_63', 'termite_inspection_ordered', 'milestones', true),

    -- Termite Inspection Received (Seller & Buyer roadmap)
    ('Termite Inspection Received', 'termite_inspection_received', 'milestones', true),
    ('Termite Inspection Received?', 'termite_inspection_received', 'milestones', true),
    ('Termite Inspection Received - Internal Use', 'termite_inspection_received', 'milestones', true),
    ('Termite Inspection Received? - Internal Use', 'termite_inspection_received', 'milestones', true),
    ('Termite Inspection Received (internal use)', 'termite_inspection_received', 'milestones', true),
    ('Termite Inspection Received? (internal use)', 'termite_inspection_received', 'milestones', true),
    ('termite_inspection_received', 'termite_inspection_received', 'milestones', true),
    ('termite_inspection_received_internal_use', 'termite_inspection_received', 'milestones', true),
    ('termite_inspection_receiveds_63', 'termite_inspection_received', 'milestones', true),
    ('Termite Inspection', 'termite_inspection_received', 'milestones', true),
    ('termite_inspection', 'termite_inspection_received', 'milestones', true)
ON CONFLICT (sisu_task_name) 
DO UPDATE SET
    milestone_field = EXCLUDED.milestone_field,
    active = EXCLUDED.active,
    updated_at = NOW();
