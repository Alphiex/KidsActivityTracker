-- Add latitude and longitude columns to Activity table
ALTER TABLE "Activity" 
ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "directRegistrationUrl" TEXT,
ADD COLUMN IF NOT EXISTS "contactInfo" TEXT;