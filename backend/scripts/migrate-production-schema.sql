-- Add activityType column to Activity table if it doesn't exist
ALTER TABLE "Activity" 
ADD COLUMN IF NOT EXISTS "activityType" TEXT;

-- Add activitySubtype column to Activity table if it doesn't exist  
ALTER TABLE "Activity"
ADD COLUMN IF NOT EXISTS "activitySubtype" TEXT;

-- Add activityTypeId column to Activity table if it doesn't exist
ALTER TABLE "Activity"
ADD COLUMN IF NOT EXISTS "activityTypeId" TEXT;

-- Add activitySubtypeId column to Activity table if it doesn't exist
ALTER TABLE "Activity"
ADD COLUMN IF NOT EXISTS "activitySubtypeId" TEXT;

-- Add requiresParent column to Activity table if it doesn't exist
ALTER TABLE "Activity"
ADD COLUMN IF NOT EXISTS "requiresParent" BOOLEAN DEFAULT false;

-- Add parentInvolvement column to Activity table if it doesn't exist
ALTER TABLE "Activity"
ADD COLUMN IF NOT EXISTS "parentInvolvement" TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "Activity_activityTypeId_idx" ON "Activity"("activityTypeId");
CREATE INDEX IF NOT EXISTS "Activity_activitySubtypeId_idx" ON "Activity"("activitySubtypeId");
CREATE INDEX IF NOT EXISTS "Activity_activityType_idx" ON "Activity"("activityType");

-- Add foreign key constraints (only if columns exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'Activity_activityTypeId_fkey') THEN
        ALTER TABLE "Activity" 
        ADD CONSTRAINT "Activity_activityTypeId_fkey" 
        FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'Activity_activitySubtypeId_fkey') THEN
        ALTER TABLE "Activity" 
        ADD CONSTRAINT "Activity_activitySubtypeId_fkey" 
        FOREIGN KEY ("activitySubtypeId") REFERENCES "ActivitySubtype"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;