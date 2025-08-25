const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function checkActivities() {
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

    // Check for activities with the internal courseId or external ID
    const targetCourseIds = ['00369211', '00368984'];
    const targetUUID = '457aa7be-04c3-4e90-b4dc-788c0d5df5a6';
    
    console.log('\nSearching for activities with course IDs:', targetCourseIds);
    console.log('Or with external ID (UUID):', targetUUID);
    
    // Search by courseId field
    const activitiesByCourseId = await prisma.activity.findMany({
      where: { 
        providerId: nvrcProvider.id,
        courseId: { in: targetCourseIds }
      },
      include: {
        location: true
      }
    });

    console.log('\nActivities found by courseId:');
    activitiesByCourseId.forEach(activity => {
      console.log(`- Name: ${activity.name}`);
      console.log(`  External ID: ${activity.externalId}`);
      console.log(`  Course ID: ${activity.courseId}`);
      console.log(`  Cost: $${activity.cost}`);
      console.log(`  Location: ${activity.location?.name}`);
      console.log(`  Updated: ${activity.updatedAt}`);
      console.log('');
    });

    // Search by externalId (UUID)
    const activityByUUID = await prisma.activity.findFirst({
      where: { 
        providerId: nvrcProvider.id,
        externalId: targetUUID
      },
      include: {
        location: true
      }
    });

    if (activityByUUID) {
      console.log('\nActivity found by UUID:');
      console.log(`- Name: ${activityByUUID.name}`);
      console.log(`  External ID: ${activityByUUID.externalId}`);
      console.log(`  Course ID: ${activityByUUID.courseId}`);
      console.log(`  Cost: $${activityByUUID.cost}`);
      console.log(`  Location: ${activityByUUID.location?.name}`);
      console.log(`  Updated: ${activityByUUID.updatedAt}`);
    } else {
      console.log('\nNo activity found with UUID:', targetUUID);
    }

    // Also search for activities with names containing "National Tournament Team"
    const activitiesByName = await prisma.activity.findMany({
      where: { 
        providerId: nvrcProvider.id,
        name: { contains: 'National Tournament Team', mode: 'insensitive' }
      },
      select: {
        name: true,
        externalId: true,
        courseId: true,
        cost: true,
        updatedAt: true
      }
    });

    console.log('\nActivities with "National Tournament Team" in name:');
    activitiesByName.forEach(activity => {
      console.log(`- ${activity.name}`);
      console.log(`  External ID: ${activity.externalId}`);
      console.log(`  Course ID: ${activity.courseId}`);
      console.log(`  Cost: $${activity.cost}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkActivities();