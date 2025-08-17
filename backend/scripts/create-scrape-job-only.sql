-- Create ScrapeJob table only (simplified)

-- Create JobStatus enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JobStatus') THEN
        CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
    END IF;
END$$;

-- Create ScrapeJob table
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

-- Add foreign key
ALTER TABLE "ScrapeJob" 
ADD CONSTRAINT "ScrapeJob_providerId_fkey" 
FOREIGN KEY ("providerId") 
REFERENCES "Provider"("id") 
ON DELETE RESTRICT 
ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX "ScrapeJob_providerId_idx" ON "ScrapeJob"("providerId");
CREATE INDEX "ScrapeJob_status_idx" ON "ScrapeJob"("status");
CREATE INDEX "ScrapeJob_createdAt_idx" ON "ScrapeJob"("createdAt");

-- Verify
SELECT 'ScrapeJob table created successfully' as status;