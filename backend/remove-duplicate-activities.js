const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function removeDuplicates() {
  console.log('🔍 Finding duplicate activities by courseId...');
  
  // Get all activities with courseId
  const activities = await prisma.activity.findMany({
    where: { 
      courseId: { not: null }
    },
    select: {
      id: true,
      courseId: true,
      name: true,
      updatedAt: true,
      isActive: true
    },
    orderBy: {
      updatedAt: 'desc' // Most recently updated first
    }
  });
  
  console.log(`Found ${activities.length} activities with courseId`);
  
  // Group by courseId
  const byCourseId = {};
  activities.forEach(a => {
    if (!byCourseId[a.courseId]) {
      byCourseId[a.courseId] = [];
    }
    byCourseId[a.courseId].push(a);
  });
  
  // Find duplicates and collect IDs to delete
  const idsToDelete = [];
  let duplicateCount = 0;
  
  Object.entries(byCourseId).forEach(([courseId, acts]) => {
    if (acts.length > 1) {
      duplicateCount++;
      // Keep the first one (most recently updated), delete the rest
      for (let i = 1; i < acts.length; i++) {
        idsToDelete.push(acts[i].id);
      }
    }
  });
  
  console.log(`Found ${duplicateCount} courseIds with duplicates`);
  console.log(`Will delete ${idsToDelete.length} duplicate activities`);
  
  if (idsToDelete.length > 0) {
    // Delete duplicates in batches
    const batchSize = 100;
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize);
      const result = await prisma.activity.deleteMany({
        where: {
          id: { in: batch }
        }
      });
      console.log(`Deleted batch ${Math.floor(i/batchSize) + 1}: ${result.count} activities`);
    }
  }
  
  // Verify the results
  const remainingTotal = await prisma.activity.count();
  const remainingActive = await prisma.activity.count({ where: { isActive: true } });
  const uniqueCourseIds = await prisma.activity.groupBy({
    by: ['courseId'],
    where: { courseId: { not: null } },
    _count: true
  });
  
  console.log('\n✅ Deduplication complete!');
  console.log(`Total activities remaining: ${remainingTotal}`);
  console.log(`Active activities remaining: ${remainingActive}`);
  console.log(`Unique courseIds: ${uniqueCourseIds.length}`);
  
  // Check if any duplicates remain
  const remainingDuplicates = await prisma.activity.groupBy({
    by: ['courseId'],
    where: { courseId: { not: null } },
    _count: { id: true },
    having: {
      id: { _count: { gt: 1 } }
    }
  });
  
  if (remainingDuplicates.length > 0) {
    console.log(`⚠️  Warning: ${remainingDuplicates.length} courseIds still have duplicates`);
  } else {
    console.log('✅ No duplicates remain!');
  }
}

removeDuplicates()
  .catch(console.error)
  .finally(() => prisma.$disconnect());