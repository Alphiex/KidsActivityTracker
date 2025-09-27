const { PrismaClient } = require('../generated/prisma');

/**
 * Activity Category Assigner
 * 
 * This utility assigns age-based categories to activities automatically.
 * Designed to be used by scrapers and other activity creation/update processes.
 */

class ActivityCategoryAssigner {
  constructor() {
    this.prisma = new PrismaClient();
    this.categoryCache = null;
  }

  async loadCategories() {
    if (!this.categoryCache) {
      const categories = await this.prisma.category.findMany({
        orderBy: { displayOrder: 'asc' }
      });
      
      this.categoryCache = {};
      categories.forEach(category => {
        this.categoryCache[category.name] = category;
      });
    }
    return this.categoryCache;
  }

  /**
   * Determine which categories an activity should belong to based on age and content
   */
  async determineCategories(activity) {
    const categoryMap = await this.loadCategories();
    const categories = [];
    
    const ageMin = activity.ageMin || 0;
    const ageMax = activity.ageMax || 100;
    const activityName = (activity.name || '').toLowerCase();
    const activityDescription = (activity.description || '').toLowerCase();
    const activityCategory = (activity.category || '').toLowerCase();
    
    // Combine all text for keyword searching
    const searchText = `${activityName} ${activityDescription} ${activityCategory}`;
    
    console.log(`   🏷️ Categorizing: ${activity.name} (ages ${ageMin}-${ageMax})`);
    
    // Early Years: Parent Participation (0-5 years, requires parent)
    const parentParticipation = categoryMap['Early Years: Parent Participation'];
    const hasParentKeywords = searchText.includes('parent') || 
                             searchText.includes('family') ||
                             searchText.includes('caregiver') ||
                             searchText.includes('guardian') ||
                             searchText.includes('mommy') ||
                             searchText.includes('daddy') ||
                             searchText.includes('tot');
    
    if (parentParticipation && ageMin <= 5 && hasParentKeywords) {
      categories.push(parentParticipation);
      console.log(`     👪 → Early Years: Parent Participation (parent keywords)`);
    }
    
    // Early Years: On My Own (0-5 years, independent)
    const earlyYearsIndependent = categoryMap['Early Years: On My Own'];
    if (earlyYearsIndependent && ageMin <= 5 && ageMax >= 0 && !categories.some(c => c.id === parentParticipation?.id)) {
      categories.push(earlyYearsIndependent);
      console.log(`     🧒 → Early Years: On My Own (0-5 years)`);
    }
    
    // School Age (5-13 years)
    const schoolAge = categoryMap['School Age'];
    if (schoolAge && ageMin <= 13 && ageMax >= 5) {
      categories.push(schoolAge);
      console.log(`     🎒 → School Age (5-13 years)`);
    }
    
    // Youth (10-18 years)
    const youth = categoryMap['Youth'];
    if (youth && ageMin <= 18 && ageMax >= 10) {
      categories.push(youth);
      console.log(`     🧑‍🎓 → Youth (10-18 years)`);
    }
    
    // All Ages & Family (wide age range or family activities)
    const allAgesFamily = categoryMap['All Ages & Family'];
    const hasFamilyKeywords = searchText.includes('family') || 
                             searchText.includes('all ages') ||
                             searchText.includes('everyone') ||
                             searchText.includes('multi-generational');
    
    const hasWideAgeRange = (ageMax - ageMin) >= 12; // 12+ year range
    const spansMultipleGroups = (ageMin <= 6 && ageMax >= 16); // Spans early childhood to teens
    
    if (allAgesFamily && (hasFamilyKeywords || hasWideAgeRange || spansMultipleGroups)) {
      categories.push(allAgesFamily);
      console.log(`     👨‍👩‍👧‍👦 → All Ages & Family (${hasFamilyKeywords ? 'family keywords' : hasWideAgeRange ? 'wide age range' : 'spans multiple groups'})`);
    }
    
    // If no categories matched, assign based on primary age range
    if (categories.length === 0) {
      console.log(`     ⚠️ No categories matched, using age-based assignment`);
      const ageMidpoint = (ageMin + ageMax) / 2;
      
      if (ageMidpoint <= 5) {
        categories.push(earlyYearsIndependent);
        console.log(`     🧒 → Early Years: On My Own (default for age ${ageMidpoint})`);
      } else if (ageMidpoint <= 13) {
        categories.push(schoolAge);
        console.log(`     🎒 → School Age (default for age ${ageMidpoint})`);
      } else if (ageMidpoint <= 18) {
        categories.push(youth);
        console.log(`     🧑‍🎓 → Youth (default for age ${ageMidpoint})`);
      } else {
        categories.push(allAgesFamily);
        console.log(`     👨‍👩‍👧‍👦 → All Ages & Family (default for age ${ageMidpoint})`);
      }
    }
    
    return categories;
  }

  /**
   * Assign categories to an activity in the database
   */
  async assignCategoriesToActivity(activityId, categories) {
    const assignments = [];
    
    for (const category of categories) {
      try {
        const assignment = await this.prisma.activityCategory.upsert({
          where: {
            activityId_categoryId: {
              activityId: activityId,
              categoryId: category.id
            }
          },
          update: {},
          create: {
            activityId: activityId,
            categoryId: category.id
          }
        });
        assignments.push(assignment);
      } catch (error) {
        // Ignore duplicate constraint errors
        if (!error.message.includes('unique constraint')) {
          console.error(`     ❌ Error assigning category ${category.name}:`, error.message);
        }
      }
    }
    
    return assignments;
  }

  /**
   * Full process: determine and assign categories for an activity
   */
  async processActivity(activity) {
    const categories = await this.determineCategories(activity);
    
    if (activity.id) {
      const assignments = await this.assignCategoriesToActivity(activity.id, categories);
      console.log(`     ✅ Assigned ${assignments.length} categories to activity`);
      return { categories, assignments };
    } else {
      // Return categories for activities that haven't been saved yet
      return { categories, assignments: [] };
    }
  }

  /**
   * Process multiple activities in batch
   */
  async processActivities(activities) {
    console.log(`🏷️ Processing ${activities.length} activities for category assignment...`);
    
    let totalAssignments = 0;
    const results = [];
    
    for (const activity of activities) {
      try {
        const result = await this.processActivity(activity);
        results.push(result);
        totalAssignments += result.assignments.length;
      } catch (error) {
        console.error(`❌ Error processing activity ${activity.name}:`, error.message);
        results.push({ categories: [], assignments: [], error: error.message });
      }
    }
    
    console.log(`✅ Category assignment completed: ${totalAssignments} total assignments`);
    return results;
  }

  /**
   * Get category IDs for use in activity creation data
   */
  async getCategoryIdsForActivity(activity) {
    const categories = await this.determineCategories(activity);
    return categories.map(cat => ({ categoryId: cat.id }));
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }
}

module.exports = { ActivityCategoryAssigner };