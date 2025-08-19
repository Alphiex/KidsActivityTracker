#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runMigration() {
  console.log('🔄 Running migration for ActivitySession and ActivityPrerequisite tables...');
  
  try {
    // Create ActivitySession table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ActivitySession" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "activityId" TEXT NOT NULL,
        "sessionNumber" INTEGER,
        "date" TEXT,
        "startTime" TEXT,
        "endTime" TEXT,
        "location" TEXT,
        "instructor" TEXT,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ActivitySession_pkey" PRIMARY KEY ("id")
      )
    `);
    console.log('✅ Created ActivitySession table');

    // Create ActivityPrerequisite table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ActivityPrerequisite" (
        "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        "activityId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "url" TEXT,
        "courseId" TEXT,
        "isRequired" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ActivityPrerequisite_pkey" PRIMARY KEY ("id")
      )
    `);
    console.log('✅ Created ActivityPrerequisite table');

    // Add foreign key constraints
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivitySession_activityId_fkey') THEN
          ALTER TABLE "ActivitySession" ADD CONSTRAINT "ActivitySession_activityId_fkey" 
            FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityPrerequisite_activityId_fkey') THEN
          ALTER TABLE "ActivityPrerequisite" ADD CONSTRAINT "ActivityPrerequisite_activityId_fkey" 
            FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$
    `);
    console.log('✅ Added foreign key constraints');

    // Create indexes
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ActivitySession_activityId_idx" ON "ActivitySession"("activityId");
      CREATE INDEX IF NOT EXISTS "ActivitySession_date_idx" ON "ActivitySession"("date");
      CREATE INDEX IF NOT EXISTS "ActivityPrerequisite_activityId_idx" ON "ActivityPrerequisite"("activityId");
    `);
    console.log('✅ Created indexes');

    // Add new fields to Activity table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "hasMultipleSessions" BOOLEAN DEFAULT false;
      ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "sessionCount" INTEGER DEFAULT 0;
      ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "hasPrerequisites" BOOLEAN DEFAULT false;
    `);
    console.log('✅ Added new fields to Activity table');

    // Check results
    const sessionCount = await prisma.activitySession.count();
    const prerequisiteCount = await prisma.activityPrerequisite.count();
    
    console.log(`📊 Migration completed successfully!`);
    console.log(`   - ActivitySession table: ${sessionCount} records`);
    console.log(`   - ActivityPrerequisite table: ${prerequisiteCount} records`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();