const { PrismaClient } = require('../generated/prisma');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kidsactivitytracker'
    }
  }
});

async function exportActivities() {
  try {
    const activities = await prisma.activity.findMany({
      take: 10,
      include: {
        location: true,
        provider: true
      }
    });
    console.log(JSON.stringify(activities, null, 2));
  } catch (error) {
    console.error('Error exporting activities:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportActivities();