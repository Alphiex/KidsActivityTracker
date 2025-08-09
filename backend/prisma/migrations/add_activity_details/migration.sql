-- Add new fields to Activity table for enhanced details
ALTER TABLE "Activity" 
ADD COLUMN IF NOT EXISTS "registrationStatus" TEXT DEFAULT 'Unknown',
ADD COLUMN IF NOT EXISTS "registrationButtonText" TEXT,
ADD COLUMN IF NOT EXISTS "detailUrl" TEXT,
ADD COLUMN IF NOT EXISTS "fullDescription" TEXT,
ADD COLUMN IF NOT EXISTS "instructor" TEXT,
ADD COLUMN IF NOT EXISTS "prerequisites" TEXT,
ADD COLUMN IF NOT EXISTS "whatToBring" TEXT,
ADD COLUMN IF NOT EXISTS "fullAddress" TEXT,
ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "directRegistrationUrl" TEXT,
ADD COLUMN IF NOT EXISTS "contactInfo" TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS "Activity_registrationStatus_idx" ON "Activity"("registrationStatus");
CREATE INDEX IF NOT EXISTS "Activity_latitude_longitude_idx" ON "Activity"("latitude", "longitude");