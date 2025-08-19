-- Add prerequisites text column to Activity table
ALTER TABLE "Activity" 
ADD COLUMN IF NOT EXISTS "prerequisites" TEXT;