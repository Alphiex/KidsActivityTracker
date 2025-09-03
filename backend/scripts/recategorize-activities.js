const { PrismaClient } = require('../generated/prisma');
const { LEGACY_TO_ACTIVITY_TYPE_MAPPING } = require('../src/constants/activityTypes');

const prisma = new PrismaClient();

/**
 * Comprehensive activity recategorization script
 * - Links activities to proper ActivityType and ActivitySubtype based on category/subcategory
 * - Assigns activities to age-based Categories based on age ranges
 * - Uses existing constants and mappings for consistency
 */

// Enhanced mapping for better categorization
const ENHANCED_ACTIVITY_TYPE_MAPPING = {
  // Swimming & Aquatics
  'Swimming': 'swimming-aquatics',
  'Swimming Lessons': 'swimming-aquatics',
  'Swimming & Aquatics': 'swimming-aquatics',
  'Aquatic Leadership': 'swimming-aquatics',
  'Water Safety': 'swimming-aquatics',
  'Pool': 'swimming-aquatics',
  'Aqua': 'swimming-aquatics',
  'Swim': 'swimming-aquatics',
  
  // Team Sports
  'Sports - Team': 'team-sports',
  'Team Sports': 'team-sports',
  'Basketball': 'team-sports',
  'Soccer': 'team-sports',
  'Football': 'team-sports',
  'Baseball': 'team-sports',
  'Volleyball': 'team-sports',
  'Hockey': 'team-sports',
  'Lacrosse': 'team-sports',
  
  // Individual Sports
  'Sports - Individual': 'individual-sports',
  'Individual Sports': 'individual-sports',
  'Track': 'individual-sports',
  'Field': 'individual-sports',
  'Athletics': 'individual-sports',
  'Running': 'individual-sports',
  'Cycling': 'individual-sports',
  
  // Racquet Sports
  'Tennis': 'racquet-sports',
  'Badminton': 'racquet-sports',
  'Squash': 'racquet-sports',
  'Pickleball': 'racquet-sports',
  'Racquet': 'racquet-sports',
  
  // Martial Arts
  'Martial Arts': 'martial-arts',
  'Karate': 'martial-arts',
  'Taekwondo': 'martial-arts',
  'Judo': 'martial-arts',
  'Kung Fu': 'martial-arts',
  'Boxing': 'martial-arts',
  'Kickboxing': 'martial-arts',
  'Self Defense': 'martial-arts',
  
  // Dance
  'Dance': 'dance',
  'Ballet': 'dance',
  'Jazz Dance': 'dance',
  'Hip Hop': 'dance',
  'Tap Dance': 'dance',
  'Contemporary': 'dance',
  'Ballroom': 'dance',
  
  // Visual Arts
  'Arts': 'visual-arts',
  'Arts - Visual': 'visual-arts',
  'Arts & Crafts': 'visual-arts',
  'Visual Arts': 'visual-arts',
  'Painting': 'visual-arts',
  'Drawing': 'visual-arts',
  'Pottery': 'visual-arts',
  'Sculpture': 'visual-arts',
  'Crafts': 'visual-arts',
  
  // Music
  'Arts - Music': 'music',
  'Music': 'music',
  'Piano': 'music',
  'Guitar': 'music',
  'Singing': 'music',
  'Drums': 'music',
  'Violin': 'music',
  'Band': 'music',
  'Orchestra': 'music',
  
  // Performing Arts
  'Arts - Performing': 'performing-arts',
  'Performing Arts': 'performing-arts',
  'Drama': 'performing-arts',
  'Theatre': 'performing-arts',
  'Theater': 'performing-arts',
  'Musical Theatre': 'performing-arts',
  'Improv': 'performing-arts',
  
  // Camps
  'Day Camps': 'camps',
  'Summer Camp': 'camps',
  'Camps': 'camps',
  'Camp': 'camps',
  'School Programs': 'camps',
  
  // STEM & Education
  'STEM': 'stem-education',
  'Science': 'stem-education',
  'Academic': 'stem-education',
  'Educational': 'stem-education',
  'Technology': 'stem-education',
  'Engineering': 'stem-education',
  'Math': 'stem-education',
  'Programming': 'stem-education',
  
  // Fitness & Wellness
  'Fitness': 'fitness-wellness',
  'Yoga': 'fitness-wellness',
  'Wellness': 'fitness-wellness',
  'Exercise': 'fitness-wellness',
  
  // Outdoor & Adventure
  'Outdoor': 'outdoor-adventure',
  'Adventure': 'outdoor-adventure',
  'Nature': 'outdoor-adventure',
  'Hiking': 'outdoor-adventure',
  'Camping': 'outdoor-adventure',
  
  // Other categories
  'Cooking': 'culinary-arts',
  'Languages': 'language-culture',
  'Language': 'language-culture',
  'Special Needs': 'special-needs-programs',
  'Leadership': 'life-skills-leadership',
  'Skating': 'skating-wheels',
  'Gymnastics': 'gymnastics-movement'
};

// Subtype mapping based on activity names and categories
const SUBTYPE_MAPPING = {
  // Swimming & Aquatics subtypes
  'swimming-lessons': ['Lesson', 'Learn', 'Beginner', 'Intermediate', 'Advanced', 'Level'],
  'parent-child': ['Parent', 'Family', 'Parent & Child', 'Parent and Child'],
  'competitive': ['Competitive', 'Competition', 'Team', 'Club'],
  'aqua-fitness': ['Aqua Fit', 'Water Aerobics', 'Aqua Fitness'],
  'water-safety': ['Safety', 'Lifeguard', 'First Aid'],
  'adapted': ['Adaptive', 'Special Needs', 'Therapeutic'],
  
  // Racquet Sports subtypes
  'tennis': ['Tennis'],
  'badminton': ['Badminton'],
  'squash': ['Squash'],
  'pickleball': ['Pickleball'],
  
  // Team Sports subtypes
  'soccer': ['Soccer', 'Football'],
  'basketball': ['Basketball'],
  'volleyball': ['Volleyball'],
  'baseball': ['Baseball', 'Softball'],
  'hockey': ['Hockey'],
  'lacrosse': ['Lacrosse'],
  
  // Martial Arts subtypes
  'karate': ['Karate'],
  'taekwondo': ['Taekwondo', 'Tae Kwon Do'],
  'judo': ['Judo'],
  'kung-fu': ['Kung Fu', 'Kung-Fu'],
  'jiu-jitsu': ['Jiu-Jitsu', 'Jujitsu', 'Brazilian Jiu'],
  'boxing': ['Boxing'],
  'kickboxing': ['Kickboxing'],
  'self-defense': ['Self Defense', 'Self Defence'],
  
  // Dance subtypes
  'ballet': ['Ballet'],
  'jazz': ['Jazz'],
  'hip-hop': ['Hip Hop', 'Hip-Hop'],
  'tap': ['Tap'],
  'contemporary': ['Contemporary', 'Modern'],
  'ballroom': ['Ballroom', 'Social']
};

async function getActivityTypeMapping() {
  console.log('📋 Loading activity types and subtypes...');
  
  const activityTypes = await prisma.activityType.findMany();
  const activitySubtypes = await prisma.activitySubtype.findMany();
  const categories = await prisma.category.findMany();
  
  const typeMap = {};
  const subtypeMap = {};
  const categoryMap = {};
  
  activityTypes.forEach(type => {
    typeMap[type.code] = type;
    typeMap[type.name] = type;
  });
  
  activitySubtypes.forEach(subtype => {
    subtypeMap[subtype.code] = subtype;
    subtypeMap[subtype.name] = subtype;
  });
  
  categories.forEach(category => {
    categoryMap[category.name] = category;
  });
  
  return { typeMap, subtypeMap, categoryMap };
}

function findBestActivityType(activity, typeMap) {
  const searchText = `${activity.name} ${activity.category || ''} ${activity.subcategory || ''}`.toLowerCase();
  
  // Try exact matches first
  for (const [key, typeCode] of Object.entries(ENHANCED_ACTIVITY_TYPE_MAPPING)) {
    if (searchText.includes(key.toLowerCase())) {
      const type = typeMap[typeCode];
      if (type) {
        console.log(`✅ Found type for "${activity.name}": ${type.name} (matched: ${key})`);
        return type;
      }
    }
  }
  
  // Fallback to legacy mapping
  if (activity.category && LEGACY_TO_ACTIVITY_TYPE_MAPPING[activity.category]) {
    const mappedType = LEGACY_TO_ACTIVITY_TYPE_MAPPING[activity.category];
    const type = typeMap[mappedType];
    if (type) {
      console.log(`✅ Found type for "${activity.name}": ${type.name} (legacy mapping)`);
      return type;
    }
  }
  
  console.log(`⚠️  No type found for "${activity.name}" (category: ${activity.category})`);
  return typeMap['other-activity']; // Default to "Other Activity"
}

function findBestActivitySubtype(activity, activityType, subtypeMap) {
  const searchText = `${activity.name} ${activity.subcategory || ''}`.toLowerCase();
  
  // Find subtypes for this activity type
  const typeSubtypes = Object.values(subtypeMap).filter(s => s.activityTypeId === activityType.id);
  
  // Try to match based on subtype keywords
  for (const [subtypeCode, keywords] of Object.entries(SUBTYPE_MAPPING)) {
    const subtype = subtypeMap[subtypeCode];
    if (subtype && subtype.activityTypeId === activityType.id) {
      for (const keyword of keywords) {
        if (searchText.includes(keyword.toLowerCase())) {
          console.log(`✅ Found subtype for "${activity.name}": ${subtype.name} (matched: ${keyword})`);
          return subtype;
        }
      }
    }
  }
  
  // If no specific subtype found, use "General" if available
  const generalSubtype = typeSubtypes.find(s => s.code === 'general' || s.name.toLowerCase().includes('general'));
  if (generalSubtype) {
    return generalSubtype;
  }
  
  console.log(`⚠️  No subtype found for "${activity.name}" under ${activityType.name}`);
  return null;
}

function determineCategories(activity, categoryMap) {
  const categories = [];
  const ageMin = activity.ageMin || 0;
  const ageMax = activity.ageMax || 100;
  
  // Early Years: Parent Participation (0-5 years, requires parent)
  const parentParticipation = categoryMap['Early Years: Parent Participation'];
  if (parentParticipation && ageMin <= 5 && (
    activity.name.toLowerCase().includes('parent') ||
    activity.description?.toLowerCase().includes('parent') ||
    activity.category?.toLowerCase().includes('parent')
  )) {
    categories.push(parentParticipation);
  }
  
  // Early Years: On My Own (0-5 years, independent)
  const earlyYearsIndependent = categoryMap['Early Years: On My Own'];
  if (earlyYearsIndependent && ageMin <= 5 && ageMax >= 0 && !categories.includes(parentParticipation)) {
    categories.push(earlyYearsIndependent);
  }
  
  // School Age (5-13 years)
  const schoolAge = categoryMap['School Age'];
  if (schoolAge && ageMin <= 13 && ageMax >= 5) {
    categories.push(schoolAge);
  }
  
  // Youth (10-18 years)
  const youth = categoryMap['Youth'];
  if (youth && ageMin <= 18 && ageMax >= 10) {
    categories.push(youth);
  }
  
  // All Ages & Family (wide age range or family activities)
  const allAgesFamily = categoryMap['All Ages & Family'];
  if (allAgesFamily && (
    (ageMax - ageMin) >= 10 || // Wide age range
    activity.name.toLowerCase().includes('family') ||
    activity.name.toLowerCase().includes('all ages') ||
    ageMin <= 6 && ageMax >= 16
  )) {
    categories.push(allAgesFamily);
  }
  
  // If no categories matched, try to assign based on age range
  if (categories.length === 0) {
    if (ageMax <= 5) {
      categories.push(earlyYearsIndependent);
    } else if (ageMin >= 5 && ageMax <= 13) {
      categories.push(schoolAge);
    } else if (ageMin >= 10) {
      categories.push(youth);
    } else {
      categories.push(allAgesFamily);
    }
  }
  
  return categories;
}

async function recategorizeActivities() {
  console.log('🔄 Starting activity recategorization...');
  
  try {
    const { typeMap, subtypeMap, categoryMap } = await getActivityTypeMapping();
    
    // Get all activities that need recategorization
    const activities = await prisma.activity.findMany({
      where: {
        isUpdated: true // Only process active activities
      },
      select: {
        id: true,
        name: true,
        category: true,
        subcategory: true,
        description: true,
        ageMin: true,
        ageMax: true,
        activityTypeId: true,
        activitySubtypeId: true
      }
    });
    
    console.log(`📊 Found ${activities.length} activities to process`);
    
    let processedCount = 0;
    let typeUpdates = 0;
    let subtypeUpdates = 0;
    let categoryAssignments = 0;
    
    for (const activity of activities) {
      console.log(`\n🔍 Processing: ${activity.name}`);
      
      // Determine activity type
      let activityType = null;
      if (!activity.activityTypeId) {
        activityType = findBestActivityType(activity, typeMap);
        if (activityType) {
          await prisma.activity.update({
            where: { id: activity.id },
            data: { activityTypeId: activityType.id }
          });
          typeUpdates++;
        }
      } else {
        activityType = Object.values(typeMap).find(t => t.id === activity.activityTypeId);
      }
      
      // Determine activity subtype
      if (activityType && !activity.activitySubtypeId) {
        const subtype = findBestActivitySubtype(activity, activityType, subtypeMap);
        if (subtype) {
          await prisma.activity.update({
            where: { id: activity.id },
            data: { activitySubtypeId: subtype.id }
          });
          subtypeUpdates++;
        }
      }
      
      // Assign categories
      const applicableCategories = determineCategories(activity, categoryMap);
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
          categoryAssignments++;
          console.log(`   📂 Assigned to category: ${category.name}`);
        } catch (error) {
          // Ignore duplicate errors
          if (!error.message.includes('unique constraint')) {
            console.error(`   ❌ Error assigning category ${category.name}:`, error.message);
          }
        }
      }
      
      processedCount++;
      if (processedCount % 50 === 0) {
        console.log(`📈 Progress: ${processedCount}/${activities.length} activities processed`);
      }
    }
    
    console.log('\n🎉 Recategorization completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Activities processed: ${processedCount}`);
    console.log(`   - Activity types assigned: ${typeUpdates}`);
    console.log(`   - Activity subtypes assigned: ${subtypeUpdates}`);
    console.log(`   - Category assignments created: ${categoryAssignments}`);
    
    // Show final statistics
    const stats = await Promise.all([
      prisma.activity.count({ where: { activityTypeId: { not: null } } }),
      prisma.activity.count({ where: { activitySubtypeId: { not: null } } }),
      prisma.activityCategory.count()
    ]);
    
    console.log(`\n📈 Final Statistics:`);
    console.log(`   - Activities with types: ${stats[0]}`);
    console.log(`   - Activities with subtypes: ${stats[1]}`);
    console.log(`   - Total category assignments: ${stats[2]}`);
    
    // Show category breakdown
    console.log(`\n📂 Category Breakdown:`);
    for (const category of Object.values(categoryMap)) {
      const count = await prisma.activityCategory.count({
        where: { categoryId: category.id }
      });
      console.log(`   - ${category.name}: ${count} activities`);
    }
    
  } catch (error) {
    console.error('❌ Error during recategorization:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Activity Recategorization Script');
  console.log('===================================\n');
  
  await recategorizeActivities();
  
  console.log('\n✅ Script completed successfully!');
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('🎯 Recategorization finished!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}

module.exports = { recategorizeActivities };