-- Migration: Route inspection_completed to inspection_ordered and inspection_satisfied to inspection_10day

INSERT INTO public.sisu_task_mappings (sisu_task_name, milestone_field, milestone_table, active)
VALUES
    ('inspection_completeds_63', 'inspection_ordered', 'milestones', true),
    ('inspection_completed', 'inspection_ordered', 'milestones', true),
    ('Inspection Completed?', 'inspection_ordered', 'milestones', true),
    ('Inspection completed?', 'inspection_ordered', 'milestones', true),
    ('inspection_satisfieds_63', 'inspection_10day', 'milestones', true),
    ('inspection_satisfied', 'inspection_10day', 'milestones', true),
    ('Inspection Satisfied?', 'inspection_10day', 'milestones', true),
    ('Inspection satisfied?', 'inspection_10day', 'milestones', true)
ON CONFLICT (sisu_task_name)
DO UPDATE SET 
    milestone_field = EXCLUDED.milestone_field,
    active = true,
    updated_at = now();
