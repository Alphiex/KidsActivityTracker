const { PrismaClient } = require('./generated/prisma');
const fs = require('fs');
const path = require('path');

async function updateSchema() {
  console.log('🔄 Updating production database schema...');
  
  // Load production environment
  require('dotenv').config({ path: '.env.production' });
  
  const prisma = new PrismaClient();
  
  try {
    // Use comprehensive migration file
    const migrationFile = process.argv[2] || path.join(__dirname, 'create-all-tables.sql');
    
    if (fs.existsSync(migrationFile)) {
      const migration = fs.readFileSync(migrationFile, 'utf8');
      await prisma.$executeRawUnsafe(migration);
      console.log(`✅ Executed migration: ${migrationFile}`);
      
      // Verify tables exist
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('ActivitySession', 'ActivityPrerequisite')
        ORDER BY table_name
      `;
      
      console.log('\n📊 Verification Results:');
      tables.forEach(t => console.log(`   ✅ Table ${t.table_name} exists`));
      
      // Count enhanced activities
      const enhancedCount = await prisma.activity.count({
        where: {
          OR: [
            { instructor: { not: null } },
            { fullDescription: { not: null } },
            { dates: { not: null } }
          ]
        }
      });
      
      console.log(`\n📈 Enhanced activities in database: ${enhancedCount}`);
      
      await prisma.$disconnect();
      return;
    }
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

    // Verify the schema update
    const sessionCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'ActivitySession'
    `;
    
    const prerequisiteCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'ActivityPrerequisite'
    `;
    
    console.log('✅ Schema update completed successfully!');
    console.log(`   - ActivitySession table: ${sessionCount[0].count > 0 ? 'Created' : 'Failed'}`);
    console.log(`   - ActivityPrerequisite table: ${prerequisiteCount[0].count > 0 ? 'Created' : 'Failed'}`);
    
  } catch (error) {
    console.error('❌ Schema update failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateSchema();