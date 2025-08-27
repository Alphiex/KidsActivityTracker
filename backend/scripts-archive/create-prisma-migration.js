const fs = require('fs').promises;
const path = require('path');

async function createPrismaMigration() {
  const migrationName = 'enhance_schema_v2';
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '');
  const migrationDir = path.join(__dirname, 'prisma', 'migrations', `${timestamp}_${migrationName}`);
  
  await fs.mkdir(migrationDir, { recursive: true });
  
  const migrationSQL = `-- Enhanced schema v2 migration
-- This migration adds user accounts, children profiles, and activity sharing

-- Step 1: Update existing tables
ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "country" TEXT DEFAULT 'Canada';
ALTER TABLE "Location" ALTER COLUMN "city" SET NOT NULL;
ALTER TABLE "Location" ALTER COLUMN "province" SET NOT NULL;
ALTER TABLE "Location" ALTER COLUMN "address" SET DEFAULT '';

UPDATE "Location" SET "address" = '' WHERE "address" IS NULL;

ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "dayOfWeek" TEXT[] DEFAULT '{}';
ALTER TABLE "Activity" ALTER COLUMN "ageMin" DROP NOT NULL;
ALTER TABLE "Activity" ALTER COLUMN "ageMax" DROP NOT NULL;
ALTER TABLE "Activity" ALTER COLUMN "ageMin" DROP DEFAULT;
ALTER TABLE "Activity" ALTER COLUMN "ageMax" DROP DEFAULT;
ALTER TABLE "Activity" ALTER COLUMN "spotsAvailable" DROP NOT NULL;
ALTER TABLE "Activity" ALTER COLUMN "spotsAvailable" DROP DEFAULT;

-- Step 2: Update User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT DEFAULT 'temp_hash_will_be_updated';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMP(3);
ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "preferences" SET DEFAULT '{}'::jsonb;

-- Update existing users
UPDATE "User" 
SET 
  "name" = COALESCE("name", 'Admin User'),
  "passwordHash" = gen_random_uuid()::text,
  "isVerified" = true,
  "preferences" = COALESCE("preferences", '{}'::jsonb)
WHERE "passwordHash" = 'temp_hash_will_be_updated';

ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP DEFAULT;

-- Update Provider table
UPDATE "Provider" SET "scraperConfig" = '{}'::jsonb WHERE "scraperConfig" IS NULL;
ALTER TABLE "Provider" ALTER COLUMN "scraperConfig" SET NOT NULL;

-- Step 3: Create new tables
CREATE TABLE IF NOT EXISTS "Child" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dateOfBirth" TIMESTAMP(3) NOT NULL,
  "gender" TEXT,
  "avatarUrl" TEXT,
  "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Child_userId_idx" ON "Child"("userId");

CREATE TABLE IF NOT EXISTS "ChildActivity" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "childId" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "registeredAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "rating" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChildActivity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChildActivity_childId_activityId_key" UNIQUE ("childId", "activityId")
);

CREATE INDEX IF NOT EXISTS "ChildActivity_childId_status_idx" ON "ChildActivity"("childId", "status");
CREATE INDEX IF NOT EXISTS "ChildActivity_activityId_idx" ON "ChildActivity"("activityId");

ALTER TABLE "Favorite" ADD COLUMN IF NOT EXISTS "notifyOnChange" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "ActivityShare" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "sharingUserId" TEXT NOT NULL,
  "sharedWithUserId" TEXT NOT NULL,
  "permissionLevel" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActivityShare_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActivityShare_sharingUserId_sharedWithUserId_key" UNIQUE ("sharingUserId", "sharedWithUserId")
);

CREATE INDEX IF NOT EXISTS "ActivityShare_sharingUserId_idx" ON "ActivityShare"("sharingUserId");
CREATE INDEX IF NOT EXISTS "ActivityShare_sharedWithUserId_idx" ON "ActivityShare"("sharedWithUserId");

CREATE TABLE IF NOT EXISTS "ActivityShareProfile" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "activityShareId" TEXT NOT NULL,
  "childId" TEXT NOT NULL,
  "canViewInterested" BOOLEAN NOT NULL DEFAULT true,
  "canViewRegistered" BOOLEAN NOT NULL DEFAULT true,
  "canViewCompleted" BOOLEAN NOT NULL DEFAULT false,
  "canViewNotes" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityShareProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActivityShareProfile_activityShareId_childId_key" UNIQUE ("activityShareId", "childId")
);

CREATE TABLE IF NOT EXISTS "Invitation" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "senderId" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "recipientUserId" TEXT,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Invitation_token_key" UNIQUE ("token")
);

CREATE INDEX IF NOT EXISTS "Invitation_senderId_idx" ON "Invitation"("senderId");
CREATE INDEX IF NOT EXISTS "Invitation_recipientEmail_idx" ON "Invitation"("recipientEmail");
CREATE INDEX IF NOT EXISTS "Invitation_token_idx" ON "Invitation"("token");
CREATE INDEX IF NOT EXISTS "Invitation_status_expiresAt_idx" ON "Invitation"("status", "expiresAt");

DROP TABLE IF EXISTS "ActivityHistory";
CREATE TABLE "ActivityHistory" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "activityId" TEXT NOT NULL,
  "changeType" TEXT NOT NULL,
  "previousData" JSONB,
  "newData" JSONB,
  "changedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ActivityHistory_activityId_createdAt_idx" ON "ActivityHistory"("activityId", "createdAt");

CREATE TABLE IF NOT EXISTS "ScraperRun" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "providerId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "activitiesFound" INTEGER NOT NULL DEFAULT 0,
  "activitiesCreated" INTEGER NOT NULL DEFAULT 0,
  "activitiesUpdated" INTEGER NOT NULL DEFAULT 0,
  "activitiesDeactivated" INTEGER NOT NULL DEFAULT 0,
  "activitiesPurged" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "logs" JSONB,
  CONSTRAINT "ScraperRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ScraperRun_providerId_startedAt_idx" ON "ScraperRun"("providerId", "startedAt");

-- Step 4: Add foreign key constraints
ALTER TABLE "Child" ADD CONSTRAINT "Child_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "ChildActivity" ADD CONSTRAINT "ChildActivity_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE;
ALTER TABLE "ChildActivity" ADD CONSTRAINT "ChildActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id");
ALTER TABLE "ActivityShare" ADD CONSTRAINT "ActivityShare_sharingUserId_fkey" FOREIGN KEY ("sharingUserId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "ActivityShare" ADD CONSTRAINT "ActivityShare_sharedWithUserId_fkey" FOREIGN KEY ("sharedWithUserId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "ActivityShareProfile" ADD CONSTRAINT "ActivityShareProfile_activityShareId_fkey" FOREIGN KEY ("activityShareId") REFERENCES "ActivityShare"("id") ON DELETE CASCADE;
ALTER TABLE "ActivityShareProfile" ADD CONSTRAINT "ActivityShareProfile_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Step 5: Drop old ScrapeJob table
DROP TABLE IF EXISTS "ScrapeJob";
`;

  await fs.writeFile(path.join(migrationDir, 'migration.sql'), migrationSQL);
  
  console.log(`Created migration: ${migrationDir}`);
  console.log('\nTo apply this migration:');
  console.log('1. For local: npx prisma migrate deploy');
  console.log('2. For cloud: DATABASE_URL=$CLOUD_DATABASE_URL npx prisma migrate deploy');
  
  return migrationDir;
}

if (require.main === module) {
  createPrismaMigration()
    .then(dir => {
      console.log('\nMigration created successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to create migration:', error);
      process.exit(1);
    });
}

module.exports = { createPrismaMigration };