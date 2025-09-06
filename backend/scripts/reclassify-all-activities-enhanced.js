const { PrismaClient } = require('../generated/prisma');
const { mapActivityType } = require('../utils/activityTypeMapper-enhanced');

const prisma = new PrismaClient();

async function reclassifyAllActivities() {
  console.log('🔄 Starting comprehensive activity reclassification...');
  
  try {
    // Get all activities
    const activities = await prisma.activity.findMany({
      select: {
        id: true,
        name: true,
        category: true,
        subcategory: true,
        description: true,
        activityTypeId: true,
        activitySubtypeId: true
      }
    });

    console.log(`📊 Found ${activities.length} activities to reclassify`);
    
    let updated = 0;
    let unchanged = 0;
    let errors = 0;
    
    // Process activities in batches to avoid overwhelming the database
    const batchSize = 50;
    const batches = [];
    
    for (let i = 0; i < activities.length; i += batchSize) {
      batches.push(activities.slice(i, i + batchSize));
    }
    
    console.log(`🔄 Processing ${batches.length} batches of ${batchSize} activities each...`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n📦 Processing batch ${batchIndex + 1}/${batches.length}...`);
      
      for (const activity of batch) {
        try {
          // Get new classification
          const newClassification = await mapActivityType({
            name: activity.name,
            category: activity.category,
            subcategory: activity.subcategory,
            description: activity.description
          });
          
          // Check if classification changed
          const hasChanged = 
            activity.activityTypeId !== newClassification.activityTypeId ||
            activity.activitySubtypeId !== newClassification.activitySubtypeId;
          
          if (hasChanged) {
            // Update the activity
            await prisma.activity.update({
              where: { id: activity.id },
              data: {
                activityTypeId: newClassification.activityTypeId,
                activitySubtypeId: newClassification.activitySubtypeId
              }
            });
            
            updated++;
            
            // Log significant changes
            if (activity.activityTypeId !== newClassification.activityTypeId) {
              console.log(`  ✅ Updated "${activity.name.substring(0, 50)}..." - Type changed`);
            } else if (newClassification.activitySubtypeId && !activity.activitySubtypeId) {
              console.log(`  ✅ Added subtype to "${activity.name.substring(0, 40)}..."`);
            }
          } else {
            unchanged++;
          }
          
        } catch (error) {
          console.error(`❌ Error processing activity "${activity.name}":`, error.message);
          errors++;
        }
      }
      
      // Progress update
      const processed = (batchIndex + 1) * batchSize;
      const percentage = Math.min(100, Math.round((processed / activities.length) * 100));
      console.log(`📊 Progress: ${percentage}% (${Math.min(processed, activities.length)}/${activities.length})`);
    }
    
    console.log('\n🎉 Reclassification completed!');
    console.log(`📊 Summary:`);
    console.log(`  ✅ Updated: ${updated} activities`);
    console.log(`  ⚪ Unchanged: ${unchanged} activities`);
    console.log(`  ❌ Errors: ${errors} activities`);
    
    // Get statistics on new classifications
    console.log('\n📈 Getting updated statistics...');
    
    const typeStats = await prisma.activity.groupBy({
      by: ['activityTypeId'],
      _count: true,
      orderBy: {
        _count: {
          activityTypeId: 'desc'
        }
      }
    });
    
    console.log('\n📊 Activities by Type:');
    for (const stat of typeStats) {
      const type = await prisma.activityType.findUnique({
        where: { id: stat.activityTypeId }
      });
      console.log(`  ${type?.name}: ${stat._count} activities`);
    }
    
    const subtypeStats = await prisma.activity.groupBy({
      by: ['activitySubtypeId'],
      _count: true,
      where: {
        activitySubtypeId: {
          not: null
        }
      },
      orderBy: {
        _count: {
          activitySubtypeId: 'desc'
        }
      }
    });
    
    console.log('\n📊 Top 10 Subtypes:');
    for (let i = 0; i < Math.min(10, subtypeStats.length); i++) {
      const stat = subtypeStats[i];
      const subtype = await prisma.activitySubtype.findUnique({
        where: { id: stat.activitySubtypeId }
      });
      console.log(`  ${subtype?.name}: ${stat._count} activities`);
    }
    
    // Count activities without subtypes
    const noSubtypeCount = await prisma.activity.count({
      where: {
        activitySubtypeId: null
      }
    });
    
    console.log(`\n📊 Activities without subtypes: ${noSubtypeCount}`);
    
    if (noSubtypeCount > 0) {
      console.log('\n🔍 Sample activities without subtypes:');
      const sampleNoSubtype = await prisma.activity.findMany({
        where: {
          activitySubtypeId: null
        },
        select: {
          name: true,
          activityType: {
            select: {
              name: true
            }
          }
        },
        take: 5
      });
      
      sampleNoSubtype.forEach(activity => {
        console.log(`  • "${activity.name}" (${activity.activityType?.name})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Reclassification failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  reclassifyAllActivities()
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { reclassifyAllActivities };