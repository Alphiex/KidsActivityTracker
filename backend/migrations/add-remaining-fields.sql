-- Add remaining missing columns to Activity table
ALTER TABLE "Activity" 
ADD COLUMN IF NOT EXISTS "fullDescription" TEXT,
ADD COLUMN IF NOT EXISTS "whatToBring" TEXT,
ADD COLUMN IF NOT EXISTS "fullAddress" TEXT;