const { PrismaClient } = require('./generated/prisma');
const { determineCategories } = require('./comprehensive-activity-mapper-v2');

const prisma = new PrismaClient();

async function populateActivityCategories() {
  try {
    console.log('Starting to populate activity categories...\n');
    
    // Get all categories
    const categories = await prisma.category.findMany();
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.code] = cat.id;
    });
    
    console.log('Found categories:', Object.keys(categoryMap).join(', '));
    
    // Clear existing ActivityCategory records
    console.log('\nClearing existing ActivityCategory records...');
    await prisma.activityCategory.deleteMany({});
    
    // Get all active activities
    const activities = await prisma.activity.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        ageMin: true,
        ageMax: true,
        subcategory: true,
        requiresParent: true
      }
    });
    
    console.log(`\nProcessing ${activities.length} active activities...`);
    
    let processedCount = 0;
    let createdCount = 0;
    const batchSize = 100;
    
    // Process in batches
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, Math.min(i + batchSize, activities.length));
      const categoryAssociations = [];
      
      for (const activity of batch) {
        const categoryCodes = determineCategories(activity);
        
        // Create category associations
        for (let idx = 0; idx < categoryCodes.length; idx++) {
          const categoryId = categoryMap[categoryCodes[idx]];
          if (categoryId) {
            categoryAssociations.push({
              activityId: activity.id,
              categoryId: categoryId,
              isPrimary: idx === 0, // First category is primary
              confidence: 0.95,
              source: 'category-population-script'
            });
          }
        }
        
        processedCount++;
      }
      
      // Bulk create associations for this batch
      if (categoryAssociations.length > 0) {
        await prisma.activityCategory.createMany({
          data: categoryAssociations,
          skipDuplicates: true
        });
        createdCount += categoryAssociations.length;
      }
      
      // Progress update
      if (processedCount % 500 === 0 || processedCount === activities.length) {
        process.stdout.write(`\rProcessed: ${processedCount}/${activities.length} activities, Created: ${createdCount} associations`);
      }
    }
    
    console.log('\n\nPopulation complete!');
    
    // Show statistics
    const stats = await prisma.activityCategory.groupBy({
      by: ['categoryId'],
      _count: { id: true }
    });
    
    console.log('\nActivities per category:');
    for (const stat of stats) {
      const category = categories.find(c => c.id === stat.categoryId);
      console.log(`  ${category.name}: ${stat._count.id} activities`);
    }
    
    console.log(`\nTotal ActivityCategory associations: ${createdCount}`);
    
  } catch (error) {
    console.error('Error populating activity categories:', error);
  } finally {
    await prisma.$disconnect();
  }
}

populateActivityCategories();