-- Add missing columns to existing tables
ALTER TABLE "ActivityType" ADD COLUMN IF NOT EXISTS "code" VARCHAR(50);
ALTER TABLE "ActivityType" ADD COLUMN IF NOT EXISTS "iconName" VARCHAR(50);
ALTER TABLE "ActivityType" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "ActivityType" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER DEFAULT 0;
ALTER TABLE "ActivityType" ADD COLUMN IF NOT EXISTS "description" TEXT;

ALTER TABLE "ActivitySubtype" ADD COLUMN IF NOT EXISTS "code" VARCHAR(50);
ALTER TABLE "ActivitySubtype" ADD COLUMN IF NOT EXISTS "description" TEXT;

ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "code" VARCHAR(50);
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER DEFAULT 0;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "iconName" VARCHAR(50);

-- Update existing ActivityType records with codes
UPDATE "ActivityType" SET 
    code = LOWER(REPLACE(REPLACE(REPLACE(name, ' & ', '-'), ' - ', '-'), ' ', '-')),
    displayOrder = CASE 
        WHEN name = 'Swimming & Aquatics' THEN 1
        WHEN name = 'Sports - Team' THEN 2
        WHEN name = 'Sports - Individual' THEN 3
        WHEN name = 'Martial Arts' THEN 4
        WHEN name = 'Fitness' THEN 5
        WHEN name = 'Dance' THEN 6
        WHEN name = 'Music' THEN 7
        WHEN name = 'Arts & Crafts' THEN 8
        WHEN name = 'STEM' THEN 9
        WHEN name = 'Educational' THEN 10
        WHEN name = 'Outdoor Activities' THEN 11
        WHEN name = 'Camps' THEN 12
        ELSE 999
    END
WHERE code IS NULL;

-- Update existing ActivitySubtype records with codes
UPDATE "ActivitySubtype" SET 
    code = LOWER(REPLACE(REPLACE(REPLACE(name, ' & ', '-'), ' - ', '-'), ' ', '-'))
WHERE code IS NULL;

-- Update existing Category records with codes and display order
UPDATE "Category" SET 
    code = LOWER(REPLACE(name, ' ', '-')),
    displayOrder = CASE 
        WHEN name = 'Baby & Parent' THEN 1
        WHEN name = 'Preschool' THEN 2
        WHEN name = 'School Age' THEN 3
        WHEN name = 'Teen' THEN 4
        WHEN name = 'All Ages' THEN 5
        ELSE 999
    END
WHERE code IS NULL;

-- Make columns NOT NULL after setting values
ALTER TABLE "ActivityType" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "ActivitySubtype" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "Category" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "Category" ALTER COLUMN "displayOrder" SET NOT NULL;

-- Add unique constraints
ALTER TABLE "ActivityType" ADD CONSTRAINT "ActivityType_code_key" UNIQUE ("code");
ALTER TABLE "ActivitySubtype" ADD CONSTRAINT "ActivitySubtype_code_key" UNIQUE ("code");
ALTER TABLE "Category" ADD CONSTRAINT "Category_code_key" UNIQUE ("code");