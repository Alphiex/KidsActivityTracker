-- Comprehensive Schema Update Script
-- This script updates the database schema to match what the API expects

-- Begin transaction
BEGIN;

-- 1. Create missing enums
DO $$ 
BEGIN
    -- JobStatus enum for ScrapeJob
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JobStatus') THEN
        CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
        RAISE NOTICE 'Created JobStatus enum';
    END IF;
END$$;

-- 2. Create ScrapeJob table (required by API)
CREATE TABLE IF NOT EXISTS "ScrapeJob" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "providerId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "activitiesFound" INTEGER NOT NULL DEFAULT 0,
    "activitiesCreated" INTEGER NOT NULL DEFAULT 0,
    "activitiesUpdated" INTEGER NOT NULL DEFAULT 0,
    "activitiesRemoved" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "errorDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapeJob_pkey" PRIMARY KEY ("id")
);

-- 3. Add foreign key constraints
DO $$ 
BEGIN
    -- ScrapeJob -> Provider
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND table_name = 'ScrapeJob' 
        AND constraint_name = 'ScrapeJob_providerId_fkey'
    ) THEN
        ALTER TABLE "ScrapeJob" 
        ADD CONSTRAINT "ScrapeJob_providerId_fkey" 
        FOREIGN KEY ("providerId") 
        REFERENCES "Provider"("id") 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE;
        RAISE NOTICE 'Added ScrapeJob_providerId_fkey';
    END IF;
END$$;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS "ScrapeJob_providerId_idx" ON "ScrapeJob"("providerId");
CREATE INDEX IF NOT EXISTS "ScrapeJob_status_idx" ON "ScrapeJob"("status");
CREATE INDEX IF NOT EXISTS "ScrapeJob_createdAt_idx" ON "ScrapeJob"("createdAt");
CREATE INDEX IF NOT EXISTS "ScrapeJob_status_createdAt_idx" ON "ScrapeJob"("status", "createdAt" DESC);

-- 5. Add missing columns to existing tables if needed
-- Check if Activity table has all expected columns
DO $$ 
BEGIN
    -- Add registrationStatus if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Activity' 
        AND column_name = 'registrationStatus'
    ) THEN
        ALTER TABLE "Activity" ADD COLUMN "registrationStatus" TEXT;
        RAISE NOTICE 'Added registrationStatus to Activity';
    END IF;
    
    -- Add signupUrl if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Activity' 
        AND column_name = 'signupUrl'
    ) THEN
        ALTER TABLE "Activity" ADD COLUMN "signupUrl" TEXT;
        RAISE NOTICE 'Added signupUrl to Activity';
    END IF;
    
    -- Add detailsUrl if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Activity' 
        AND column_name = 'detailsUrl'
    ) THEN
        ALTER TABLE "Activity" ADD COLUMN "detailsUrl" TEXT;
        RAISE NOTICE 'Added detailsUrl to Activity';
    END IF;
END$$;

-- 6. Migrate existing data if ScraperRun exists
DO $$ 
DECLARE
    migrated_count INTEGER;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ScraperRun'
    ) THEN
        -- Migrate data from ScraperRun to ScrapeJob
        WITH migrated AS (
            INSERT INTO "ScrapeJob" (
                "id",
                "providerId",
                "status",
                "startedAt",
                "completedAt",
                "activitiesFound",
                "activitiesCreated",
                "activitiesUpdated",
                "activitiesRemoved",
                "errorMessage",
                "errorDetails",
                "createdAt"
            )
            SELECT 
                id,
                "providerId",
                CASE 
                    WHEN status = 'pending' THEN 'PENDING'::"JobStatus"
                    WHEN status = 'running' THEN 'RUNNING'::"JobStatus"
                    WHEN status = 'completed' THEN 'COMPLETED'::"JobStatus"
                    WHEN status = 'failed' THEN 'FAILED'::"JobStatus"
                    WHEN status = 'cancelled' THEN 'CANCELLED'::"JobStatus"
                    ELSE 'FAILED'::"JobStatus"
                END,
                "startedAt",
                "completedAt",
                "activitiesFound",
                "activitiesCreated",
                "activitiesUpdated",
                COALESCE("activitiesDeactivated", 0) + COALESCE("activitiesPurged", 0),
                "errorMessage",
                CASE 
                    WHEN logs IS NOT NULL THEN jsonb_build_object('logs', logs)
                    ELSE NULL
                END,
                "createdAt"
            FROM "ScraperRun"
            WHERE NOT EXISTS (
                SELECT 1 FROM "ScrapeJob" WHERE "ScrapeJob".id = "ScraperRun".id
            )
            RETURNING 1
        )
        SELECT COUNT(*) INTO migrated_count FROM migrated;
        
        RAISE NOTICE 'Migrated % records from ScraperRun to ScrapeJob', migrated_count;
    END IF;
END$$;

-- 7. Create initial scrape job for testing
INSERT INTO "ScrapeJob" ("providerId", "status", "createdAt")
SELECT id, 'PENDING', NOW() 
FROM "Provider" 
WHERE name = 'NVRC' 
AND NOT EXISTS (
    SELECT 1 FROM "ScrapeJob" 
    WHERE "providerId" = "Provider".id 
    AND status = 'PENDING'
)
LIMIT 1;

-- 8. Update schema version tracking
CREATE TABLE IF NOT EXISTS "_SchemaUpdates" (
    "id" SERIAL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "_SchemaUpdates" ("version", "description")
VALUES ('scrape_job_restoration', 'Restored ScrapeJob table for API compatibility');

-- Commit transaction
COMMIT;

-- Verification queries
SELECT 'Schema Update Summary' as report;

SELECT 
    'Tables' as category,
    COUNT(*) as count 
FROM information_schema.tables 
WHERE table_schema = 'public'
UNION ALL
SELECT 
    'ScrapeJob Records' as category,
    COUNT(*) as count 
FROM "ScrapeJob"
UNION ALL
SELECT 
    'Pending Jobs' as category,
    COUNT(*) as count 
FROM "ScrapeJob" 
WHERE status = 'PENDING';

-- Show recent scrape jobs
SELECT 
    id,
    "providerId",
    status,
    "activitiesFound",
    "createdAt"
FROM "ScrapeJob" 
ORDER BY "createdAt" DESC 
LIMIT 5;