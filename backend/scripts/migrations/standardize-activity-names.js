const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

// Load mapping configuration
const mappingConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'activity-name-mapping.json'), 'utf-8')
);

async function standardizeActivityNames() {
  console.log('Starting activity name standardization...\n');
  
  try {
    // Step 1: Standardize activity types
    console.log('Step 1: Standardizing activity types...');
    let typeUpdateCount = 0;
    
    // Get all unique activity types
    const activityTypes = await prisma.activity.groupBy({
      by: ['activityType'],
      where: { activityType: { not: null } }
    });
    
    for (const { activityType } of activityTypes) {
      const standardType = mappingConfig.activityTypeMappings[activityType];
      if (standardType && standardType !== activityType) {
        const result = await prisma.activity.updateMany({
          where: { activityType },
          data: { activityType: standardType }
        });
        
        if (result.count > 0) {
          console.log(`  Standardized "${activityType}" → "${standardType}" (${result.count} activities)`);
          typeUpdateCount += result.count;
        }
      }
    }
    
    console.log(`  Total activity types updated: ${typeUpdateCount}\n`);
    
    // Step 2: Standardize activity subtypes based on their parent type
    console.log('Step 2: Standardizing activity subtypes...');
    let subtypeUpdateCount = 0;
    
    // Process each activity type's subtypes
    const standardTypes = await prisma.activityType.findMany({
      include: { subtypes: true }
    });
    
    for (const activityType of standardTypes) {
      const typeCode = activityType.code.toLowerCase().replace(/-/g, '');
      const subtypeMapping = mappingConfig.activitySubtypeMappings[typeCode] || 
                           mappingConfig.activitySubtypeMappings[activityType.code];
      
      if (subtypeMapping) {
        // Get all activities for this type
        const activities = await prisma.activity.findMany({
          where: {
            activityType: activityType.name,
            activitySubtype: { not: null }
          },
          select: {
            id: true,
            activitySubtype: true,
            name: true
          }
        });
        
        // Standardize each subtype
        for (const activity of activities) {
          let standardSubtype = null;
          
          // Try exact match first
          standardSubtype = subtypeMapping[activity.activitySubtype];
          
          // If no exact match, try case-insensitive match
          if (!standardSubtype) {
            const lowerSubtype = activity.activitySubtype.toLowerCase();
            for (const [key, value] of Object.entries(subtypeMapping)) {
              if (key.toLowerCase() === lowerSubtype) {
                standardSubtype = value;
                break;
              }
            }
          }
          
          // If still no match, try to find by keywords in activity name
          if (!standardSubtype && activity.name) {
            const nameLower = activity.name.toLowerCase();
            for (const [key, value] of Object.entries(subtypeMapping)) {
              if (nameLower.includes(key.toLowerCase())) {
                standardSubtype = value;
                break;
              }
            }
          }
          
          // Update if we found a standard name
          if (standardSubtype && standardSubtype !== activity.activitySubtype) {
            await prisma.activity.update({
              where: { id: activity.id },
              data: { activitySubtype: standardSubtype }
            });
            subtypeUpdateCount++;
          }
        }
      }
    }
    
    console.log(`  Total activity subtypes updated: ${subtypeUpdateCount}\n`);
    
    // Step 3: Auto-assign activity types based on keywords for activities without types
    console.log('Step 3: Auto-assigning activity types based on keywords...');
    let autoAssignCount = 0;
    
    const untyped = await prisma.activity.findMany({
      where: {
        OR: [
          { activityType: null },
          { activityType: 'Other' }
        ]
      },
      select: {
        id: true,
        name: true,
        description: true,
        category: true
      }
    });
    
    for (const activity of untyped) {
      const searchText = `${activity.name || ''} ${activity.description || ''} ${activity.category || ''}`.toLowerCase();
      
      let assignedType = null;
      for (const [keyword, actType] of Object.entries(mappingConfig.keywordToActivityType)) {
        if (searchText.includes(keyword)) {
          assignedType = actType;
          break;
        }
      }
      
      if (assignedType) {
        await prisma.activity.update({
          where: { id: activity.id },
          data: { activityType: assignedType }
        });
        autoAssignCount++;
      }
    }
    
    console.log(`  Auto-assigned types to ${autoAssignCount} activities\n`);
    
    // Step 4: Report final statistics
    console.log('Final Statistics:');
    const finalStats = await prisma.activity.groupBy({
      by: ['activityType'],
      _count: { id: true },
      where: {
        activityType: { not: null },
        isActive: true
      },
      orderBy: { _count: { id: 'desc' } }
    });
    
    console.log('\nActivity distribution by type:');
    finalStats.forEach(stat => {
      console.log(`  ${stat.activityType}: ${stat._count.id}`);
    });
    
    // Check for popular subtypes
    const popularSubtypes = await prisma.activity.groupBy({
      by: ['activityType', 'activitySubtype'],
      _count: { id: true },
      where: {
        activitySubtype: { not: null },
        isActive: true
      },
      orderBy: { _count: { id: 'desc' } },
      take: 20
    });
    
    console.log('\nTop activity subtypes:');
    popularSubtypes.filter(sub => sub._count.id > 10).forEach(sub => {
      console.log(`  ${sub.activityType} - ${sub.activitySubtype}: ${sub._count.id}`);
    });
    
    console.log('\nStandardization complete!');
  } catch (error) {
    console.error('Error standardizing activity names:', error);
  } finally {
    await prisma.$disconnect();
  }
}

standardizeActivityNames();