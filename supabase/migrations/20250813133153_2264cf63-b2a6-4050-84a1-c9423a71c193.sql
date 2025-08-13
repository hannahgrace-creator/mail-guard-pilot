-- Remove max_permutations and consent columns from tests table
ALTER TABLE public.tests 
DROP COLUMN IF EXISTS max_permutations,
DROP COLUMN IF EXISTS consent;

-- Add verification columns to email_candidates table if they don't exist
ALTER TABLE public.email_candidates 
ADD COLUMN IF NOT EXISTS mx_records TEXT[],
ADD COLUMN IF NOT EXISTS smtp_response TEXT,
ADD COLUMN IF NOT EXISTS delivery_response TEXT;