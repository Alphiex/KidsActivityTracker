-- Comprehensive schema update for enhanced activity tracking
-- This migration adds all the new fields for detailed activity information

-- Add new fields to Activity table (first statement)
ALTER TABLE "Activity" 
ADD COLUMN IF NOT EXISTS "dates" TEXT,
ADD COLUMN IF NOT EXISTS "registrationStatus" TEXT DEFAULT 'Unknown';

-- Ensure all enhanced fields exist (second statement)
ALTER TABLE "Activity"
ADD COLUMN IF NOT EXISTS "registrationEndDate" TIMESTAMP,
ADD COLUMN IF NOT EXISTS "registrationEndTime" TEXT,
ADD COLUMN IF NOT EXISTS "costIncludesTax" BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS "taxAmount" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "startTime" TEXT,
ADD COLUMN IF NOT EXISTS "endTime" TEXT,
ADD COLUMN IF NOT EXISTS "courseDetails" TEXT,
ADD COLUMN IF NOT EXISTS "totalSpots" INTEGER;