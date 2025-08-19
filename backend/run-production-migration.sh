#!/bin/bash

echo "🔄 Running production database migration..."

# Export database URL for local execution
export DATABASE_URL="postgresql://postgres:KidsTracker2024!@34.42.149.102/kidsactivity"

# Run the SQL directly
psql "$DATABASE_URL" << 'EOF'
-- Create ActivitySession table for multiple sessions per activity
CREATE TABLE IF NOT EXISTS "ActivitySession" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "sessionNumber" INTEGER,
    "date" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "location" TEXT,
    "instructor" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivitySession_pkey" PRIMARY KEY ("id")
);

-- Create ActivityPrerequisite table for prerequisites with URLs
CREATE TABLE IF NOT EXISTS "ActivityPrerequisite" (
    "id" TEXT NOT NULL,
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

-- Add foreign key constraints if they don't exist
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

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "ActivitySession_activityId_idx" ON "ActivitySession"("activityId");
CREATE INDEX IF NOT EXISTS "ActivitySession_date_idx" ON "ActivitySession"("date");
CREATE INDEX IF NOT EXISTS "ActivityPrerequisite_activityId_idx" ON "ActivityPrerequisite"("activityId");

-- Add new fields to Activity table if they don't exist
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "hasMultipleSessions" BOOLEAN DEFAULT false;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "sessionCount" INTEGER DEFAULT 0;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "hasPrerequisites" BOOLEAN DEFAULT false;

-- Show results
SELECT 
    'ActivitySession' as table_name, 
    COUNT(*) as row_count 
FROM "ActivitySession"
UNION ALL
SELECT 
    'ActivityPrerequisite' as table_name, 
    COUNT(*) as row_count 
FROM "ActivityPrerequisite";
EOF

echo "✅ Migration completed!"