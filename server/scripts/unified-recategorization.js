const { PrismaClient } = require('../generated/prisma');
const { ComprehensiveActivityCategorizer } = require('../utils/comprehensiveActivityCategorizer');

const prisma = new PrismaClient();

/**
 * Unified Activity Recategorization Script
 * 
 * This script performs complete activity recategorization:
 * 1. Uses the existing ComprehensiveActivityCategorizer for activity types/subtypes
 * 2. Assigns age-based categories to all activities
 * 3. Works on both local and production databases
 */

function determineCategories(activity, categoryMap) {
  const categories = [];
  const ageMin = activity.ageMin || 0;
  const ageMax = activity.ageMax || 100;
  const activityName = (activity.name || '').toLowerCase();
  const activityDescription = (activity.description || '').toLowerCase();
  
  console.log(`   📊 Age range: ${ageMin}-${ageMax} years`);
  
  // Early Years: Parent Participation (0-5 years, requires parent)
  const parentParticipation = categoryMap['Early Years: Parent Participation'];
  const hasParentKeywords = activityName.includes('parent') || 
                           activityDescription.includes('parent') ||
                           activityName.includes('family') ||
                           activityName.includes('caregiver') ||
                           activityName.includes('guardian');
  
  if (parentParticipation && ageMin <= 5 && hasParentKeywords) {
    categories.push(parentParticipation);
    console.log(`   👪 Assigned to: Early Years: Parent Participation (parent keywords found)`);
  }
  
  // Early Years: On My Own (0-5 years, independent)
  const earlyYearsIndependent = categoryMap['Early Years: On My Own'];
  if (earlyYearsIndependent && ageMin <= 5 && ageMax >= 0 && !categories.some(c => c.id === parentParticipation?.id)) {
    categories.push(earlyYearsIndependent);
    console.log(`   🧒 Assigned to: Early Years: On My Own (0-5 years, no parent keywords)`);
  }
  
  // School Age (5-13 years)
  const schoolAge = categoryMap['School Age'];
  if (schoolAge && ageMin <= 13 && ageMax >= 5) {
    categories.push(schoolAge);
    console.log(`   🎒 Assigned to: School Age (overlaps 5-13 years)`);
  }
  
  // Youth (10-18 years)
  const youth = categoryMap['Youth'];
  if (youth && ageMin <= 18 && ageMax >= 10) {
    categories.push(youth);
    console.log(`   🧑‍🎓 Assigned to: Youth (overlaps 10-18 years)`);
  }
  
  // All Ages & Family (wide age range or family activities)
  const allAgesFamily = categoryMap['All Ages & Family'];
  const hasFamilyKeywords = activityName.includes('family') || 
                           activityName.includes('all ages') ||
                           activityDescription.includes('family') ||
                           activityDescription.includes('all ages');
  
  const hasWideAgeRange = (ageMax - ageMin) >= 12; // 12+ year range
  const spansMultipleGroups = (ageMin <= 6 && ageMax >= 16); // Spans early childhood to teens
  
  if (allAgesFamily && (hasFamilyKeywords || hasWideAgeRange || spansMultipleGroups)) {
    categories.push(allAgesFamily);
    console.log(`   👨‍👩‍👧‍👦 Assigned to: All Ages & Family (${hasFamilyKeywords ? 'family keywords' : hasWideAgeRange ? 'wide age range' : 'spans multiple age groups'})`);
  }
  
  // If no categories matched, assign based on primary age range
  if (categories.length === 0) {
    console.log(`   ⚠️ No categories matched, assigning based on age midpoint`);
    const ageMidpoint = (ageMin + ageMax) / 2;
    
    if (ageMidpoint <= 5) {
      categories.push(earlyYearsIndependent);
      console.log(`   🧒 Default assignment: Early Years: On My Own (midpoint: ${ageMidpoint})`);
    } else if (ageMidpoint <= 13) {
      categories.push(schoolAge);
      console.log(`   🎒 Default assignment: School Age (midpoint: ${ageMidpoint})`);
    } else if (ageMidpoint <= 18) {
      categories.push(youth);
      console.log(`   🧑‍🎓 Default assignment: Youth (midpoint: ${ageMidpoint})`);
    } else {
      categories.push(allAgesFamily);
      console.log(`   👨‍👩‍👧‍👦 Default assignment: All Ages & Family (midpoint: ${ageMidpoint})`);
    }
  }
  
  return categories;
}

async function runUnifiedRecategorization() {
  console.log('🚀 UNIFIED ACTIVITY RECATEGORIZATION');
  console.log('=====================================\n');
  
  try {
    // Step 1: Activity Types and Subtypes using existing comprehensive categorizer
    console.log('📋 STEP 1: Activity Types & Subtypes Recategorization');
    console.log('Using existing ComprehensiveActivityCategorizer...\n');
    
    const categorizer = new ComprehensiveActivityCategorizer();
    const typeStats = await categorizer.recategorizeAllActivities();
    
    console.log('\n✅ Activity types and subtypes recategorization completed!');
    console.log(`   - Activities updated: ${typeStats.updated}`);
    console.log(`   - Comprehensive matches: ${typeStats.comprehensive}`);
    
    // Step 2: Age-based Categories Assignment
    console.log('\n📂 STEP 2: Age-based Categories Assignment');
    console.log('Assigning activities to categories based on age ranges...\n');
    
    // Get category mapping
    const categories = await prisma.category.findMany({
      orderBy: { displayOrder: 'asc' }
    });
    
    const categoryMap = {};
    categories.forEach(category => {
      categoryMap[category.name] = category;
    });
    
    console.log(`📊 Found ${categories.length} categories:`);
    categories.forEach(cat => {
      console.log(`   - ${cat.name} (${cat.ageMin !== null ? `${cat.ageMin}-${cat.ageMax} years` : 'all ages'}${cat.requiresParent ? ', requires parent' : ''})`);
    });
    
    // Get all activities with age information
    const activities = await prisma.activity.findMany({
      where: {
        isUpdated: true // Only process active activities
      },
      select: {
        id: true,
        name: true,
        description: true,
        ageMin: true,
        ageMax: true
      }
    });
    
    console.log(`\n📋 Processing ${activities.length} activities for category assignment...\n`);
    
    let categoryStats = {
      processed: 0,
      assignments: 0,
      errors: 0
    };
    
    for (const activity of activities) {
      console.log(`🔍 Processing: ${activity.name}`);
      
      try {
        // Determine applicable categories
        const applicableCategories = determineCategories(activity, categoryMap);
        
        // Assign categories
        for (const category of applicableCategories) {
          try {
            await prisma.activityCategory.upsert({
              where: {
                activityId_categoryId: {
                  activityId: activity.id,
                  categoryId: category.id
                }
              },
              update: {},
              create: {
                activityId: activity.id,
                categoryId: category.id
              }
            });
            categoryStats.assignments++;
          } catch (error) {
            // Ignore duplicate key errors
            if (!error.message.includes('unique constraint')) {
              console.error(`   ❌ Error assigning category ${category.name}:`, error.message);
              categoryStats.errors++;
            }
          }
        }
        
        categoryStats.processed++;
        
        if (categoryStats.processed % 25 === 0) {
          console.log(`\n📈 Progress: ${categoryStats.processed}/${activities.length} activities processed\n`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error processing activity:`, error.message);
        categoryStats.errors++;
      }
    }
    
    // Step 3: Final Verification and Statistics
    console.log('\n📊 STEP 3: Final Verification & Statistics');
    console.log('=========================================\n');
    
    // Activity Type Statistics
    console.log('🏷️ ACTIVITY TYPE DISTRIBUTION:');
    const typeDistribution = await prisma.activityType.findMany({
      select: {
        name: true,
        _count: { select: { activities: true } }
      },
      orderBy: { activities: { _count: 'desc' } }
    });
    
    typeDistribution.forEach((type, index) => {
      const count = type._count.activities;
      console.log(`   ${index + 1}. ${type.name}: ${count} activities`);
    });
    
    // Category Statistics
    console.log('\n📂 CATEGORY DISTRIBUTION:');
    for (const category of categories) {
      const count = await prisma.activityCategory.count({
        where: { categoryId: category.id }
      });
      console.log(`   - ${category.name}: ${count} activities`);
    }
    
    // Overall Statistics
    const totalActivities = await prisma.activity.count({ where: { isUpdated: true } });
    const activitiesWithTypes = await prisma.activity.count({ 
      where: { isUpdated: true, activityTypeId: { not: null } } 
    });
    const activitiesWithSubtypes = await prisma.activity.count({ 
      where: { isUpdated: true, activitySubtypeId: { not: null } } 
    });
    const totalCategoryAssignments = await prisma.activityCategory.count();
    
    console.log('\n🎯 FINAL SUMMARY:');
    console.log('================');
    console.log(`Total active activities: ${totalActivities}`);
    console.log(`Activities with types: ${activitiesWithTypes} (${((activitiesWithTypes/totalActivities)*100).toFixed(1)}%)`);
    console.log(`Activities with subtypes: ${activitiesWithSubtypes} (${((activitiesWithSubtypes/totalActivities)*100).toFixed(1)}%)`);
    console.log(`Total category assignments: ${totalCategoryAssignments}`);
    console.log(`Average categories per activity: ${(totalCategoryAssignments/totalActivities).toFixed(1)}`);
    console.log('\n✅ UNIFIED RECATEGORIZATION COMPLETED SUCCESSFULLY!');
    
    await categorizer.disconnect();
    
    return {
      typeStats,
      categoryStats,
      totals: {
        totalActivities,
        activitiesWithTypes,
        activitiesWithSubtypes,
        totalCategoryAssignments
      }
    };
    
  } catch (error) {
    console.error('❌ Error during unified recategorization:', error);
    throw error;
  }
}

async function main() {
  console.log('🎯 Kids Activity Tracker - Unified Recategorization Script');
  console.log('===========================================================\n');
  console.log(`🕒 Started at: ${new Date().toISOString()}`);
  console.log(`🗄️ Database: ${process.env.DATABASE_URL ? 'Connected' : 'No DATABASE_URL found'}\n`);
  
  const results = await runUnifiedRecategorization();
  
  console.log(`\n🕒 Completed at: ${new Date().toISOString()}`);
  return results;
}

if (require.main === module) {
  main()
    .then((results) => {
      console.log('\n🎉 Script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}

module.exports = { runUnifiedRecategorization };