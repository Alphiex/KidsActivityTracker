-- Drop the old compound unique constraint
ALTER TABLE "Location" DROP CONSTRAINT IF EXISTS "Location_name_address_key";

-- Add new unique constraint on name only
ALTER TABLE "Location" ADD CONSTRAINT "Location_name_key" UNIQUE ("name");

-- Drop the redundant index on name (since unique constraint creates an index)
DROP INDEX IF EXISTS "Location_name_idx";