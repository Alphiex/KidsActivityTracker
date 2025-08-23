require('dotenv').config({ path: '.env.production' });

const { PrismaClient } = require('./generated/prisma');

async function runMigration() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });
  
  console.log('🚀 Running production database migration...\n');
  
  try {
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
    
    // Add time-related fields
    console.log('\n📝 Adding time-related fields...');
    await prisma.$executeRaw`
      ALTER TABLE "Activity"
      ADD COLUMN IF NOT EXISTS "registrationEndDate" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "registrationEndTime" TEXT,
      ADD COLUMN IF NOT EXISTS "costIncludesTax" BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS "taxAmount" DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS "startTime" TEXT,
      ADD COLUMN IF NOT EXISTS "endTime" TEXT,
      ADD COLUMN IF NOT EXISTS "courseDetails" TEXT
    `;
    console.log('✅ Time fields added successfully!');
    
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
    
    // Create index
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ActivitySession_activityId_idx" 
      ON "ActivitySession"("activityId")
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
    
    // Create index
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "ActivityPrerequisite_activityId_idx" 
      ON "ActivityPrerequisite"("activityId")
    `;
    console.log('✅ ActivityPrerequisite table created successfully!');
    
    // Verify the migration
    const activityCount = await prisma.activity.count();
    console.log(`\n📈 Total activities in database: ${activityCount}`);
    
    // Check if any activities have the new fields populated
    const enhancedActivity = await prisma.activity.findFirst({
      where: {
        OR: [
          { registrationStatus: { not: 'Unknown' } },
          { dates: { not: null } },
          { fullDescription: { not: null } }
        ]
      },
      select: {
        name: true,
        registrationStatus: true,
        dates: true,
        fullDescription: true
      }
    });
    
    if (enhancedActivity) {
      console.log('\n📝 Sample enhanced activity:');
      console.log(JSON.stringify(enhancedActivity, null, 2));
    }
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
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