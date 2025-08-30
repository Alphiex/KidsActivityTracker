const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function checkCounts() {
  try {
    // Total active activities
    const total = await prisma.activity.count({ where: { isActive: true } });
    console.log('Total active activities:', total);
    
    // Get counts by activityTypeId
    const typeCounts = await prisma.activity.groupBy({
      by: ['activityTypeId'],
      where: { 
        isActive: true,
        activityTypeId: { not: null }
      },
      _count: { id: true }
    });
    
    console.log('\nCounts by activityTypeId:');
    let sum = 0;
    
    // Get type names for each ID
    const typeNames = {};
    if (typeCounts.length > 0) {
      const types = await prisma.activityType.findMany({
        where: {
          id: { in: typeCounts.map(tc => tc.activityTypeId).filter(id => id !== null) }
        }
      });
      types.forEach(t => {
        typeNames[t.id] = t.name;
      });
    }
    
    typeCounts.forEach(tc => {
      const typeName = tc.activityTypeId ? (typeNames[tc.activityTypeId] || tc.activityTypeId) : 'NULL';
      console.log('  ' + typeName + ':', tc._count.id);
      sum += tc._count.id;
    });
    console.log('\nSum of all type counts:', sum);
    console.log('Difference from total:', sum - total);
    
    // Check for null activityTypeId
    const nullTypeCount = await prisma.activity.count({
      where: {
        isActive: true,
        activityTypeId: null
      }
    });
    console.log('\nActivities with null activityTypeId:', nullTypeCount);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCounts();