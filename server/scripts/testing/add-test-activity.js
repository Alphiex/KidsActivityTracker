const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function addTestActivity() {
  try {
    const childId = 'bb0b3882-c18d-45cb-bd8a-cdecbe677f77';

    // Find an activity to add
    const activity = await prisma.activity.findFirst({
      where: { isActive: true }
    });

    if (!activity) {
      console.log('No activities found in database');
      return;
    }

    console.log('Found activity:', activity.name);
    console.log('Activity ID:', activity.id);

    // Add activity to child
    const childActivity = await prisma.childActivity.create({
      data: {
        childId,
        activityId: activity.id,
        status: 'planned',
        scheduledDate: new Date('2025-10-15'),
        startTime: '9:30 AM',
        endTime: '11:00 AM'
      },
      include: {
        activity: {
          include: {
            location: true,
            activityType: true,
            activitySubtype: true
          }
        }
      }
    });

    console.log('Created child activity:', childActivity.id);
    console.log('Full object:', JSON.stringify(childActivity, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestActivity();
