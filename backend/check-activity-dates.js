const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function checkActivity() {
  try {
    // Search for the activity by multiple possible fields
    const activities = await prisma.activity.findMany({
      where: {
        OR: [
          { externalId: '00352384' },
          { courseId: '00352384' },
          { externalId: { contains: '352384' } },
          { name: { contains: 'Diving' } }
        ]
      },
      select: {
        id: true,
        name: true,
        dateStart: true,
        dateEnd: true,
        externalId: true,
        courseId: true,
        rawData: true
      }
    });
    
    if (activities.length > 0) {
      console.log(`Found ${activities.length} matching activities:\n`);
      activities.forEach(activity => {
        console.log('Activity:', {
          name: activity.name,
          dateStart: activity.dateStart,
          dateEnd: activity.dateEnd,
          externalId: activity.externalId,
          courseId: activity.courseId,
          rawDateRange: activity.rawData?.dateRange || 'Not found in rawData'
        });
        console.log('---');
      });
    } else {
      console.log('No activities found matching course ID 00352384');
      
      // Let's check what diving activities we have
      const divingActivities = await prisma.activity.findMany({
        where: {
          name: { contains: 'Diving', mode: 'insensitive' }
        },
        select: {
          name: true,
          externalId: true,
          courseId: true,
          dateStart: true,
          dateEnd: true
        },
        take: 5
      });
      
      if (divingActivities.length > 0) {
        console.log('\nFound these diving activities:');
        divingActivities.forEach(a => {
          console.log(`- ${a.name} (${a.externalId || a.courseId}): ${a.dateStart} - ${a.dateEnd}`);
        });
      }
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    await prisma.$disconnect();
  }
}

checkActivity();