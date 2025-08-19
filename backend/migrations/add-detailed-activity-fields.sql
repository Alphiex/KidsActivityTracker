-- Add new fields to Activity table
ALTER TABLE "Activity" 
ADD COLUMN IF NOT EXISTS "registrationEndDate" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "registrationEndTime" TEXT,
ADD COLUMN IF NOT EXISTS "costIncludesTax" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "taxAmount" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "startTime" TEXT,
ADD COLUMN IF NOT EXISTS "endTime" TEXT,
ADD COLUMN IF NOT EXISTS "courseDetails" TEXT;

-- Add new fields to ActivitySession table (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ActivitySession') THEN
        ALTER TABLE "ActivitySession"
        ADD COLUMN IF NOT EXISTS "dayOfWeek" TEXT,
        ADD COLUMN IF NOT EXISTS "subLocation" TEXT;
    END IF;
END$$;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS "Activity_registrationEndDate_idx" ON "Activity"("registrationEndDate");