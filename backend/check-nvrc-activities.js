const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function checkNVRCActivities() {
  try {
    // First, find the NVRC provider
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

    // Count total activities for NVRC
    const totalCount = await prisma.activity.count({
      where: { providerId: nvrcProvider.id }
    });

    console.log('\nTotal NVRC activities:', totalCount);

    // Find activities with cost > 0
    const activitiesWithCost = await prisma.activity.findMany({
      where: { 
        providerId: nvrcProvider.id,
        cost: { gt: 0 }
      },
      select: {
        externalId: true,
        name: true,
        cost: true,
        updatedAt: true
      },
      take: 10
    });

    console.log('\nActivities with cost > 0:', activitiesWithCost.length);
    activitiesWithCost.forEach(activity => {
      console.log(`  - ${activity.externalId}: ${activity.name} - $${activity.cost} (Updated: ${activity.updatedAt})`);
    });

    // Check for activity 00369211
    const targetActivity = await prisma.activity.findFirst({
      where: { 
        providerId: nvrcProvider.id,
        externalId: '00369211'
      }
    });

    if (targetActivity) {
      console.log('\nFound activity 00369211:', targetActivity);
    } else {
      // Try to find similar external IDs
      const similarActivities = await prisma.activity.findMany({
        where: { 
          providerId: nvrcProvider.id,
          externalId: { contains: '369' }
        },
        select: {
          externalId: true,
          name: true,
          cost: true
        }
      });

      console.log('\nActivities with "369" in external ID:', similarActivities.length);
      similarActivities.forEach(activity => {
        console.log(`  - ${activity.externalId}: ${activity.name} - $${activity.cost}`);
      });
    }

    // Get the most recent activities
    const recentActivities = await prisma.activity.findMany({
      where: { providerId: nvrcProvider.id },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        externalId: true,
        name: true,
        cost: true,
        updatedAt: true
      }
    });

    console.log('\nMost recently updated activities:');
    recentActivities.forEach(activity => {
      console.log(`  - ${activity.externalId}: ${activity.name} - $${activity.cost} (${activity.updatedAt})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNVRCActivities();