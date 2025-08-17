-- Add Missing ScrapeJob Table for Backward Compatibility
-- This script adds the ScrapeJob table that the API expects

-- Create JobStatus enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JobStatus') THEN
        CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
    END IF;
END$$;

-- Create ScrapeJob table if it doesn't exist
CREATE TABLE IF NOT EXISTS "ScrapeJob" (
    "id" TEXT NOT NULL,
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

-- Create foreign key to Provider if not exists
DO $$ 
BEGIN
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
    END IF;
END$$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS "ScrapeJob_providerId_idx" ON "ScrapeJob"("providerId");
CREATE INDEX IF NOT EXISTS "ScrapeJob_status_idx" ON "ScrapeJob"("status");
CREATE INDEX IF NOT EXISTS "ScrapeJob_createdAt_idx" ON "ScrapeJob"("createdAt");

-- Migrate data from ScraperRun to ScrapeJob if ScraperRun exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ScraperRun'
    ) THEN
        -- Insert data from ScraperRun to ScrapeJob
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
                WHEN status = 'pending' THEN 'PENDING'::JobStatus
                WHEN status = 'running' THEN 'RUNNING'::JobStatus
                WHEN status = 'completed' THEN 'COMPLETED'::JobStatus
                WHEN status = 'failed' THEN 'FAILED'::JobStatus
                WHEN status = 'cancelled' THEN 'CANCELLED'::JobStatus
                ELSE 'FAILED'::JobStatus
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
        );
        
        RAISE NOTICE 'Migrated % records from ScraperRun to ScrapeJob', 
            (SELECT COUNT(*) FROM "ScraperRun");
    END IF;
END$$;

-- Verify the table was created
SELECT 
    'ScrapeJob table created' as status,
    COUNT(*) as record_count 
FROM "ScrapeJob";

-- Show sample records
SELECT * FROM "ScrapeJob" ORDER BY "createdAt" DESC LIMIT 5;