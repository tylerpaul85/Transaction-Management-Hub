-- Migration: Seed Sisu task mappings for all 10 custom form fields and ensure standard milestones for all transactions

-- 1. Seed sisu_task_mappings for exact names and common variations from Tyler's form
INSERT INTO public.sisu_task_mappings (sisu_task_name, milestone_field, milestone_table, active)
VALUES
    -- 1. Earnest Money
    ('Earnest money Deposited? (internal use)', 'earnest_money', 'milestones', true),
    ('Earnest money Deposited?', 'earnest_money', 'milestones', true),
    ('earnest_money_deposited_internal_use', 'earnest_money', 'milestones', true),
    ('earnest_money_deposited', 'earnest_money', 'milestones', true),

    -- 2. Inspection Ordered (including Tyler's spelling "ordred")
    ('Inspection ordred? - Internal Use', 'inspection_ordered', 'milestones', true),
    ('Inspection ordred?', 'inspection_ordered', 'milestones', true),
    ('Inspection ordered? - Internal Use', 'inspection_ordered', 'milestones', true),
    ('Inspection ordered?', 'inspection_ordered', 'milestones', true),
    ('inspection_ordred_internal_use', 'inspection_ordered', 'milestones', true),
    ('inspection_ordered_internal_use', 'inspection_ordered', 'milestones', true),

    -- 3. Inspection Satisfied
    ('Inspection Satisfied? - Internal Use', 'inspection_10day', 'milestones', true),
    ('Inspection Satisfied?', 'inspection_10day', 'milestones', true),
    ('inspection_satisfied_internal_use', 'inspection_10day', 'milestones', true),

    -- 4. Financing / Loan Commitment
    ('Financing / Loan Commitment - internal use', 'financing_contingency', 'milestones', true),
    ('Financing / Loan Commitment', 'financing_contingency', 'milestones', true),
    ('financing_loan_commitment_internal_use', 'financing_contingency', 'milestones', true),

    -- 5. Appraisal Received
    ('Appraisal Received (internal use)', 'appraisal_received', 'milestones', true),
    ('Appraisal Received', 'appraisal_received', 'milestones', true),
    ('appraisal_received_internal_use', 'appraisal_received', 'milestones', true),

    -- 6. Appraisal Satisfied
    ('Appraisal Satisfied (internal use)', 'appraisal_satisfied', 'milestones', true),
    ('Appraisal Satisfied', 'appraisal_satisfied', 'milestones', true),
    ('appraisal_satisfied_internal_use', 'appraisal_satisfied', 'milestones', true),

    -- 7. Insurance Binder Obtained
    ('Insurance Obtained? - Internal Use', 'insurance_binder', 'milestones', true),
    ('Insurance Obtained?', 'insurance_binder', 'milestones', true),
    ('Insurance Binder Obtained', 'insurance_binder', 'milestones', true),
    ('insurance_obtained_internal_use', 'insurance_binder', 'milestones', true),

    -- 8. Title Commitment & Clearance
    ('Title Commitment & Clearance - Internal use', 'title', 'milestones', true),
    ('Title Commitment & Clearance', 'title', 'milestones', true),
    ('title_commitment_clearance_internal_use', 'title', 'milestones', true),

    -- 9. Clear-to-Close
    ('Clear-to-Close (internal use)', 'ctc', 'milestones', true),
    ('Clear-to-Close', 'ctc', 'milestones', true),
    ('clear_to_close_internal_use', 'ctc', 'milestones', true),

    -- 10. Final Walkthrough
    ('Final Walkthrough (internal use)', 'walk_through', 'milestones', true),
    ('Final Walkthrough', 'walk_through', 'milestones', true),
    ('final_walkthrough_internal_use', 'walk_through', 'milestones', true)
ON CONFLICT (sisu_task_name) 
DO UPDATE SET 
    milestone_field = EXCLUDED.milestone_field,
    active = true,
    updated_at = now();

-- 2. Ensure all active transactions have rows in public.milestones for all 10 milestones
INSERT INTO public.milestones (transaction_id, milestone_type, status, source)
SELECT t.id, m.milestone_type::milestone_type_enum, 'pending', 'manual'
FROM public.transactions t
CROSS JOIN (
    VALUES 
        ('earnest_money'),
        ('inspection_ordered'),
        ('inspection_10day'),
        ('financing_contingency'),
        ('appraisal_received'),
        ('appraisal_satisfied'),
        ('insurance_binder'),
        ('title'),
        ('ctc'),
        ('walk_through')
) AS m(milestone_type)
ON CONFLICT (transaction_id, milestone_type) DO NOTHING;
