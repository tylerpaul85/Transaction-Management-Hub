-- Migration: Clean synthetic Sisu form prefixes from milestones.notes
-- This cleans up legacy synthetic notes while preserving any appended MSREG_TASK_APPROVAL JSON payload.

UPDATE public.milestones
SET notes = CASE
  -- If notes contains task approval metadata, strip the synthetic prefix if present
  WHEN notes LIKE '%---MSREG_TASK_APPROVAL---%' THEN
    CASE
      WHEN notes ~ '^(Completed|Marked No|In progress|N/A) via Sisu form:[^\n]*(\n+)?---MSREG_TASK_APPROVAL---' THEN
        regexp_replace(notes, '^(Completed|Marked No|In progress|N/A) via Sisu form:[^\n]*(\n+)?', '')
      ELSE notes
    END
  -- If notes only contains synthetic Sisu form notes, clear it to NULL so user TC memo comments are clean
  WHEN notes LIKE 'Completed via Sisu form:%'
    OR notes LIKE 'Marked No via Sisu form:%'
    OR notes LIKE 'In progress via Sisu form:%'
    OR notes LIKE 'N/A via Sisu form:%' THEN
    NULL
  ELSE notes
END
WHERE notes LIKE 'Completed via Sisu form:%'
   OR notes LIKE 'Marked No via Sisu form:%'
   OR notes LIKE 'In progress via Sisu form:%'
   OR notes LIKE 'N/A via Sisu form:%'
   OR (notes LIKE '%---MSREG_TASK_APPROVAL---%' AND notes ~ '^(Completed|Marked No|In progress|N/A) via Sisu form:');
