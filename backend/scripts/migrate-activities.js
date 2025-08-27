require('dotenv').config();
const { PrismaClient } = require('../generated/prisma');
const { mapActivity, determineCategories } = require('../migrations/category-mapping');

const prisma = new PrismaClient();

// Parent participation keywords
const PARENT_KEYWORDS = [
  'parent participation',
  'parent and tot',
  'parent & tot',
  'parent and child',
  'parent & child',
  'mommy and me',
  'daddy and me',
  'parent/child',
  'with parent',
  'with caregiver',
  'adult participation required',
  'parent must attend',
  'parent involved',
  'family class'
];

function detectParentParticipation(activity) {
  const searchText = `${activity.name || ''} ${activity.description || ''} ${activity.fullDescription || ''}`.toLowerCase();
  
  // RULE 1: Ages 1 and under ALWAYS require parent participation
  const isInfantAge = (activity.ageMin !== null && activity.ageMin <= 1) || 
                      (activity.ageMax !== null && activity.ageMax <= 1);
  
  // RULE 2: Check for explicit keywords
  const hasKeywords = PARENT_KEYWORDS.some(keyword => 
    searchText.includes(keyword.toLowerCase())
  );
  
  // RULE 3: Additional age-based heuristics
  const isToddlerClass = activity.ageMin <= 3 && searchText.includes('class');
  
  // Set flags
  const requiresParent = isInfantAge || hasKeywords || isToddlerClass;
  
  // Set involvement level
  let parentInvolvement = 'none';
  if (requiresParent) {
    if (isInfantAge) {
      parentInvolvement = 'full';
    } else if (searchText.includes('drop off')) {
      parentInvolvement = 'drop-off';
    } else if (searchText.includes('parent optional')) {
      parentInvolvement = 'partial';
    } else {
      parentInvolvement = 'full';
    }
  }
  
  return { requiresParent, parentInvolvement };
}

async function migrateActivities() {
  console.log('🚀 Starting Activity Migration...\n');
  
  const stats = {
    total: 0,
    mapped: 0,
    unmapped: 0,
    parentDetected: 0,
    categoriesAssigned: 0,
    errors: []
  };
  
  try {
    // Get all activities that need migration
    const activities = await prisma.activity.findMany({
      where: { activityType: null }
    });
    
    stats.total = activities.length;
    console.log(`📊 Found ${stats.total} activities to migrate\n`);
    
    // Get activity types for mapping
    const activityTypes = await prisma.activityType.findMany({
      include: { subtypes: true }
    });
    
    const typeMap = {};
    activityTypes.forEach(type => {
      typeMap[type.name] = {
        id: type.id,
        code: type.code,
        subtypes: {}
      };
      type.subtypes.forEach(sub => {
        typeMap[type.name].subtypes[sub.name] = sub.code;
      });
    });
    
    // Get categories for mapping
    const categories = await prisma.category.findMany();
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.code] = cat.id;
    });
    
    // Process in batches
    const batchSize = 100;
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, Math.min(i + batchSize, activities.length));
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(activities.length/batchSize)}...`);
      
      for (const activity of batch) {
        try {
          // 1. Map to new activity type/subtype
          const mapping = mapActivity(activity);
          
          // 2. Detect parent participation
          const parentDetection = detectParentParticipation(activity);
          if (parentDetection.requiresParent) {
            stats.parentDetected++;
          }
          
          // 3. Determine categories based on age and parent flag
          const categoryActivity = {
            ...activity,
            requiresParent: parentDetection.requiresParent
          };
          const categoryCodesList = determineCategories(categoryActivity);
          
          // 4. Update activity with new fields
          await prisma.activity.update({
            where: { id: activity.id },
            data: {
              activityType: mapping.activityType,
              activitySubtype: mapping.activitySubtype,
              requiresParent: parentDetection.requiresParent,
              parentInvolvement: parentDetection.parentInvolvement
            }
          });
          
          // 5. Create category associations
          for (const categoryCode of categoryCodesList) {
            const categoryId = categoryMap[categoryCode];
            if (categoryId) {
              try {
                await prisma.activityCategory.create({
                  data: {
                    activityId: activity.id,
                    categoryId: categoryId,
                    isPrimary: categoryCodesList[0] === categoryCode,
                    confidence: 0.9,
                    source: 'migration'
                  }
                });
                stats.categoriesAssigned++;
              } catch (err) {
                // Ignore duplicate key errors
                if (!err.message.includes('Unique constraint')) {
                  throw err;
                }
              }
            }
          }
          
          // 6. Track unmapped activities
          if (mapping.activityType === 'Other Activity' || !mapping.activityType) {
            await prisma.unmappedActivity.create({
              data: {
                activityId: activity.id,
                originalCategory: activity.category,
                originalSubcategory: activity.subcategory,
                scraperText: JSON.stringify({
                  name: activity.name,
                  description: activity.description,
                  category: activity.category,
                  subcategory: activity.subcategory
                })
              }
            });
            stats.unmapped++;
          } else {
            stats.mapped++;
          }
          
        } catch (error) {
          console.error(`Error migrating activity ${activity.id}:`, error.message);
          stats.errors.push({
            activityId: activity.id,
            name: activity.name,
            error: error.message
          });
        }
      }
      
      // Show progress
      console.log(`  ✅ Processed ${Math.min(i + batchSize, activities.length)}/${activities.length} activities`);
    }
    
    // Final statistics
    console.log('\n' + '='.repeat(60));
    console.log('📈 Migration Complete!');
    console.log('='.repeat(60));
    console.log(`Total Activities:        ${stats.total}`);
    console.log(`Successfully Mapped:     ${stats.mapped}`);
    console.log(`Unmapped (Other):        ${stats.unmapped}`);
    console.log(`Parent Required:         ${stats.parentDetected}`);
    console.log(`Categories Assigned:     ${stats.categoriesAssigned}`);
    console.log(`Errors:                  ${stats.errors.length}`);
    
    // Show category distribution
    console.log('\n📊 Category Distribution:');
    for (const cat of categories) {
      const count = await prisma.activityCategory.count({
        where: { categoryId: cat.id }
      });
      console.log(`   ${cat.name}: ${count} activities`);
    }
    
    // Show activity type distribution
    console.log('\n📊 Top Activity Types:');
    const typeDistribution = await prisma.activity.groupBy({
      by: ['activityType'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10
    });
    
    typeDistribution.forEach(item => {
      console.log(`   ${item.activityType || 'Not Set'}: ${item._count.id} activities`);
    });
    
    // Show unmapped categories that need attention
    if (stats.unmapped > 0) {
      console.log('\n⚠️  Unmapped Categories Needing Review:');
      const unmappedSamples = await prisma.unmappedActivity.findMany({
        take: 10,
        where: { reviewed: false }
      });
      
      const uniqueCategories = [...new Set(unmappedSamples.map(u => u.originalCategory))];
      uniqueCategories.forEach(cat => {
        console.log(`   - ${cat}`);
      });
      console.log(`   ... and ${Math.max(0, stats.unmapped - 10)} more`);
    }
    
    if (stats.errors.length > 0) {
      console.log('\n❌ Errors (first 5):');
      stats.errors.slice(0, 5).forEach(err => {
        console.log(`   - ${err.name}: ${err.error}`);
      });
    }
    
  } catch (error) {
    console.error('Fatal error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
  
  return stats;
}

// Run the migration
console.log('🔄 Kids Activity Tracker - Category Refactor Migration');
console.log('='.repeat(60));
console.log('This script will:');
console.log('1. Map all activities to new activity types/subtypes');
console.log('2. Detect parent participation requirements');
console.log('3. Assign age-based categories');
console.log('4. Track unmapped activities for review');
console.log('='.repeat(60) + '\n');

migrateActivities()
  .then((stats) => {
    console.log('\n✅ Migration completed successfully!');
    if (stats.unmapped > 0) {
      console.log(`\n📝 Note: ${stats.unmapped} activities need manual review.`);
      console.log('   Run the admin review tool to categorize them properly.');
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });