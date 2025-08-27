-- Production migration script for new categorization system

-- Add new columns to Activity table if they don't exist
ALTER TABLE "Activity" 
ADD COLUMN IF NOT EXISTS "activityType" TEXT,
ADD COLUMN IF NOT EXISTS "activitySubtype" TEXT,
ADD COLUMN IF NOT EXISTS "requiresParent" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "parentInvolvement" TEXT;

-- Create Category table if not exists
CREATE TABLE IF NOT EXISTS "Category" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ageMin" INTEGER NOT NULL,
    "ageMax" INTEGER NOT NULL,
    "requiresParent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- Create unique index if not exists
CREATE UNIQUE INDEX IF NOT EXISTS "Category_code_key" ON "Category"("code");

-- Create ActivityType table if not exists
CREATE TABLE IF NOT EXISTS "ActivityType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "ActivityType_pkey" PRIMARY KEY ("id")
);

-- Create unique index if not exists
CREATE UNIQUE INDEX IF NOT EXISTS "ActivityType_name_key" ON "ActivityType"("name");

-- Create ActivitySubtype table if not exists
CREATE TABLE IF NOT EXISTS "ActivitySubtype" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "activityTypeId" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "ActivitySubtype_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ActivitySubtype_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create ActivityCategory junction table if not exists
CREATE TABLE IF NOT EXISTS "ActivityCategory" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "ActivityCategory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ActivityCategory_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create unique index for junction table
CREATE UNIQUE INDEX IF NOT EXISTS "ActivityCategory_activityId_categoryId_key" ON "ActivityCategory"("activityId", "categoryId");

-- Create UnmappedActivity table if not exists
CREATE TABLE IF NOT EXISTS "UnmappedActivity" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "originalSection" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suggestedType" TEXT,
    "suggestedSubtype" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    
    CONSTRAINT "UnmappedActivity_pkey" PRIMARY KEY ("id")
);

-- Insert age-based categories
INSERT INTO "Category" (id, code, name, "ageMin", "ageMax", "requiresParent")
VALUES 
  (gen_random_uuid()::text, 'baby-parent', 'Baby & Parent', 0, 1, true),
  (gen_random_uuid()::text, 'preschool', 'Preschool', 2, 4, false),
  (gen_random_uuid()::text, 'school-age', 'School Age', 5, 13, false),
  (gen_random_uuid()::text, 'teen', 'Teen', 14, 18, false),
  (gen_random_uuid()::text, 'all-ages', 'All Ages', 0, 99, false)
ON CONFLICT (code) DO NOTHING;