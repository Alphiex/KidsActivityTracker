const { PrismaClient } = require('./generated/prisma');
const { mapActivityComprehensive } = require('./comprehensive-activity-mapper-v2');

const prisma = new PrismaClient();

async function migrateInBatches() {
  try {
    console.log('Starting batched activity migration for production...\n');
    
    // Get total count
    const totalCount = await prisma.activity.count({
      where: { isActive: true }
    });
    
    console.log(`Found ${totalCount} active activities to migrate`);
    
    const batchSize = 50; // Process 50 at a time
    const totalBatches = Math.ceil(totalCount / batchSize);
    
    let processedCount = 0;
    let updatedCount = 0;
    
    for (let batch = 0; batch < totalBatches; batch++) {
      console.log(`\nProcessing batch ${batch + 1}/${totalBatches}...`);
      
      // Fetch batch
      const activities = await prisma.activity.findMany({
        where: { isActive: true },
        skip: batch * batchSize,
        take: batchSize,
        select: {
          id: true,
          name: true,
          category: true,
          subcategory: true,
          description: true,
          activityType: true,
          activitySubtype: true,
          ageMin: true,
          ageMax: true
        }
      });
      
      // Process each activity in the batch
      for (const activity of activities) {
        try {
          const { activityType, activitySubtype } = mapActivityComprehensive(activity);
          
          // Determine categories
          const categoryCodes = [];
          
          if (activity.ageMin !== null && activity.ageMax !== null) {
            // Baby & Parent (0-1)
            if (activity.ageMin <= 1 && activity.ageMax >= 0) {
              if (activity.name?.toLowerCase().includes('parent') || 
                  activity.subcategory?.toLowerCase().includes('parent')) {
                categoryCodes.push('baby-parent');
              }
            }
            
            // Early Years Solo (0-6)
            if (activity.ageMin <= 6 && activity.ageMax >= 0) {
              if (!activity.name?.toLowerCase().includes('parent') && 
                  !activity.subcategory?.toLowerCase().includes('parent')) {
                categoryCodes.push('early-years-solo');
              }
            }
            
            // Early Years with Parent (0-6)
            if (activity.ageMin <= 6 && activity.ageMax >= 0) {
              if (activity.name?.toLowerCase().includes('parent') || 
                  activity.subcategory?.toLowerCase().includes('parent')) {
                categoryCodes.push('early-years-parent');
              }
            }
            
            // School Age (5-13)
            if (activity.ageMin <= 13 && activity.ageMax >= 5) {
              categoryCodes.push('school-age');
            }
            
            // Youth (10-18)
            if (activity.ageMin <= 18 && activity.ageMax >= 10) {
              categoryCodes.push('youth');
            }
          } else {
            // Default to School Age if no age info
            categoryCodes.push('school-age');
          }
          
          // Update activity
          await prisma.activity.update({
            where: { id: activity.id },
            data: {
              activityType,
              activitySubtype,
              requiresParent: categoryCodes.includes('baby-parent') || categoryCodes.includes('early-years-parent'),
              parentInvolvement: categoryCodes.includes('baby-parent') || categoryCodes.includes('early-years-parent') 
                ? 'Required' 
                : null
            }
          });
          
          updatedCount++;
        } catch (error) {
          console.error(`Error updating activity ${activity.id}:`, error.message);
        }
        
        processedCount++;
        
        // Progress update every 10 activities
        if (processedCount % 10 === 0) {
          process.stdout.write(`\r  Processed: ${processedCount}/${totalCount} (${Math.round(processedCount/totalCount*100)}%)`);
        }
      }
      
      // Small delay between batches to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`\n\nMigration complete!`);
    console.log(`Total processed: ${processedCount}`);
    console.log(`Total updated: ${updatedCount}`);
    
    // Get summary statistics
    const typeSummary = await prisma.activity.groupBy({
      by: ['activityType'],
      _count: { id: true },
      where: { isActive: true },
      orderBy: { _count: { id: 'desc' } }
    });
    
    console.log('\nActivity Type Distribution:');
    typeSummary.forEach(t => {
      console.log(`  ${t.activityType}: ${t._count.id} activities`);
    });
    
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateInBatches();