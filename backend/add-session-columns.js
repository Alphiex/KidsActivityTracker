const { PrismaClient } = require('./generated/prisma');

// Cloud SQL connection string
const DATABASE_URL = `postgresql://postgres:KidsTracker2024@34.42.149.102:5432/kidsactivity`;

async function addSessionColumns() {
  console.log('🚀 Adding missing columns to ActivitySession...\n');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL
      }
    }
  });
  
  try {
    // Add dayOfWeek to ActivitySession
    console.log('📝 Adding dayOfWeek column to ActivitySession...');
    await prisma.$executeRaw`
      ALTER TABLE "ActivitySession"
      ADD COLUMN IF NOT EXISTS "dayOfWeek" TEXT
    `;
    console.log('✅ Column added successfully!');
    
    // Check ActivitySession columns
    const sessionColumns = await prisma.$queryRaw`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'ActivitySession'
      ORDER BY column_name
    `;
    
    console.log('\n📋 ActivitySession columns:');
    sessionColumns.forEach(col => console.log(`  - ${col.column_name} (${col.data_type})`));
    
    // Test the API query should work now
    const activityCount = await prisma.activity.count();
    console.log(`\n✅ Total activities: ${activityCount}`);
    
    // Test with relations
    const testActivity = await prisma.activity.findFirst({
      include: {
        sessions: true,
        prerequisitesList: true
      }
    });
    
    console.log('\n✅ Test query with relations successful!');
    console.log(`Activity: ${testActivity?.name}`);
    console.log(`Sessions: ${testActivity?.sessions?.length || 0}`);
    console.log(`Prerequisites: ${testActivity?.prerequisitesList?.length || 0}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addSessionColumns().catch(console.error);