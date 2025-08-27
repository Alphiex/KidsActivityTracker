const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

// Load mapping configuration
const mappingConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'activity-name-mapping.json'), 'utf-8')
);

// Load master activity types
const masterList = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'ACTIVITY_TYPES_MASTER_LIST.json'), 'utf-8')
);

/**
 * Comprehensive activity mapping function
 * This analyzes activity name, description, category, and subcategory to determine:
 * 1. Activity Type (e.g., Swimming & Aquatics, Team Sports)
 * 2. Activity Subtype (e.g., Basketball, Learn to Swim)
 * 3. Categories (age-based: School Age, Youth, Early Years, etc.)
 */
function mapActivityComprehensive(activity) {
  const searchText = `${activity.name || ''} ${activity.description || ''} ${activity.subcategory || ''} ${activity.category || ''}`.toLowerCase();
  
  let activityType = null;
  let activitySubtype = null;
  
  // Step 1: Check for camps FIRST (highest priority - camps often have other activities in the name)
  if ((searchText.includes('camp') && !searchText.includes('champion')) || 
      searchText.includes('day camp') || searchText.includes('full day') || 
      searchText.includes('part day')) {
    activityType = 'Camps';
    if (searchText.includes('day camp') || searchText.includes('full day')) {
      activitySubtype = 'Day Camp';
    } else if (searchText.includes('part day')) {
      activitySubtype = 'Part Day Camp';
    } else if (searchText.includes('summer')) {
      activitySubtype = 'Summer Camp';
    } else if (searchText.includes('sport')) {
      activitySubtype = 'Sports Camp';
    } else {
      activitySubtype = 'General Camp';
    }
  }
  
  // Step 2: Check for swimming/aquatic activities (if not a camp)
  else if (!activityType) {
    const swimKeywords = ['swim', 'aqua', 'water', 'pool', 'diving', 'lifeguard', 'aquatic'];
    if (swimKeywords.some(keyword => searchText.includes(keyword))) {
      activityType = 'Swimming & Aquatics';
      
      // Determine specific swimming subtype
      if (searchText.includes('learn to swim') || searchText.includes('swim lessons') || 
          searchText.includes('swimmer') && searchText.match(/swimmer\s*\d/)) {
        activitySubtype = 'Learn to Swim';
      } else if (searchText.includes('parent') && searchText.includes('tot')) {
        activitySubtype = 'Parent & Tot Swimming';
      } else if (searchText.includes('competitive') || searchText.includes('swim team')) {
        activitySubtype = 'Competitive Swimming';
      } else if (searchText.includes('lifeguard')) {
        activitySubtype = 'Lifeguarding';
      } else if (searchText.includes('aquatic leadership')) {
        activitySubtype = 'Aquatic Leadership';
      } else if (searchText.includes('aqua fitness') || searchText.includes('aquafit')) {
        activitySubtype = 'Aqua Fitness';
      } else if (searchText.includes('diving')) {
        activitySubtype = 'Diving';
      } else if (searchText.includes('water polo')) {
        activitySubtype = 'Water Polo';
      } else if (searchText.includes('adapted')) {
        activitySubtype = 'Adapted Swimming';
      } else {
        activitySubtype = 'Learn to Swim'; // Default swimming subtype
      }
    }
  }
  
  // Step 2: Check for team sports
  else if (searchText.includes('basketball')) {
    activityType = 'Team Sports';
    activitySubtype = 'Basketball';
  } else if (searchText.includes('soccer') || searchText.includes('football') && !searchText.includes('flag')) {
    activityType = 'Team Sports';
    activitySubtype = 'Soccer';
  } else if (searchText.includes('volleyball')) {
    activityType = 'Team Sports';
    activitySubtype = 'Volleyball';
  } else if (searchText.includes('baseball') || searchText.includes('t-ball')) {
    activityType = 'Team Sports';
    activitySubtype = 'Baseball';
  } else if (searchText.includes('hockey') && !searchText.includes('field')) {
    activityType = 'Team Sports';
    activitySubtype = 'Hockey';
  } else if (searchText.includes('field hockey')) {
    activityType = 'Team Sports';
    activitySubtype = 'Field Hockey';
  } else if (searchText.includes('lacrosse')) {
    activityType = 'Team Sports';
    activitySubtype = 'Lacrosse';
  } else if (searchText.includes('rugby')) {
    activityType = 'Team Sports';
    activitySubtype = 'Rugby';
  } else if (searchText.includes('cricket')) {
    activityType = 'Team Sports';
    activitySubtype = 'Cricket';
  } else if (searchText.includes('flag football')) {
    activityType = 'Team Sports';
    activitySubtype = 'Flag Football';
  }
  
  // Step 3: Check for racquet sports
  else if (searchText.includes('tennis')) {
    activityType = 'Racquet Sports';
    activitySubtype = 'Tennis';
  } else if (searchText.includes('badminton')) {
    activityType = 'Racquet Sports';
    activitySubtype = 'Badminton';
  } else if (searchText.includes('squash')) {
    activityType = 'Racquet Sports';
    activitySubtype = 'Squash';
  } else if (searchText.includes('pickleball')) {
    activityType = 'Racquet Sports';
    activitySubtype = 'Pickleball';
  } else if (searchText.includes('table tennis') || searchText.includes('ping pong')) {
    activityType = 'Racquet Sports';
    activitySubtype = 'Table Tennis';
  }
  
  // Step 4: Check for martial arts
  else if (searchText.includes('karate')) {
    activityType = 'Martial Arts';
    activitySubtype = 'Karate';
  } else if (searchText.includes('taekwondo') || searchText.includes('tae kwon do')) {
    activityType = 'Martial Arts';
    activitySubtype = 'Taekwondo';
  } else if (searchText.includes('judo')) {
    activityType = 'Martial Arts';
    activitySubtype = 'Judo';
  } else if (searchText.includes('boxing') || searchText.includes('kickbox')) {
    activityType = 'Martial Arts';
    activitySubtype = searchText.includes('kick') ? 'Kickboxing' : 'Boxing';
  } else if (searchText.includes('jiu-jitsu') || searchText.includes('jiu jitsu')) {
    activityType = 'Martial Arts';
    activitySubtype = 'Brazilian Jiu-Jitsu';
  } else if (searchText.includes('kung fu')) {
    activityType = 'Martial Arts';
    activitySubtype = 'Kung Fu';
  } else if (searchText.includes('martial arts')) {
    activityType = 'Martial Arts';
    activitySubtype = 'Mixed Martial Arts';
  }
  
  // Step 5: Check for dance
  else if (searchText.includes('ballet')) {
    activityType = 'Dance';
    activitySubtype = 'Ballet';
  } else if (searchText.includes('hip hop') || searchText.includes('hip-hop')) {
    activityType = 'Dance';
    activitySubtype = 'Hip Hop';
  } else if (searchText.includes('jazz') && searchText.includes('dance')) {
    activityType = 'Dance';
    activitySubtype = 'Jazz Dance';
  } else if (searchText.includes('tap') && searchText.includes('dance')) {
    activityType = 'Dance';
    activitySubtype = 'Tap Dance';
  } else if (searchText.includes('contemporary') && searchText.includes('dance')) {
    activityType = 'Dance';
    activitySubtype = 'Contemporary';
  } else if (searchText.includes('dance')) {
    activityType = 'Dance';
    activitySubtype = 'General Dance';
  }
  
  // Step 6: Check for skating
  else if (searchText.includes('skating') || searchText.includes('skate')) {
    activityType = 'Skating & Wheels';
    if (searchText.includes('figure')) {
      activitySubtype = 'Figure Skating';
    } else if (searchText.includes('hockey')) {
      activitySubtype = 'Hockey Skating';
    } else if (searchText.includes('speed')) {
      activitySubtype = 'Speed Skating';
    } else if (searchText.includes('roller')) {
      activitySubtype = 'Roller Skating';
    } else if (searchText.includes('inline')) {
      activitySubtype = 'Inline Skating';
    } else {
      activitySubtype = 'Ice Skating';
    }
  } else if (searchText.includes('skateboard')) {
    activityType = 'Skating & Wheels';
    activitySubtype = 'Skateboarding';
  } else if (searchText.includes('scooter')) {
    activityType = 'Skating & Wheels';
    activitySubtype = 'Scooter';
  }
  
  // Step 7: Check for gymnastics
  else if (searchText.includes('gymnast') || searchText.includes('tumbl')) {
    activityType = 'Gymnastics & Movement';
    activitySubtype = searchText.includes('tumbl') ? 'Tumbling' : 'Gymnastics';
  } else if (searchText.includes('parkour')) {
    activityType = 'Gymnastics & Movement';
    activitySubtype = 'Parkour';
  }
  
  // Step 8: Check for visual arts
  else if (searchText.includes('paint') || searchText.includes('draw') || searchText.includes('art') && !searchText.includes('martial')) {
    activityType = 'Visual Arts';
    if (searchText.includes('paint')) {
      activitySubtype = 'Painting';
    } else if (searchText.includes('draw')) {
      activitySubtype = 'Drawing';
    } else if (searchText.includes('pottery') || searchText.includes('ceramic')) {
      activitySubtype = 'Pottery';
    } else if (searchText.includes('craft')) {
      activitySubtype = 'Crafts';
    } else {
      activitySubtype = 'General Art';
    }
  }
  
  // Step 9: Check for music
  else if (searchText.includes('piano')) {
    activityType = 'Music';
    activitySubtype = 'Piano';
  } else if (searchText.includes('guitar')) {
    activityType = 'Music';
    activitySubtype = 'Guitar';
  } else if (searchText.includes('drum')) {
    activityType = 'Music';
    activitySubtype = 'Drums';
  } else if (searchText.includes('violin')) {
    activityType = 'Music';
    activitySubtype = 'Violin';
  } else if (searchText.includes('sing') || searchText.includes('voice') || searchText.includes('vocal')) {
    activityType = 'Music';
    activitySubtype = 'Voice';
  } else if (searchText.includes('band') || searchText.includes('orchestra')) {
    activityType = 'Music';
    activitySubtype = searchText.includes('band') ? 'Band' : 'Orchestra';
  } else if (searchText.includes('music')) {
    activityType = 'Music';
    activitySubtype = 'General Music';
  }
  
  // Step 10: Check for performing arts
  else if (searchText.includes('drama') || searchText.includes('theatre') || searchText.includes('theater')) {
    activityType = 'Performing Arts';
    if (searchText.includes('musical')) {
      activitySubtype = 'Musical Theatre';
    } else {
      activitySubtype = 'Drama';
    }
  } else if (searchText.includes('acting')) {
    activityType = 'Performing Arts';
    activitySubtype = 'Acting';
  }
  
  // Step 11: Check for fitness
  else if (searchText.includes('yoga')) {
    activityType = 'Fitness & Wellness';
    activitySubtype = 'Yoga';
  } else if (searchText.includes('pilates')) {
    activityType = 'Fitness & Wellness';
    activitySubtype = 'Pilates';
  } else if (searchText.includes('fitness') || searchText.includes('workout')) {
    activityType = 'Fitness & Wellness';
    activitySubtype = 'General Fitness';
  } else if (searchText.includes('zumba')) {
    activityType = 'Fitness & Wellness';
    activitySubtype = 'Zumba';
  }
  
  // Step 12: Check for individual sports
  else if (searchText.includes('golf')) {
    activityType = 'Individual Sports';
    activitySubtype = 'Golf';
  } else if (searchText.includes('track') || searchText.includes('running')) {
    activityType = 'Individual Sports';
    activitySubtype = 'Track & Field';
  } else if (searchText.includes('archery')) {
    activityType = 'Individual Sports';
    activitySubtype = 'Archery';
  } else if (searchText.includes('fencing')) {
    activityType = 'Individual Sports';
    activitySubtype = 'Fencing';
  } else if (searchText.includes('climbing')) {
    activityType = 'Individual Sports';
    activitySubtype = 'Rock Climbing';
  }
  
  // Step 13: Check for STEM
  else if (searchText.includes('science') || searchText.includes('stem') || searchText.includes('robot') || searchText.includes('coding')) {
    activityType = 'STEM & Education';
    if (searchText.includes('robot')) {
      activitySubtype = 'Robotics';
    } else if (searchText.includes('coding') || searchText.includes('programming')) {
      activitySubtype = 'Coding';
    } else if (searchText.includes('math')) {
      activitySubtype = 'Mathematics';
    } else {
      activitySubtype = 'Science';
    }
  }
  
  // Step 14: Check for culinary
  else if (searchText.includes('cook') || searchText.includes('baking') || searchText.includes('chef')) {
    activityType = 'Culinary Arts';
    activitySubtype = searchText.includes('bak') ? 'Baking' : 'Cooking';
  }
  
  
  // Step 16: Check for outdoor activities
  else if (searchText.includes('hiking') || searchText.includes('outdoor') || searchText.includes('nature')) {
    activityType = 'Outdoor & Adventure';
    if (searchText.includes('hiking')) {
      activitySubtype = 'Hiking';
    } else if (searchText.includes('nature')) {
      activitySubtype = 'Nature Exploration';
    } else {
      activitySubtype = 'Outdoor Adventure';
    }
  }
  
  // Step 17: Check for multi-sport
  else if (searchText.includes('multi sport') || searchText.includes('multi-sport') || searchText.includes('sports sampler')) {
    activityType = 'Multi-Sport';
    activitySubtype = 'Sports Sampler';
  }
  
  // Step 18: Check for early development
  else if (searchText.includes('parent and tot') || searchText.includes('parent & tot') || 
           searchText.includes('baby') || searchText.includes('toddler')) {
    activityType = 'Early Development';
    activitySubtype = 'Parent & Tot';
  } else if (searchText.includes('preschool') || searchText.includes('pre-school')) {
    activityType = 'Early Development';
    activitySubtype = 'Preschool Programs';
  }
  
  // Step 19: Check for life skills
  else if (searchText.includes('first aid') || searchText.includes('leadership') || searchText.includes('babysitt')) {
    activityType = 'Life Skills & Leadership';
    if (searchText.includes('first aid')) {
      activitySubtype = 'First Aid';
    } else if (searchText.includes('babysitt')) {
      activitySubtype = 'Babysitting';
    } else {
      activitySubtype = 'Leadership';
    }
  }
  
  // Step 20: Check for special needs
  else if (searchText.includes('adapted') || searchText.includes('special needs') || searchText.includes('inclusive')) {
    activityType = 'Special Needs Programs';
    activitySubtype = 'Adapted Programs';
  }
  
  // Step 21: Default to Other if nothing matched
  if (!activityType) {
    activityType = 'Other';
    activitySubtype = 'General Programs';
  }
  
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
  console.log('Starting comprehensive activity migration...\n');
  
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
              source: 'comprehensive-mapper'
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