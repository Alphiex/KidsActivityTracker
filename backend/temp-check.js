
const { PrismaClient } = require('./generated/prisma');
async function check() {
  const prisma = new PrismaClient({
    datasources: { db: { url: 'postgresql://postgres:KidsTracker2024@localhost:5434/kidsactivity' } }
  });
  const activity = await prisma.activity.findFirst({ where: { courseId: '00369210' } });
  if (activity) {
    console.log('Activity 00369210:');
    console.log('- Name:', activity.name);
    console.log('- Cost: $' + activity.cost);
    console.log('- Last updated:', activity.updatedAt);
  }
  await prisma.();
}
check();
