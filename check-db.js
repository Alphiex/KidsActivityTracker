const { PrismaClient } = require('./backend/generated/prisma');

const DATABASE_URL = 'postgresql://postgres:kidsactivities2024@35.186.199.172:5432/kids_activity_tracker';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

async function checkDatabase() {
  try {
    const totalCount = await prisma.activity.count();
    const activeCount = await prisma.activity.count({
      where: { isActive: true }
    });
    
    const nvrcProvider = await prisma.provider.findFirst({
      where: { name: 'NVRC' }
    });
    
    const nvrcActiveCount = await prisma.activity.count({
      where: { 
        providerId: nvrcProvider?.id,
        isActive: true 
      }
    });
    
    const sampleActivities = await prisma.activity.findMany({
      where: { isActive: true },
      take: 5,
      select: {
        id: true,
        name: true,
        category: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });
    
    console.log('Database Status:');
    console.log(`- Total activities: ${totalCount}`);
    console.log(`- Active activities: ${activeCount}`);
    console.log(`- NVRC active activities: ${nvrcActiveCount}`);
    console.log(`\nSample active activities:`);
    console.log(JSON.stringify(sampleActivities, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();