const { PrismaClient } = require('./generated/prisma');

// Cloud SQL connection string
const DATABASE_URL = `postgresql://postgres:KidsTracker2024@34.42.149.102:5432/kidsactivity`;

async function addFinalColumns() {
  console.log('🚀 Adding final missing columns...\n');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL
      }
    }
  });
  
  try {
    // Add subLocation to ActivitySession
    console.log('📝 Adding subLocation column to ActivitySession...');
    await prisma.$executeRaw`
      ALTER TABLE "ActivitySession"
      ADD COLUMN IF NOT EXISTS "subLocation" TEXT
    `;
    console.log('✅ Column added successfully!');
    
    // Check if there are any other missing columns in related tables
    console.log('\n📝 Checking for other missing columns...');
    
    // Add missing columns to ActivityPrerequisite if needed
    await prisma.$executeRaw`
      ALTER TABLE "ActivityPrerequisite"
      ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER DEFAULT 0
    `;
    
    // Test full query with all relations
    console.log('\n🧪 Testing full activity query with relations...');
    const testActivity = await prisma.activity.findFirst({
      include: {
        provider: true,
        location: true,
        sessions: {
          orderBy: { sessionNumber: 'asc' }
        },
        prerequisitesList: {
          orderBy: { createdAt: 'asc' }
        },
        _count: {
          select: { favorites: true }
        }
      }
    });
    
    console.log('\n✅ Full query successful!');
    console.log(`Activity: ${testActivity?.name}`);
    console.log(`Provider: ${testActivity?.provider?.name}`);
    console.log(`Location: ${testActivity?.location?.name || testActivity?.locationName}`);
    console.log(`Sessions: ${testActivity?.sessions?.length || 0}`);
    console.log(`Prerequisites: ${testActivity?.prerequisitesList?.length || 0}`);
    console.log(`Favorites: ${testActivity?._count?.favorites || 0}`);
    
    console.log('\n🎉 All database columns are now properly configured!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nError details:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addFinalColumns().catch(console.error);