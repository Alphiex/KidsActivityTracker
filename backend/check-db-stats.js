const { PrismaClient } = require('./generated/prisma');

const prisma = new PrismaClient();

async function checkDatabaseStats() {
  try {
    console.log('Checking current database statistics...\n');
    
    const stats = {
      activities: await prisma.activity.count(),
      providers: await prisma.provider.count(),
      locations: await prisma.location.count(),
      users: await prisma.user.count(),
      favorites: await prisma.favorite.count(),
      activityHistory: await prisma.activityHistory.count(),
      scrapeJobs: await prisma.scrapeJob.count()
    };
    
    console.log('Current database record counts:');
    console.log('==============================');
    Object.entries(stats).forEach(([table, count]) => {
      console.log(`${table.padEnd(20)}: ${count}`);
    });
    
    // Check sample activity to see unique constraint
    const sampleActivity = await prisma.activity.findFirst({
      include: { provider: true }
    });
    
    if (sampleActivity) {
      console.log('\nSample activity:');
      console.log(`- Provider: ${sampleActivity.provider.name}`);
      console.log(`- External ID: ${sampleActivity.externalId}`);
      console.log(`- Course ID: ${sampleActivity.courseId}`);
    }
    
  } catch (error) {
    console.error('Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseStats();