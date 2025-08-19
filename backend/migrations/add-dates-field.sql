-- Add dates field to Activity table
ALTER TABLE "Activity" 
ADD COLUMN IF NOT EXISTS "dates" TEXT;