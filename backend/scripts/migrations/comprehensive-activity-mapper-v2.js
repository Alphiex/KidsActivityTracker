const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

// Load mapping configuration
const mappingConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'activity-name-mapping.json'), 'utf-8')
);

/**
 * Comprehensive activity mapping function V2
 * This analyzes activity name, description, category, and subcategory to determine:
 * 1. Activity Type (e.g., Swimming & Aquatics, Team Sports)
 * 2. Activity Subtype (e.g., Basketball, Learn to Swim)
 * 3. Categories (age-based: School Age, Youth, Early Years, etc.)
 */
function mapActivityComprehensive(activity) {
  const name = (activity.name || '').toLowerCase();
  const description = (activity.description || '').toLowerCase();
  const subcategory = (activity.subcategory || '').toLowerCase();
  const category = (activity.category || '').toLowerCase();
  const searchText = `${name} ${description} ${subcategory} ${category}`;
  
  let activityType = null;
  let activitySubtype = null;
  
  // Priority 1: Check for camps FIRST (camps often include other activities in name)
  if (subcategory.includes('camp') || name.includes('camp') || 
      subcategory.includes('day camp') || subcategory.includes('full day') || 
      subcategory.includes('part day')) {
    activityType = 'Camps';
    if (subcategory.includes('full day') || name.includes('full day')) {
      activitySubtype = 'Full Day Camp';
    } else if (subcategory.includes('part day') || name.includes('part day')) {
      activitySubtype = 'Part Day Camp';
    } else if (searchText.includes('summer')) {
      activitySubtype = 'Summer Camp';
    } else if (searchText.includes('sport')) {
      activitySubtype = 'Sports Camp';
    } else if (searchText.includes('day camp')) {
      activitySubtype = 'Day Camp';
    } else {
      activitySubtype = 'General Camp';
    }
    return { activityType, activitySubtype };
  }
  
  // Priority 2: Check subcategory field for direct matches
  if (subcategory) {
    // Swimming
    if (subcategory.includes('swim')) {
      activityType = 'Swimming & Aquatics';
      if (subcategory.includes('adapted')) {
        activitySubtype = 'Adapted Swimming';
      } else if (subcategory.includes('parent')) {
        activitySubtype = 'Parent & Tot Swimming';
      } else if (subcategory.includes('competitive')) {
        activitySubtype = 'Competitive Swimming';
      } else {
        activitySubtype = 'Learn to Swim';
      }
      return { activityType, activitySubtype };
    }
    
    // Tennis
    if (subcategory.includes('tennis')) {
      activityType = 'Racquet Sports';
      activitySubtype = 'Tennis';
      return { activityType, activitySubtype };
    }
    
    // Basketball
    if (subcategory.includes('basketball')) {
      activityType = 'Team Sports';
      activitySubtype = 'Basketball';
      return { activityType, activitySubtype };
    }
    
    // Soccer
    if (subcategory.includes('soccer') || subcategory.includes('football')) {
      activityType = 'Team Sports';
      activitySubtype = 'Soccer';
      return { activityType, activitySubtype };
    }
    
    // Volleyball
    if (subcategory.includes('volleyball')) {
      activityType = 'Team Sports';
      activitySubtype = 'Volleyball';
      return { activityType, activitySubtype };
    }
    
    // Hockey
    if (subcategory.includes('hockey')) {
      activityType = 'Team Sports';
      activitySubtype = 'Hockey';
      return { activityType, activitySubtype };
    }
    
    // Baseball
    if (subcategory.includes('baseball') || subcategory.includes('t-ball')) {
      activityType = 'Team Sports';
      activitySubtype = 'Baseball';
      return { activityType, activitySubtype };
    }
    
    // Martial Arts
    if (subcategory.includes('karate')) {
      activityType = 'Martial Arts';
      activitySubtype = 'Karate';
      return { activityType, activitySubtype };
    }
    
    if (subcategory.includes('taekwondo')) {
      activityType = 'Martial Arts';
      activitySubtype = 'Taekwondo';
      return { activityType, activitySubtype };
    }
    
    // Dance
    if (subcategory.includes('ballet')) {
      activityType = 'Dance';
      activitySubtype = 'Ballet';
      return { activityType, activitySubtype };
    }
    
    if (subcategory.includes('hip hop')) {
      activityType = 'Dance';
      activitySubtype = 'Hip Hop';
      return { activityType, activitySubtype };
    }
    
    if (subcategory.includes('dance')) {
      activityType = 'Dance';
      activitySubtype = 'General Dance';
      return { activityType, activitySubtype };
    }
    
    // Skating
    if (subcategory.includes('skat') || subcategory.includes('skating')) {
      activityType = 'Skating & Wheels';
      if (subcategory.includes('figure')) {
        activitySubtype = 'Figure Skating';
      } else {
        activitySubtype = 'Ice Skating';
      }
      return { activityType, activitySubtype };
    }
    
    // Visual Arts
    if (subcategory.includes('visual arts') || subcategory.includes('art')) {
      activityType = 'Visual Arts';
      if (subcategory.includes('paint')) {
        activitySubtype = 'Painting';
      } else if (subcategory.includes('draw')) {
        activitySubtype = 'Drawing';
      } else if (subcategory.includes('pottery')) {
        activitySubtype = 'Pottery';
      } else if (subcategory.includes('craft')) {
        activitySubtype = 'Crafts';
      } else {
        activitySubtype = 'General Art';
      }
      return { activityType, activitySubtype };
    }
    
    // Music
    if (subcategory.includes('music') || subcategory.includes('piano') || 
        subcategory.includes('guitar') || subcategory.includes('violin') || 
        subcategory.includes('vocal')) {
      activityType = 'Music';
      if (subcategory.includes('piano')) {
        activitySubtype = 'Piano';
      } else if (subcategory.includes('guitar')) {
        activitySubtype = 'Guitar';
      } else if (subcategory.includes('violin')) {
        activitySubtype = 'Violin';
      } else if (subcategory.includes('vocal') || subcategory.includes('voice')) {
        activitySubtype = 'Voice';
      } else {
        activitySubtype = 'General Music';
      }
      return { activityType, activitySubtype };
    }
    
    // Cooking
    if (subcategory.includes('cook') || subcategory.includes('culinary') || subcategory.includes('bak')) {
      activityType = 'Culinary Arts';
      activitySubtype = subcategory.includes('bak') ? 'Baking' : 'Cooking';
      return { activityType, activitySubtype };
    }
    
    // Yoga/Fitness
    if (subcategory.includes('yoga')) {
      activityType = 'Fitness & Wellness';
      activitySubtype = 'Yoga';
      return { activityType, activitySubtype };
    }
    
    if (subcategory.includes('fitness')) {
      activityType = 'Fitness & Wellness';
      activitySubtype = 'General Fitness';
      return { activityType, activitySubtype };
    }
    
    // Gymnastics
    if (subcategory.includes('gymnastic') || subcategory.includes('tumbl')) {
      activityType = 'Gymnastics & Movement';
      activitySubtype = subcategory.includes('tumbl') ? 'Tumbling' : 'Gymnastics';
      return { activityType, activitySubtype };
    }
    
    // Preschool/Early Learning
    if (subcategory.includes('preschool')) {
      activityType = 'Early Development';
      activitySubtype = 'Preschool Programs';
      return { activityType, activitySubtype };
    }
  }
  
  // Priority 3: Check name field for activities
  // Swimming (check name if not caught by subcategory)
  if (name.includes('swim') || name.includes('aqua') || name.includes('water') && name.includes('safety')) {
    activityType = 'Swimming & Aquatics';
    if (name.includes('adapted')) {
      activitySubtype = 'Adapted Swimming';
    } else if (name.includes('parent') && name.includes('tot')) {
      activitySubtype = 'Parent & Tot Swimming';
    } else if (name.includes('lifeguard')) {
      activitySubtype = 'Lifeguarding';
    } else if (name.includes('aquatic leadership')) {
      activitySubtype = 'Aquatic Leadership';
    } else if (name.includes('aqua fitness') || name.includes('aquafit')) {
      activitySubtype = 'Aqua Fitness';
    } else {
      activitySubtype = 'Learn to Swim';
    }
    return { activityType, activitySubtype };
  }
  
  // Basketball
  if (name.includes('basketball')) {
    activityType = 'Team Sports';
    activitySubtype = 'Basketball';
    return { activityType, activitySubtype };
  }
  
  // Soccer
  if (name.includes('soccer') || (name.includes('football') && !name.includes('flag'))) {
    activityType = 'Team Sports';
    activitySubtype = 'Soccer';
    return { activityType, activitySubtype };
  }
  
  // Volleyball
  if (name.includes('volleyball')) {
    activityType = 'Team Sports';
    activitySubtype = 'Volleyball';
    return { activityType, activitySubtype };
  }
  
  // Baseball
  if (name.includes('baseball') || name.includes('t-ball')) {
    activityType = 'Team Sports';
    activitySubtype = 'Baseball';
    return { activityType, activitySubtype };
  }
  
  // Hockey
  if (name.includes('hockey')) {
    activityType = 'Team Sports';
    activitySubtype = name.includes('field') ? 'Field Hockey' : 'Hockey';
    return { activityType, activitySubtype };
  }
  
  // Tennis
  if (name.includes('tennis')) {
    activityType = 'Racquet Sports';
    activitySubtype = 'Tennis';
    return { activityType, activitySubtype };
  }
  
  // Badminton
  if (name.includes('badminton')) {
    activityType = 'Racquet Sports';
    activitySubtype = 'Badminton';
    return { activityType, activitySubtype };
  }
  
  // Martial Arts
  if (name.includes('karate')) {
    activityType = 'Martial Arts';
    activitySubtype = 'Karate';
    return { activityType, activitySubtype };
  }
  
  if (name.includes('taekwondo') || name.includes('tae kwon do')) {
    activityType = 'Martial Arts';
    activitySubtype = 'Taekwondo';
    return { activityType, activitySubtype };
  }
  
  if (name.includes('martial arts')) {
    activityType = 'Martial Arts';
    activitySubtype = 'Mixed Martial Arts';
    return { activityType, activitySubtype };
  }
  
  // Dance
  if (name.includes('ballet')) {
    activityType = 'Dance';
    activitySubtype = 'Ballet';
    return { activityType, activitySubtype };
  }
  
  if (name.includes('hip hop') || name.includes('hip-hop')) {
    activityType = 'Dance';
    activitySubtype = 'Hip Hop';
    return { activityType, activitySubtype };
  }
  
  if (name.includes('dance')) {
    activityType = 'Dance';
    activitySubtype = 'General Dance';
    return { activityType, activitySubtype };
  }
  
  // Skating
  if (name.includes('skating') || name.includes('skate')) {
    activityType = 'Skating & Wheels';
    if (name.includes('figure')) {
      activitySubtype = 'Figure Skating';
    } else if (name.includes('hockey')) {
      activitySubtype = 'Hockey Skating';
    } else {
      activitySubtype = 'Ice Skating';
    }
    return { activityType, activitySubtype };
  }
  
  // Gymnastics
  if (name.includes('gymnast') || name.includes('tumbl')) {
    activityType = 'Gymnastics & Movement';
    activitySubtype = name.includes('tumbl') ? 'Tumbling' : 'Gymnastics';
    return { activityType, activitySubtype };
  }
  
  // Visual Arts
  if (name.includes('paint') || name.includes('draw') || (name.includes('art') && !name.includes('martial'))) {
    activityType = 'Visual Arts';
    if (name.includes('paint')) {
      activitySubtype = 'Painting';
    } else if (name.includes('draw')) {
      activitySubtype = 'Drawing';
    } else if (name.includes('pottery') || name.includes('ceramic')) {
      activitySubtype = 'Pottery';
    } else if (name.includes('craft')) {
      activitySubtype = 'Crafts';
    } else {
      activitySubtype = 'General Art';
    }
    return { activityType, activitySubtype };
  }
  
  // Music
  if (name.includes('piano')) {
    activityType = 'Music';
    activitySubtype = 'Piano';
    return { activityType, activitySubtype };
  }
  
  if (name.includes('guitar')) {
    activityType = 'Music';
    activitySubtype = 'Guitar';
    return { activityType, activitySubtype };
  }
  
  if (name.includes('violin') || name.includes('vocal') || name.includes('voice')) {
    activityType = 'Music';
    activitySubtype = name.includes('violin') ? 'Violin' : 'Voice';
    return { activityType, activitySubtype };
  }
  
  if (name.includes('music')) {
    activityType = 'Music';
    activitySubtype = 'General Music';
    return { activityType, activitySubtype };
  }
  
  // Cooking
  if (name.includes('cook') || name.includes('chef') || name.includes('kitchen')) {
    activityType = 'Culinary Arts';
    activitySubtype = 'Cooking';
    return { activityType, activitySubtype };
  }
  
  if (name.includes('baking')) {
    activityType = 'Culinary Arts';
    activitySubtype = 'Baking';
    return { activityType, activitySubtype };
  }
  
  // Yoga/Fitness
  if (name.includes('yoga')) {
    activityType = 'Fitness & Wellness';
    activitySubtype = 'Yoga';
    return { activityType, activitySubtype };
  }
  
  if (name.includes('fitness')) {
    activityType = 'Fitness & Wellness';
    activitySubtype = 'General Fitness';
    return { activityType, activitySubtype };
  }
  
  // STEM
  if (name.includes('science') || name.includes('stem') || name.includes('robot') || name.includes('coding')) {
    activityType = 'STEM & Education';
    if (name.includes('robot')) {
      activitySubtype = 'Robotics';
    } else if (name.includes('coding') || name.includes('programming')) {
      activitySubtype = 'Coding';
    } else {
      activitySubtype = 'Science';
    }
    return { activityType, activitySubtype };
  }
  
  // Multi-sport
  if (name.includes('multi sport') || name.includes('multi-sport') || name.includes('sports sampler')) {
    activityType = 'Multi-Sport';
    activitySubtype = 'Sports Sampler';
    return { activityType, activitySubtype };
  }
  
  // Outdoor
  if (name.includes('outdoor') || name.includes('nature') || name.includes('hiking')) {
    activityType = 'Outdoor & Adventure';
    activitySubtype = name.includes('hiking') ? 'Hiking' : 'Outdoor Adventure';
    return { activityType, activitySubtype };
  }
  
  // Golf
  if (name.includes('golf')) {
    activityType = 'Individual Sports';
    activitySubtype = 'Golf';
    return { activityType, activitySubtype };
  }
  
  // Track/Running
  if (name.includes('track') || name.includes('running')) {
    activityType = 'Individual Sports';
    activitySubtype = 'Track & Field';
    return { activityType, activitySubtype };
  }
  
  // Climbing
  if (name.includes('climbing') || name.includes('climb')) {
    activityType = 'Individual Sports';
    activitySubtype = 'Rock Climbing';
    return { activityType, activitySubtype };
  }
  
  // Drama/Theatre
  if (name.includes('drama') || name.includes('theatre') || name.includes('theater')) {
    activityType = 'Performing Arts';
    activitySubtype = name.includes('musical') ? 'Musical Theatre' : 'Drama';
    return { activityType, activitySubtype };
  }
  
  // Parent & Tot / Early Development
  if (name.includes('parent') && (name.includes('tot') || name.includes('baby'))) {
    activityType = 'Early Development';
    activitySubtype = 'Parent & Tot';
    return { activityType, activitySubtype };
  }
  
  if (name.includes('preschool')) {
    activityType = 'Early Development';
    activitySubtype = 'Preschool Programs';
    return { activityType, activitySubtype };
  }
  
  // Leadership/Life Skills
  if (name.includes('babysitt') || name.includes('first aid') || name.includes('leadership')) {
    activityType = 'Life Skills & Leadership';
    if (name.includes('babysitt')) {
      activitySubtype = 'Babysitting';
    } else if (name.includes('first aid')) {
      activitySubtype = 'First Aid';
    } else {
      activitySubtype = 'Leadership';
    }
    return { activityType, activitySubtype };
  }
  
  // Special needs
  if (name.includes('adapted') || name.includes('special needs')) {
    activityType = 'Special Needs Programs';
    activitySubtype = 'Adapted Programs';
    return { activityType, activitySubtype };
  }
  
  // Default to Other if nothing matched
  activityType = 'Other';
  activitySubtype = 'General Programs';
  
  return { activityType, activitySubtype };
}

/**
 * Determine age-based categories for an activity
 */
function determineCategories(activity) {
  const categories = [];
  const ageMin = activity.ageMin || 0;
  const ageMax = activity.ageMax || 18;
  const requiresParent = activity.requiresParent || false;
  
  // Baby and Parent (0-1)
  if (ageMin <= 1 && requiresParent) {
    categories.push('baby-and-parent');
  }
  
  // Early Years with Parent (0-6)
  if (ageMin <= 6 && requiresParent) {
    categories.push('early-years-with-parent');
  }
  
  // Early Years Solo (0-6)
  if (ageMin <= 6 && !requiresParent) {
    categories.push('early-years-solo');
  }
  
  // School Age (5-13)
  if ((ageMin <= 13 && ageMax >= 5) || (ageMin >= 5 && ageMin <= 13)) {
    categories.push('school-age');
  }
  
  // Youth (10-18)
  if ((ageMin <= 18 && ageMax >= 10) || (ageMin >= 10 && ageMin <= 18)) {
    categories.push('youth');
  }
  
  // If no categories matched, assign based on age range
  if (categories.length === 0) {
    if (ageMax <= 6) {
      categories.push(requiresParent ? 'early-years-with-parent' : 'early-years-solo');
    } else if (ageMin >= 10) {
      categories.push('youth');
    } else {
      categories.push('school-age');
    }
  }
  
  return categories;
}

async function migrateAllActivities() {
  console.log('Starting comprehensive activity migration V2...\n');
  
  try {
    // Get all activities
    const activities = await prisma.activity.findMany({
      where: { isActive: true }
    });
    
    console.log(`Found ${activities.length} active activities to migrate\n`);
    
    const stats = {
      total: activities.length,
      updated: 0,
      byType: {},
      bySubtype: {},
      byCategory: {}
    };
    
    // Process in batches to avoid overwhelming the database
    const batchSize = 100;
    for (let i = 0; i < activities.length; i += batchSize) {
      const batch = activities.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (activity) => {
        // Map activity type and subtype
        const mapping = mapActivityComprehensive(activity);
        
        // Determine categories
        const categoryCodes = determineCategories(activity);
        
        // Update activity
        await prisma.activity.update({
          where: { id: activity.id },
          data: {
            activityType: mapping.activityType,
            activitySubtype: mapping.activitySubtype
          }
        });
        
        // Update categories
        const categories = await prisma.category.findMany({
          where: { code: { in: categoryCodes } }
        });
        
        // Clear existing category assignments
        await prisma.activityCategory.deleteMany({
          where: { activityId: activity.id }
        });
        
        // Create new category assignments
        for (let j = 0; j < categories.length; j++) {
          await prisma.activityCategory.create({
            data: {
              activityId: activity.id,
              categoryId: categories[j].id,
              isPrimary: j === 0,
              confidence: 0.95,
              source: 'comprehensive-mapper-v2'
            }
          });
        }
        
        // Update statistics
        stats.updated++;
        stats.byType[mapping.activityType] = (stats.byType[mapping.activityType] || 0) + 1;
        stats.bySubtype[mapping.activitySubtype] = (stats.bySubtype[mapping.activitySubtype] || 0) + 1;
        categoryCodes.forEach(cat => {
          stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
        });
      }));
      
      console.log(`Processed ${Math.min(i + batchSize, activities.length)}/${activities.length} activities...`);
    }
    
    // Print final statistics
    console.log('\n=== Migration Complete ===\n');
    console.log(`Total activities processed: ${stats.total}`);
    console.log(`Activities updated: ${stats.updated}`);
    
    console.log('\nActivities by Type:');
    Object.entries(stats.byType)
      .sort(([,a], [,b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    
    console.log('\nTop Activity Subtypes:');
    Object.entries(stats.bySubtype)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .forEach(([subtype, count]) => {
        console.log(`  ${subtype}: ${count}`);
      });
    
    console.log('\nActivities by Category:');
    Object.entries(stats.byCategory)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`  ${category}: ${count}`);
      });
    
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Export functions for use in scraper
module.exports = {
  mapActivityComprehensive,
  determineCategories
};

// Run migration if called directly
if (require.main === module) {
  migrateAllActivities();
}