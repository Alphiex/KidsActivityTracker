const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function checkDuplicateActivities() {
  try {
    // Find the NVRC provider
    const nvrcProvider = await prisma.provider.findFirst({
      where: { 
        name: { contains: 'NVRC', mode: 'insensitive' }
      }
    });

    if (!nvrcProvider) {
      console.log('NVRC provider not found in database');
      return;
    }

    console.log('NVRC Provider:', nvrcProvider.name, '(ID:', nvrcProvider.id, ')');

    // Find activities with duplicate courseIds
    const activities = await prisma.activity.findMany({
      where: { 
        providerId: nvrcProvider.id,
        courseId: { not: null }
      },
      orderBy: [
        { courseId: 'asc' },
        { updatedAt: 'desc' }
      ],
      select: {
        id: true,
        externalId: true,
        courseId: true,
        name: true,
        cost: true,
        isActive: true,
        updatedAt: true,
        createdAt: true
      }
    });

    // Group by courseId to find duplicates
    const courseIdGroups = {};
    activities.forEach(activity => {
      if (!courseIdGroups[activity.courseId]) {
        courseIdGroups[activity.courseId] = [];
      }
      courseIdGroups[activity.courseId].push(activity);
    });

    // Find courseIds with duplicates
    const duplicateCourseIds = Object.keys(courseIdGroups).filter(courseId => 
      courseIdGroups[courseId].length > 1
    );

    console.log(`\nFound ${duplicateCourseIds.length} course IDs with duplicates\n`);

    // Show details for each duplicate group
    duplicateCourseIds.slice(0, 10).forEach(courseId => {
      const duplicates = courseIdGroups[courseId];
      console.log(`Course ID: ${courseId}`);
      duplicates.forEach((activity, idx) => {
        console.log(`  ${idx + 1}. ${activity.name}`);
        console.log(`     External ID: ${activity.externalId}`);
        console.log(`     Cost: $${activity.cost}`);
        console.log(`     Active: ${activity.isActive}`);
        console.log(`     Created: ${activity.createdAt}`);
        console.log(`     Updated: ${activity.updatedAt}`);
      });
      console.log('');
    });

    // Check specifically for course 00369211
    console.log('\n=== Checking Course 00369211 ===');
    const course00369211 = courseIdGroups['00369211'];
    if (course00369211) {
      console.log(`Found ${course00369211.length} activities with course ID 00369211:`);
      course00369211.forEach((activity, idx) => {
        console.log(`\n${idx + 1}. ${activity.name}`);
        console.log(`   ID: ${activity.id}`);
        console.log(`   External ID: ${activity.externalId}`);
        console.log(`   Cost: $${activity.cost}`);
        console.log(`   Active: ${activity.isActive}`);
        console.log(`   Created: ${activity.createdAt}`);
        console.log(`   Updated: ${activity.updatedAt}`);
      });

      // Show which one would be returned by a typical query
      const mostRecent = await prisma.activity.findFirst({
        where: { 
          providerId: nvrcProvider.id,
          courseId: '00369211',
          isActive: true
        },
        orderBy: { updatedAt: 'desc' }
      });

      if (mostRecent) {
        console.log('\nMost recent active activity with course ID 00369211:');
        console.log(`   Name: ${mostRecent.name}`);
        console.log(`   Cost: $${mostRecent.cost}`);
        console.log(`   External ID: ${mostRecent.externalId}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDuplicateActivities();