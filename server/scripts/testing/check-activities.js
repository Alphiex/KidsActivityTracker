const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function checkActivities() {
  try {
    const childId = 'bb0b3882-c18d-45cb-bd8a-cdecbe677f77';

    console.log('Checking for activities for child:', childId);

    const childActivities = await prisma.childActivity.findMany({
      where: { childId },
      include: {
        activity: true
      }
    });

    console.log('Found child activities:', childActivities.length);
    console.log(JSON.stringify(childActivities, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkActivities();
