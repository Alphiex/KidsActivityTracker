-- Create all missing tables and columns for Kids Activity Tracker
-- This script is idempotent and can be run multiple times safely

-- Add missing columns to Activity table if they don't exist
DO $$ 
BEGIN
    -- Enhanced detail fields
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'dates') THEN
        ALTER TABLE "Activity" ADD COLUMN "dates" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'registrationEndDate') THEN
        ALTER TABLE "Activity" ADD COLUMN "registrationEndDate" TIMESTAMP(3);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'registrationEndTime') THEN
        ALTER TABLE "Activity" ADD COLUMN "registrationEndTime" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'costIncludesTax') THEN
        ALTER TABLE "Activity" ADD COLUMN "costIncludesTax" BOOLEAN DEFAULT true;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'taxAmount') THEN
        ALTER TABLE "Activity" ADD COLUMN "taxAmount" DOUBLE PRECISION;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'totalSpots') THEN
        ALTER TABLE "Activity" ADD COLUMN "totalSpots" INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'courseId') THEN
        ALTER TABLE "Activity" ADD COLUMN "courseId" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'lastSeenAt') THEN
        ALTER TABLE "Activity" ADD COLUMN "lastSeenAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'startTime') THEN
        ALTER TABLE "Activity" ADD COLUMN "startTime" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'endTime') THEN
        ALTER TABLE "Activity" ADD COLUMN "endTime" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'registrationStatus') THEN
        ALTER TABLE "Activity" ADD COLUMN "registrationStatus" TEXT DEFAULT 'Unknown';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'registrationButtonText') THEN
        ALTER TABLE "Activity" ADD COLUMN "registrationButtonText" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'detailUrl') THEN
        ALTER TABLE "Activity" ADD COLUMN "detailUrl" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'fullDescription') THEN
        ALTER TABLE "Activity" ADD COLUMN "fullDescription" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'instructor') THEN
        ALTER TABLE "Activity" ADD COLUMN "instructor" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'prerequisites') THEN
        ALTER TABLE "Activity" ADD COLUMN "prerequisites" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'whatToBring') THEN
        ALTER TABLE "Activity" ADD COLUMN "whatToBring" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'fullAddress') THEN
        ALTER TABLE "Activity" ADD COLUMN "fullAddress" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'latitude') THEN
        ALTER TABLE "Activity" ADD COLUMN "latitude" DOUBLE PRECISION;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'longitude') THEN
        ALTER TABLE "Activity" ADD COLUMN "longitude" DOUBLE PRECISION;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'directRegistrationUrl') THEN
        ALTER TABLE "Activity" ADD COLUMN "directRegistrationUrl" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'contactInfo') THEN
        ALTER TABLE "Activity" ADD COLUMN "contactInfo" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'courseDetails') THEN
        ALTER TABLE "Activity" ADD COLUMN "courseDetails" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'hasMultipleSessions') THEN
        ALTER TABLE "Activity" ADD COLUMN "hasMultipleSessions" BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'sessionCount') THEN
        ALTER TABLE "Activity" ADD COLUMN "sessionCount" INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Activity' AND column_name = 'hasPrerequisites') THEN
        ALTER TABLE "Activity" ADD COLUMN "hasPrerequisites" BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Create ActivitySession table
CREATE TABLE IF NOT EXISTS "ActivitySession" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "activityId" TEXT NOT NULL,
    "sessionNumber" INTEGER,
    "date" TEXT,
    "dayOfWeek" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "location" TEXT,
    "subLocation" TEXT,
    "instructor" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivitySession_pkey" PRIMARY KEY ("id")
);

-- Create ActivityPrerequisite table
CREATE TABLE IF NOT EXISTS "ActivityPrerequisite" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "activityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "courseId" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityPrerequisite_pkey" PRIMARY KEY ("id")
);

-- Add missing columns to ActivitySession if table already exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ActivitySession') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ActivitySession' AND column_name = 'dayOfWeek') THEN
            ALTER TABLE "ActivitySession" ADD COLUMN "dayOfWeek" TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ActivitySession' AND column_name = 'subLocation') THEN
            ALTER TABLE "ActivitySession" ADD COLUMN "subLocation" TEXT;
        END IF;
    END IF;
END $$;

-- Add foreign key constraints
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivitySession_activityId_fkey') THEN
        ALTER TABLE "ActivitySession" ADD CONSTRAINT "ActivitySession_activityId_fkey" 
            FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityPrerequisite_activityId_fkey') THEN
        ALTER TABLE "ActivityPrerequisite" ADD CONSTRAINT "ActivityPrerequisite_activityId_fkey" 
            FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS "ActivitySession_activityId_idx" ON "ActivitySession"("activityId");
CREATE INDEX IF NOT EXISTS "ActivitySession_date_idx" ON "ActivitySession"("date");
CREATE INDEX IF NOT EXISTS "ActivityPrerequisite_activityId_idx" ON "ActivityPrerequisite"("activityId");

-- Create indexes on Activity table for new fields
CREATE INDEX IF NOT EXISTS "Activity_registrationStatus_idx" ON "Activity"("registrationStatus");
CREATE INDEX IF NOT EXISTS "Activity_latitude_longitude_idx" ON "Activity"("latitude", "longitude");
CREATE INDEX IF NOT EXISTS "Activity_lastSeenAt_idx" ON "Activity"("lastSeenAt");

-- Update trigger for ActivitySession
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ActivitySession_updated_at') THEN
        CREATE TRIGGER update_ActivitySession_updated_at BEFORE UPDATE ON "ActivitySession" 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ActivityPrerequisite_updated_at') THEN
        CREATE TRIGGER update_ActivityPrerequisite_updated_at BEFORE UPDATE ON "ActivityPrerequisite" 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;