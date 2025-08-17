-- Check Current Schema Script
-- This script shows the current state of the database schema

-- Check all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check if ScrapeJob table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'ScrapeJob'
) as scrape_job_exists;

-- Check if ScraperRun table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'ScraperRun'
) as scraper_run_exists;

-- Check columns in Provider table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'Provider'
ORDER BY ordinal_position;

-- Check if JobStatus enum exists
SELECT EXISTS (
  SELECT 1 FROM pg_type 
  WHERE typname = 'JobStatus'
) as job_status_enum_exists;

-- Show all enum types
SELECT 
  n.nspname as schema,
  t.typname as enum_name,
  array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
JOIN pg_namespace n ON n.oid = t.typnamespace
GROUP BY n.nspname, t.typname;

-- Check ScraperRun structure if it exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'ScraperRun'
ORDER BY ordinal_position;

-- Check foreign key relationships
SELECT
    tc.table_name as source_table,
    kcu.column_name as source_column,
    ccu.table_name AS target_table,
    ccu.column_name AS target_column
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
AND (tc.table_name = 'Provider' OR tc.table_name = 'ScraperRun' OR tc.table_name = 'ScrapeJob')
ORDER BY tc.table_name;