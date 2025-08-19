-- Add new fields to Activity table
ALTER TABLE "Activity" 
ADD COLUMN IF NOT EXISTS "registrationEndDate" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "registrationEndTime" TEXT,
ADD COLUMN IF NOT EXISTS "costIncludesTax" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "taxAmount" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "startTime" TEXT,
ADD COLUMN IF NOT EXISTS "endTime" TEXT,
ADD COLUMN IF NOT EXISTS "courseDetails" TEXT,
ADD COLUMN IF NOT EXISTS "totalSpots" INTEGER;

-- Create index for registration end date
CREATE INDEX IF NOT EXISTS "Activity_registrationEndDate_idx" ON "Activity"("registrationEndDate");