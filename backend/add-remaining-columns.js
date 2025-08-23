const { PrismaClient } = require('./generated/prisma');

// Cloud SQL connection string
const DATABASE_URL = `postgresql://postgres:KidsTracker2024@34.42.149.102:5432/kidsactivity`;

async function addRemainingColumns() {
  console.log('🚀 Adding remaining columns to Cloud SQL...\n');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL
      }
    }
  });
  
  try {
    // Add time-related fields
    console.log('📝 Adding time-related fields...');
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
    
    // Check all columns now exist
    const allColumns = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'Activity'
        AND column_name IN (
          'dates', 'registrationStatus', 'fullDescription', 'instructor',
          'registrationEndDate', 'startTime', 'endTime', 'courseDetails',
          'hasMultipleSessions', 'sessionCount', 'hasPrerequisites',
          'registrationButtonText', 'detailUrl', 'prerequisites',
          'whatToBring', 'fullAddress', 'latitude', 'longitude',
          'directRegistrationUrl', 'contactInfo', 'totalSpots', 'requiredExtras'
        )
      ORDER BY column_name
    `;
    
    console.log('\n✅ All enhanced columns now available:');
    allColumns.forEach(col => console.log(`  - ${col.column_name}`));
    
    // Test a simple query
    const testActivity = await prisma.activity.findFirst({
      select: {
        id: true,
        name: true,
        dates: true,
        registrationStatus: true,
        registrationEndDate: true
      }
    });
    
    console.log('\n📋 Test query successful:');
    console.log(`Activity: ${testActivity?.name}`);
    console.log(`Dates: ${testActivity?.dates || 'null'}`);
    console.log(`Status: ${testActivity?.registrationStatus || 'null'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addRemainingColumns().catch(console.error);