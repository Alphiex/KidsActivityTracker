const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function fixActivityTypeNames() {
  console.log('Fixing activity type name mismatches...');
  
  try {
    // Map of old names to new names (based on ActivityType records)
    const nameMapping = {
      'Sports - Team': 'Team Sports',
      'Sports - Individual': 'Individual Sports',
      'Arts - Visual': 'Visual Arts',
      'Arts - Performing': 'Performing Arts',
      'Arts - Music': 'Music',
      'STEM & Academic': 'STEM & Education',
      'Special Needs & Adaptive': 'Special Needs Programs'
    };
    
    // Update each activity type name
    for (const [oldName, newName] of Object.entries(nameMapping)) {
      const result = await prisma.activity.updateMany({
        where: { activityType: oldName },
        data: { activityType: newName }
      });
      
      if (result.count > 0) {
        console.log(`  Updated ${result.count} activities from "${oldName}" to "${newName}"`);
      }
    }
    
    // Also check for activities that should be "Individual Sports" but are labeled differently
    const individualSportsSubtypes = [
      'Golf', 'Track & Field', 'Cross Country', 'Archery', 
      'Fencing', 'Rock Climbing', 'Cycling', 'Running'
    ];
    
    const individualResult = await prisma.activity.updateMany({
      where: {
        activitySubtype: { in: individualSportsSubtypes },
        activityType: { not: 'Individual Sports' }
      },
      data: { activityType: 'Individual Sports' }
    });
    
    if (individualResult.count > 0) {
      console.log(`  Updated ${individualResult.count} individual sports activities`);
    }
    
    // Fix Skating activities
    const skatingResult = await prisma.activity.updateMany({
      where: {
        OR: [
          { activitySubtype: { contains: 'Skating' } },
          { activitySubtype: { contains: 'Skateboard' } },
          { activitySubtype: { contains: 'Scooter' } }
        ],
        activityType: { not: 'Skating & Wheels' }
      },
      data: { activityType: 'Skating & Wheels' }
    });
    
    if (skatingResult.count > 0) {
      console.log(`  Updated ${skatingResult.count} skating activities`);
    }
    
    // Check final counts
    const finalCounts = await prisma.activity.groupBy({
      by: ['activityType'],
      _count: { id: true },
      where: {
        activityType: { not: null },
        isActive: true
      },
      orderBy: { _count: { id: 'desc' } }
    });
    
    console.log('\nFinal activity type counts:');
    finalCounts.forEach(c => {
      console.log(`  ${c.activityType}: ${c._count.id}`);
    });
    
    console.log('\nActivity type names fixed successfully!');
  } catch (error) {
    console.error('Error fixing activity type names:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixActivityTypeNames();