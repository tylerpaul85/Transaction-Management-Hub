-- Migration: Add 'no' to milestone_status_enum
-- Allows marking rejected, unfulfilled, or "No" milestone items in Red
ALTER TYPE milestone_status_enum ADD VALUE IF NOT EXISTS 'no';
