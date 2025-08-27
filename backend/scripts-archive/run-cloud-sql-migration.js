// This script runs the migration on the Cloud SQL instance
// It uses the Cloud SQL proxy connection

const { PrismaClient } = require('./generated/prisma');

// Cloud SQL connection string for the kids-activity-db-dev instance
// Using direct IP connection since we can't use Unix socket locally
const DATABASE_URL = `postgresql://postgres:KidsTracker2024@34.42.149.102:5432/kidsactivity`;

async function runMigration() {
  console.log('🚀 Running Cloud SQL database migration...\n');
  console.log('Database: kids-activity-db-dev');
  console.log('Schema: kidsactivity\n');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL
      }
    }
  });
  
  try {
    // First check what tables exist
    const tables = await prisma.$queryRaw`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `;
    
    console.log('📊 Existing tables:');
    tables.forEach(t => console.log(`  - ${t.tablename}`));
    console.log('');
    
    // Check if Activity table exists
    const activityTableExists = tables.some(t => t.tablename === 'Activity');
    
    if (!activityTableExists) {
      console.log('❌ Activity table does not exist in this database!');
      console.log('This might be the wrong database instance.');
      return;
    }
    
    // Check existing columns
    const existingColumns = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'Activity'
        AND column_name IN ('dates', 'registrationStatus', 'fullDescription')
    `;
    
    console.log('📋 Checking for enhanced columns:');
    if (existingColumns.length > 0) {
      console.log('Found existing columns:');
      existingColumns.forEach(col => console.log(`  - ${col.column_name} (${col.data_type})`));
    } else {
      console.log('No enhanced columns found. Running migration...\n');
    }
    
    // Add dates and registrationStatus columns
    console.log('📝 Adding dates and registrationStatus columns...');
    await prisma.$executeRaw`
      ALTER TABLE "Activity" 
      ADD COLUMN IF NOT EXISTS "dates" TEXT,
      ADD COLUMN IF NOT EXISTS "registrationStatus" TEXT DEFAULT 'Unknown'
    `;
    console.log('✅ Columns added successfully!');
    
    // Add all other enhanced fields
    console.log('\n📝 Adding enhanced activity fields...');
    await prisma.$executeRaw`
      ALTER TABLE "Activity"
      ADD COLUMN IF NOT EXISTS "registrationButtonText" TEXT,
      ADD COLUMN IF NOT EXISTS "detailUrl" TEXT,
      ADD COLUMN IF NOT EXISTS "fullDescription" TEXT,
      ADD COLUMN IF NOT EXISTS "instructor" TEXT,
      ADD COLUMN IF NOT EXISTS "prerequisites" JSONB,
      ADD COLUMN IF NOT EXISTS "whatToBring" TEXT,
      ADD COLUMN IF NOT EXISTS "fullAddress" TEXT,
      ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "directRegistrationUrl" TEXT,
      ADD COLUMN IF NOT EXISTS "contactInfo" TEXT,
      ADD COLUMN IF NOT EXISTS "totalSpots" INTEGER,
      ADD COLUMN IF NOT EXISTS "requiredExtras" JSONB,
      ADD COLUMN IF NOT EXISTS "hasMultipleSessions" BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "sessionCount" INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "hasPrerequisites" BOOLEAN DEFAULT false
    `;
    console.log('✅ Enhanced fields added successfully!');
    
    // Create ActivitySession table
    console.log('\n📝 Creating ActivitySession table...');
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "ActivitySession" (
        "id" TEXT NOT NULL,
        "activityId" TEXT NOT NULL,
        "sessionNumber" INTEGER NOT NULL,
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
    `;
    
    // Add foreign key constraint
    await prisma.$executeRaw`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'ActivitySession_activityId_fkey'
        ) THEN
          ALTER TABLE "ActivitySession" 
          ADD CONSTRAINT "ActivitySession_activityId_fkey" 
          FOREIGN KEY ("activityId") REFERENCES "Activity"("id") 
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `;
    console.log('✅ ActivitySession table created successfully!');
    
    // Create ActivityPrerequisite table
    console.log('\n📝 Creating ActivityPrerequisite table...');
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "ActivityPrerequisite" (
        "id" TEXT NOT NULL,
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
    `;
    
    // Add foreign key constraint
    await prisma.$executeRaw`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'ActivityPrerequisite_activityId_fkey'
        ) THEN
          ALTER TABLE "ActivityPrerequisite" 
          ADD CONSTRAINT "ActivityPrerequisite_activityId_fkey" 
          FOREIGN KEY ("activityId") REFERENCES "Activity"("id") 
          ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$;
    `;
    console.log('✅ ActivityPrerequisite table created successfully!');
    
    // Verify the migration
    const activityCount = await prisma.activity.count();
    console.log(`\n📈 Total activities in Cloud SQL database: ${activityCount}`);
    
    // Get the updated column list
    const finalColumns = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'Activity'
        AND column_name IN ('dates', 'registrationStatus', 'fullDescription', 'instructor', 'hasMultipleSessions')
      ORDER BY column_name
    `;
    
    console.log('\n✅ Migration completed! Enhanced columns now available:');
    finalColumns.forEach(col => console.log(`  - ${col.column_name}`));
    
  } catch (error) {
    console.error('\n❌ Migration error:', error.message);
    if (error.message.includes('connect')) {
      console.error('\n💡 Connection error. Make sure you are running the Cloud SQL proxy:');
      console.error('   ./cloud-sql-proxy --port 5432 kids-activity-tracker-2024:us-central1:kids-activity-db-dev');
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});