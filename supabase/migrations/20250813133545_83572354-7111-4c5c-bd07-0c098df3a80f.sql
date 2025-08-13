-- Fix the company_name column to allow null values
ALTER TABLE public.tests 
ALTER COLUMN company_name DROP NOT NULL;