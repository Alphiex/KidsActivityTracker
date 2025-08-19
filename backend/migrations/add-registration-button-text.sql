-- Add registrationButtonText column if it doesn't exist
ALTER TABLE "Activity" 
ADD COLUMN IF NOT EXISTS "registrationButtonText" TEXT;