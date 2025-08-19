const { PrismaClient } = require('./generated/prisma');

async function checkProgress() {
  require('dotenv').config({ path: '.env.production' });
  const prisma = new PrismaClient();
  
  try {
    // Get total activities
    const totalActivities = await prisma.activity.count();
    
    // Get activities with enhanced data
    const enhancedActivities = await prisma.activity.count({
      where: {
        OR: [
          { instructor: { not: null } },
          { fullDescription: { not: null } },
          { dates: { not: null } },
          { registrationStatus: { not: 'Unknown' } }
        ]
      }
    });
    
    // Get activities updated today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const updatedToday = await prisma.activity.count({
      where: {
        updatedAt: { gte: today }
      }
    });
    
    // Get activities by registration status
    const statusCounts = await prisma.activity.groupBy({
      by: ['registrationStatus'],
      _count: true,
      orderBy: {
        _count: {
          registrationStatus: 'desc'
        }
      }
    });
    
    // Get sample of recently updated activities
    const recentActivities = await prisma.activity.findMany({
      where: {
        updatedAt: { gte: today },
        instructor: { not: null }
      },
      select: {
        name: true,
        instructor: true,
        dates: true,
        registrationStatus: true,
        spotsAvailable: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 5
    });
    
    console.log('📊 SCRAPER PROGRESS REPORT');
    console.log('=========================');
    console.log(`\n📈 Activity Statistics:`);
    console.log(`   Total activities: ${totalActivities}`);
    console.log(`   Enhanced activities: ${enhancedActivities}`);
    console.log(`   Updated today: ${updatedToday}`);
    console.log(`   Enhancement rate: ${((enhancedActivities / totalActivities) * 100).toFixed(1)}%`);
    
    console.log(`\n🎯 Registration Status Breakdown:`);
    statusCounts.forEach(status => {
      console.log(`   ${status.registrationStatus || 'Unknown'}: ${status._count}`);
    });
    
    console.log(`\n📋 Recent Enhanced Activities:`);
    recentActivities.forEach((activity, i) => {
      console.log(`\n   ${i + 1}. ${activity.name}`);
      console.log(`      Instructor: ${activity.instructor}`);
      console.log(`      Dates: ${activity.dates}`);
      console.log(`      Status: ${activity.registrationStatus}`);
      console.log(`      Spots: ${activity.spotsAvailable}`);
      console.log(`      Updated: ${activity.updatedAt.toLocaleString()}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProgress();