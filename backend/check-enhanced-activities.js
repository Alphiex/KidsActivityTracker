const { PrismaClient } = require('./generated/prisma');

const DATABASE_URL = `postgresql://postgres:KidsTracker2024@34.42.149.102:5432/kidsactivity`;

async function checkEnhancedActivities() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL
      }
    }
  });
  
  try {
    // Count activities with enhanced data
    const enhancedCount = await prisma.activity.count({
      where: {
        OR: [
          { dates: { not: null } },
          { fullDescription: { not: null } },
          { registrationStatus: { not: 'Unknown' } },
          { instructor: { not: null } }
        ]
      }
    });
    
    console.log(`📊 Activities with enhanced data: ${enhancedCount}`);
    
    // Find a sample with enhanced data
    const enhancedActivity = await prisma.activity.findFirst({
      where: {
        OR: [
          { dates: { not: null } },
          { fullDescription: { not: null } },
          { registrationStatus: { not: 'Unknown' } }
        ]
      },
      include: {
        sessions: true,
        prerequisitesList: true
      }
    });
    
    if (enhancedActivity) {
      console.log('\n📋 Sample enhanced activity:');
      console.log(`Name: ${enhancedActivity.name}`);
      console.log(`Dates: ${enhancedActivity.dates}`);
      console.log(`Status: ${enhancedActivity.registrationStatus}`);
      console.log(`Description: ${enhancedActivity.fullDescription?.substring(0, 100)}...`);
      console.log(`Sessions: ${enhancedActivity.sessions.length}`);
      console.log(`Prerequisites: ${enhancedActivity.prerequisitesList.length}`);
    } else {
      console.log('\n❌ No activities with enhanced data found.');
      console.log('You need to run the enhanced scraper to populate these fields.');
    }
    
    // Check total activities
    const totalCount = await prisma.activity.count();
    console.log(`\n📈 Total activities: ${totalCount}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkEnhancedActivities();