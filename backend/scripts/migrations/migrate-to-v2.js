const { PrismaClient } = require('./generated/prisma');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function migrateToV2() {
  console.log('Starting migration to schema v2...\n');
  
  try {
    // Start a transaction
    await prisma.$transaction(async (tx) => {
      
      // Step 1: Update existing tables with new required fields
      console.log('Step 1: Updating existing tables...');
      
      // Add missing fields to Location table
      await tx.$executeRaw`ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "country" TEXT DEFAULT 'Canada'`;
      await tx.$executeRaw`ALTER TABLE "Location" ALTER COLUMN "city" SET NOT NULL`;
      await tx.$executeRaw`ALTER TABLE "Location" ALTER COLUMN "province" SET NOT NULL`;
      await tx.$executeRaw`ALTER TABLE "Location" ALTER COLUMN "address" SET DEFAULT ''`;
      
      // Update null addresses to empty string
      await tx.$executeRaw`
        UPDATE "Location" SET "address" = '' WHERE "address" IS NULL
      `;
      
      // Add missing fields to Activity table
      await tx.$executeRaw`
        ALTER TABLE "Activity" 
        ADD COLUMN IF NOT EXISTS "dayOfWeek" TEXT[] DEFAULT '{}'
      `;
      
      // Convert ageMin/ageMax to nullable
      await tx.$executeRaw`ALTER TABLE "Activity" ALTER COLUMN "ageMin" DROP NOT NULL`;
      await tx.$executeRaw`ALTER TABLE "Activity" ALTER COLUMN "ageMax" DROP NOT NULL`;
      await tx.$executeRaw`ALTER TABLE "Activity" ALTER COLUMN "ageMin" DROP DEFAULT`;
      await tx.$executeRaw`ALTER TABLE "Activity" ALTER COLUMN "ageMax" DROP DEFAULT`;
      await tx.$executeRaw`ALTER TABLE "Activity" ALTER COLUMN "spotsAvailable" DROP NOT NULL`;
      await tx.$executeRaw`ALTER TABLE "Activity" ALTER COLUMN "spotsAvailable" DROP DEFAULT`;
      
      // Add missing fields to User table - handle existing user
      console.log('Step 2: Updating User table...');
      
      // First, add the new columns with defaults
      await tx.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT DEFAULT 'temp_hash_will_be_updated'`;
      await tx.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT`;
      await tx.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN DEFAULT false`;
      await tx.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationToken" TEXT`;
      await tx.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetToken" TEXT`;
      await tx.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMP(3)`;
      await tx.$executeRaw`ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL`;
      await tx.$executeRaw`ALTER TABLE "User" ALTER COLUMN "preferences" SET DEFAULT '{}'::jsonb`;
      
      // Update existing user with proper values using raw SQL
      await tx.$executeRaw`
        UPDATE "User" 
        SET 
          "name" = COALESCE("name", 'Admin User'),
          "passwordHash" = ${crypto.randomBytes(32).toString('hex')},
          "isVerified" = true,
          "preferences" = COALESCE("preferences", '{}'::jsonb)
        WHERE "passwordHash" = 'temp_hash_will_be_updated'
      `;
      
      // Now remove the default from passwordHash
      await tx.$executeRaw`
        ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP DEFAULT
      `;
      
      // Make scraperConfig required in Provider
      await tx.$executeRaw`
        UPDATE "Provider" SET "scraperConfig" = '{}'::jsonb WHERE "scraperConfig" IS NULL
      `;
      await tx.$executeRaw`
        ALTER TABLE "Provider" ALTER COLUMN "scraperConfig" SET NOT NULL
      `;
      
      // Step 3: Create new tables
      console.log('Step 3: Creating new tables...');
      
      // Child table
      await tx.$executeRaw`
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
        )
      `;
      
      await tx.$executeRaw`
        CREATE INDEX IF NOT EXISTS "Child_userId_idx" ON "Child"("userId")
      `;
      
      // ChildActivity table
      await tx.$executeRaw`
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
        )
      `;
      
      await tx.$executeRaw`
        CREATE INDEX IF NOT EXISTS "ChildActivity_childId_status_idx" ON "ChildActivity"("childId", "status")
      `;
      await tx.$executeRaw`
        CREATE INDEX IF NOT EXISTS "ChildActivity_activityId_idx" ON "ChildActivity"("activityId")
      `;
      
      // Update Favorite table
      await tx.$executeRaw`
        ALTER TABLE "Favorite" 
        ADD COLUMN IF NOT EXISTS "notifyOnChange" BOOLEAN NOT NULL DEFAULT true
      `;
      
      // ActivityShare table
      await tx.$executeRaw`
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
        )
      `;
      
      await tx.$executeRaw`
        CREATE INDEX IF NOT EXISTS "ActivityShare_sharingUserId_idx" ON "ActivityShare"("sharingUserId")
      `;
      await tx.$executeRaw`
        CREATE INDEX IF NOT EXISTS "ActivityShare_sharedWithUserId_idx" ON "ActivityShare"("sharedWithUserId")
      `;
      
      // ActivityShareProfile table
      await tx.$executeRaw`
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
        )
      `;
      
      // Invitation table
      await tx.$executeRaw`
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
        )
      `;
      
      await tx.$executeRaw`
        CREATE INDEX IF NOT EXISTS "Invitation_senderId_idx" ON "Invitation"("senderId")
      `;
      await tx.$executeRaw`
        CREATE INDEX IF NOT EXISTS "Invitation_recipientEmail_idx" ON "Invitation"("recipientEmail")
      `;
      await tx.$executeRaw`
        CREATE INDEX IF NOT EXISTS "Invitation_token_idx" ON "Invitation"("token")
      `;
      await tx.$executeRaw`
        CREATE INDEX IF NOT EXISTS "Invitation_status_expiresAt_idx" ON "Invitation"("status", "expiresAt")
      `;
      
      // Update ActivityHistory table structure
      await tx.$executeRaw`DROP TABLE IF EXISTS "ActivityHistory"`;
      await tx.$executeRaw`
        CREATE TABLE "ActivityHistory" (
          "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
          "activityId" TEXT NOT NULL,
          "changeType" TEXT NOT NULL,
          "previousData" JSONB,
          "newData" JSONB,
          "changedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          
          CONSTRAINT "ActivityHistory_pkey" PRIMARY KEY ("id")
        )
      `;
      
      await tx.$executeRaw`
        CREATE INDEX IF NOT EXISTS "ActivityHistory_activityId_createdAt_idx" ON "ActivityHistory"("activityId", "createdAt")
      `;
      
      // Create ScraperRun table (replaces ScrapeJob)
      await tx.$executeRaw`
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
        )
      `;
      
      await tx.$executeRaw`
        CREATE INDEX IF NOT EXISTS "ScraperRun_providerId_startedAt_idx" ON "ScraperRun"("providerId", "startedAt")
      `;
      
      // Step 4: Add foreign key constraints
      console.log('Step 4: Adding foreign key constraints...');
      
      await tx.$executeRaw`
        ALTER TABLE "Child" 
        ADD CONSTRAINT "Child_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
      `;
      
      await tx.$executeRaw`
        ALTER TABLE "ChildActivity" 
        ADD CONSTRAINT "ChildActivity_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE
      `;
      await tx.$executeRaw`
        ALTER TABLE "ChildActivity" 
        ADD CONSTRAINT "ChildActivity_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id")
      `;
      
      await tx.$executeRaw`
        ALTER TABLE "ActivityShare" 
        ADD CONSTRAINT "ActivityShare_sharingUserId_fkey" FOREIGN KEY ("sharingUserId") REFERENCES "User"("id") ON DELETE CASCADE
      `;
      await tx.$executeRaw`
        ALTER TABLE "ActivityShare" 
        ADD CONSTRAINT "ActivityShare_sharedWithUserId_fkey" FOREIGN KEY ("sharedWithUserId") REFERENCES "User"("id") ON DELETE CASCADE
      `;
      
      await tx.$executeRaw`
        ALTER TABLE "ActivityShareProfile" 
        ADD CONSTRAINT "ActivityShareProfile_activityShareId_fkey" FOREIGN KEY ("activityShareId") REFERENCES "ActivityShare"("id") ON DELETE CASCADE
      `;
      await tx.$executeRaw`
        ALTER TABLE "ActivityShareProfile" 
        ADD CONSTRAINT "ActivityShareProfile_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE
      `;
      
      await tx.$executeRaw`
        ALTER TABLE "Invitation" 
        ADD CONSTRAINT "Invitation_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE
      `;
      await tx.$executeRaw`
        ALTER TABLE "Invitation" 
        ADD CONSTRAINT "Invitation_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE
      `;
      
      // Step 5: Drop old ScrapeJob table
      console.log('Step 5: Dropping old ScrapeJob table...');
      await tx.$executeRaw`DROP TABLE IF EXISTS "ScrapeJob"`;
      
      console.log('\nMigration completed successfully!');
    });
    
    // Verify migration
    console.log('\nVerifying migration...');
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `;
    
    console.log('Tables in database:');
    tables.forEach(t => console.log(`- ${t.tablename}`));
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  migrateToV2()
    .then(() => {
      console.log('\nMigration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateToV2 };