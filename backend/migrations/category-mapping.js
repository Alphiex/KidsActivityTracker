/**
 * Mapping configuration for migrating current category/subcategory to new structure
 * This file maps existing data to the new activityType/activitySubtype structure
 */

const CATEGORY_MAPPINGS = {
  // Direct category to activity type mappings
  'Swimming': {
    activityType: 'Swimming & Aquatics',
    subtypeMapping: {
      'DEFAULT': 'Learn to Swim',
      // Specific swimming program mappings
      'Swim Tiny Tots': 'Learn to Swim',
      'Swim Parent Participation': 'Learn to Swim',
      'Swimmer': 'Learn to Swim',
      'Swim Adapted Lessons': 'Adapted Swimming',
      'Swim Junior Masters': 'Competitive Swimming',
      'Swim Beginner': 'Learn to Swim',
      'Swim Intermediate': 'Learn to Swim',
      'Swim Advanced': 'Competitive Swimming',
      'Private Lessons Swimming': 'Learn to Swim',
      'Aquatic Leadership': 'Lifeguard Training'
    }
  },
  
  'Team Sports': {
    activityType: 'Team Sports',
    subtypeMapping: {
      'Basketball': 'Basketball',
      'Soccer': 'Soccer',
      'Volleyball': 'Volleyball',
      'Baseball': 'Baseball',
      'Hockey': 'Hockey',
      'DEFAULT': null // Use subcategory as-is
    }
  },
  
  'Racquet Sports': {
    activityType: 'Racquet Sports',
    subtypeMapping: {
      'Tennis': 'Tennis',
      'Badminton': 'Badminton',
      'Squash': 'Squash',
      'Pickleball': 'Pickleball',
      'Table Tennis': 'Table Tennis',
      'DEFAULT': null
    }
  },
  
  'Martial Arts': {
    activityType: 'Martial Arts',
    subtypeMapping: {
      'Karate': 'Karate',
      'Taekwondo': 'Taekwondo',
      'Judo': 'Judo',
      'Ground & Stand-up Martial Arts': 'Mixed Martial Arts',
      'DEFAULT': null
    }
  },
  
  'Dance': {
    activityType: 'Dance',
    subtypeMapping: {
      'Ballet': 'Ballet',
      'Dance ICanDance': 'Creative Movement',
      'Dance': 'General Dance',
      'DEFAULT': 'General Dance'
    }
  },
  
  'Visual Arts': {
    activityType: 'Visual Arts',
    subtypeMapping: {
      'Mixed Media': 'Mixed Media',
      'Painting': 'Painting',
      'Drawing': 'Drawing',
      'Art Workshops': 'Mixed Media',
      'DEFAULT': 'Mixed Media'
    }
  },
  
  'Pottery': {
    activityType: 'Visual Arts',
    subtypeMapping: {
      'DEFAULT': 'Pottery & Ceramics'
    }
  },
  
  'Skating': {
    activityType: 'Skating & Wheels',
    subtypeMapping: {
      'Skate': 'Ice Skating',
      'Skate Adapted': 'Ice Skating',
      'DEFAULT': 'Ice Skating'
    }
  },
  
  'Gymnastics': {
    activityType: 'Gymnastics & Movement',
    subtypeMapping: {
      'DEFAULT': 'Artistic Gymnastics'
    }
  },
  
  'Climbing': {
    activityType: 'Outdoor & Adventure',
    subtypeMapping: {
      'DEFAULT': 'Rock Climbing'
    }
  },
  
  'Music': {
    activityType: 'Music',
    subtypeMapping: {
      'Guitar': 'Guitar',
      'Ukulele': 'Ukulele',
      'Private Lessons Music': 'Private Music Lessons',
      'DEFAULT': 'Music'
    }
  },
  
  'Cooking': {
    activityType: 'Culinary Arts',
    subtypeMapping: {
      'DEFAULT': 'Basic Cooking'
    }
  },
  
  'Yoga': {
    activityType: 'Fitness & Wellness',
    subtypeMapping: {
      'DEFAULT': 'Yoga'
    }
  },
  
  'Spin': {
    activityType: 'Fitness & Wellness',
    subtypeMapping: {
      'DEFAULT': 'Spin/Cycling'
    }
  },
  
  'Strength & Cardio': {
    activityType: 'Fitness & Wellness',
    subtypeMapping: {
      'DEFAULT': 'Strength Training'
    }
  },
  
  'Movement & Fitness Dance': {
    activityType: 'Fitness & Wellness',
    subtypeMapping: {
      'DEFAULT': 'Dance Fitness'
    }
  },
  
  'Certifications and Leadership': {
    activityType: 'Life Skills & Leadership',
    subtypeMapping: {
      'Babysitter Training': 'Babysitting',
      'Home Alone': 'Home Alone Safety',
      'DEFAULT': 'Leadership Training'
    }
  },
  
  'Aquatic Leadership': {
    activityType: 'Swimming & Aquatics',
    subtypeMapping: {
      'Bronze Cross': 'Lifeguard Training',
      'Bronze Medallion': 'Lifeguard Training',
      'Bronze Star': 'Water Safety',
      'DEFAULT': 'Lifeguard Training'
    }
  },
  
  'Kids Night Out': {
    activityType: 'Special Events',
    subtypeMapping: {
      'DEFAULT': 'Kids Night Out'
    }
  },
  
  'Multisport': {
    activityType: 'Multi-Sport',
    subtypeMapping: {
      'DEFAULT': 'Sport Sampler'
    }
  },
  
  'Learn and Play': {
    activityType: 'Early Development',
    subtypeMapping: {
      'Kids Club': 'Play & Learn',
      'Licensed Preschool': 'Kindergarten Readiness',
      'DEFAULT': 'Play & Learn'
    }
  },
  
  'Early Years Playtime': {
    activityType: 'Early Development',
    subtypeMapping: {
      'Toddler & Me': 'Parent & Tot Classes',
      'DEFAULT': 'Play & Learn'
    }
  },
  
  'Camps': {
    activityType: 'Camps',
    subtypeMapping: {
      'Camp Sport': 'Sports Camp',
      'Camp Art': 'Art Camp',
      'Camp Science': 'Science Camp',
      'Camp Winter Break': 'Day Camp',
      'Camp Babysitter Training': 'Leadership Camp',
      'Camp Byte': 'Tech Camp',
      'Camp Professional Day': 'Day Camp',
      'Camp Youth': 'Day Camp',
      'Camp Outdoor': 'Adventure Camp',
      'DEFAULT': 'Day Camp'
    }
  },
  
  // Complex categories that contain mixed activities
  'School Age': {
    needsSubcategoryParsing: true,
    mappings: {
      'Swimming': { type: 'Swimming & Aquatics', subtype: 'Learn to Swim' },
      'Sports': { type: 'Individual Sports', subtype: null },
      'Basketball': { type: 'Team Sports', subtype: 'Basketball' },
      'Soccer': { type: 'Team Sports', subtype: 'Soccer' },
      'Volleyball': { type: 'Team Sports', subtype: 'Volleyball' },
      'Part Day Camp': { type: 'Camps', subtype: 'Day Camp' },
      'Full Day Camp': { type: 'Camps', subtype: 'Day Camp' },
      'Skating': { type: 'Skating & Wheels', subtype: 'Ice Skating' },
      'Tennis': { type: 'Racquet Sports', subtype: 'Tennis' },
      'Visual Arts': { type: 'Visual Arts', subtype: 'Mixed Media' },
      'Martial Arts': { type: 'Martial Arts', subtype: null },
      'Dance': { type: 'Dance', subtype: 'General Dance' },
      'Pottery': { type: 'Visual Arts', subtype: 'Pottery & Ceramics' },
      'Music': { type: 'Music', subtype: null },
      'Fitness': { type: 'Fitness & Wellness', subtype: null },
      'Drama': { type: 'Performing Arts', subtype: 'Drama' },
      'General Programs': { type: 'Games & Recreation', subtype: null }
    }
  },
  
  'Youth': {
    needsSubcategoryParsing: true,
    mappings: {
      'Swimming': { type: 'Swimming & Aquatics', subtype: 'Learn to Swim' },
      'Sports': { type: 'Individual Sports', subtype: null },
      'Tennis': { type: 'Racquet Sports', subtype: 'Tennis' },
      'Certifications & Leadership': { type: 'Life Skills & Leadership', subtype: null },
      'Swimming - Aquatic Leadership': { type: 'Swimming & Aquatics', subtype: 'Lifeguard Training' },
      'Martial Arts': { type: 'Martial Arts', subtype: null },
      'Pottery': { type: 'Visual Arts', subtype: 'Pottery & Ceramics' },
      'Visual Arts': { type: 'Visual Arts', subtype: 'Mixed Media' },
      'Spin': { type: 'Fitness & Wellness', subtype: 'Spin/Cycling' },
      'Yoga': { type: 'Fitness & Wellness', subtype: 'Yoga' },
      'Dance': { type: 'Dance', subtype: 'General Dance' },
      'Music': { type: 'Music', subtype: null },
      'Outdoor': { type: 'Outdoor & Adventure', subtype: null }
    }
  },
  
  'Early Years: On My Own': {
    needsSubcategoryParsing: true,
    mappings: {
      'Swimming': { type: 'Swimming & Aquatics', subtype: 'Learn to Swim' },
      'Skating': { type: 'Skating & Wheels', subtype: 'Ice Skating' },
      'Dance': { type: 'Dance', subtype: 'Creative Movement' },
      'Sports': { type: 'Multi-Sport', subtype: 'FUNdamentals' },
      'Learn & Play': { type: 'Early Development', subtype: 'Play & Learn' },
      'Part Day Camp': { type: 'Camps', subtype: 'Day Camp' },
      'Visual Arts': { type: 'Visual Arts', subtype: 'Crafts' },
      'Martial Arts': { type: 'Martial Arts', subtype: null }
    }
  },
  
  'Early Years: Parent Participation': {
    needsSubcategoryParsing: true,
    mappings: {
      'Swimming': { type: 'Swimming & Aquatics', subtype: 'Learn to Swim' },
      'Visual Arts': { type: 'Visual Arts', subtype: 'Crafts' },
      'Sports': { type: 'Multi-Sport', subtype: 'FUNdamentals' },
      'Dance': { type: 'Dance', subtype: 'Creative Movement' },
      'Learn & Play': { type: 'Early Development', subtype: 'Parent & Tot Classes' },
      'Music': { type: 'Music', subtype: 'Music & Movement' },
      'Martial Arts': { type: 'Martial Arts', subtype: null },
      'Skating': { type: 'Skating & Wheels', subtype: 'Ice Skating' }
    }
  },
  
  'All Ages & Family': {
    needsSubcategoryParsing: true,
    mappings: {
      'Private Lessons Music': { type: 'Music', subtype: 'Private Music Lessons' },
      'Private Lessons Swimming': { type: 'Swimming & Aquatics', subtype: 'Learn to Swim' },
      'Pottery': { type: 'Visual Arts', subtype: 'Pottery & Ceramics' },
      'Fitness': { type: 'Fitness & Wellness', subtype: null },
      'Community & Special Events': { type: 'Special Events', subtype: 'Special Events' },
      'Visual Arts': { type: 'Visual Arts', subtype: 'Mixed Media' },
      'Outdoor': { type: 'Outdoor & Adventure', subtype: null }
    }
  },
  
  'Adult': {
    activityType: 'Fitness & Wellness',
    subtypeMapping: {
      'DEFAULT': null
    }
  },
  
  'School Programs': {
    activityType: 'Academic Support',
    subtypeMapping: {
      'DEFAULT': 'School Programs'
    }
  }
};

/**
 * Determine age-based categories from age range and activity details
 */
function determineCategories(activity) {
  const categories = [];
  const { ageMin, ageMax, name, description, category, subcategory } = activity;
  
  // Check for parent participation indicators
  const hasParentParticipation = 
    name?.toLowerCase().includes('parent') ||
    name?.toLowerCase().includes('tot') ||
    name?.toLowerCase().includes('& me') ||
    description?.toLowerCase().includes('parent participation') ||
    category?.includes('Parent Participation') ||
    subcategory?.includes('Parent Participation');
  
  // RULE: Ages 1 and under ALWAYS require parent participation
  const isInfantAge = (ageMin !== null && ageMin <= 1) || (ageMax !== null && ageMax <= 1);
  
  // Baby & Parent (0-1) - Activities for ages 1 and under ALWAYS go here
  if (isInfantAge) {
    categories.push('baby-parent');
    // Don't add to other early years categories for infants
  } else {
    // Early Years (2-6) - Only for ages 2+
    if (ageMin !== null && ageMax !== null) {
      if ((ageMin <= 6 && ageMax >= 2) || 
          (ageMin >= 2 && ageMax <= 6)) {
        if (hasParentParticipation) {
          categories.push('early-years-parent');
        } else {
          categories.push('early-years-solo');
        }
      }
    }
  }
  
  // School Age (5-13)
  if (ageMin !== null && ageMax !== null) {
    if ((ageMin <= 13 && ageMax >= 5) || 
        (ageMin >= 5 && ageMax <= 13)) {
      categories.push('school-age');
    }
  }
  
  // Youth (10-18)
  if (ageMin !== null && ageMax !== null) {
    if ((ageMin <= 18 && ageMax >= 10) || 
        (ageMin >= 10 && ageMax <= 18)) {
      categories.push('youth');
    }
  }
  
  // If no categories determined, try to infer from current category
  if (categories.length === 0 && category) {
    if (category.includes('School Age')) {
      categories.push('school-age');
    }
    if (category.includes('Youth')) {
      categories.push('youth');
    }
    if (category.includes('Early Years')) {
      if (category.includes('Parent')) {
        categories.push('early-years-parent');
      } else {
        categories.push('early-years-solo');
      }
    }
    if (category.includes('All Ages')) {
      // Add all relevant categories based on actual age range
      if (ageMin <= 1) categories.push('baby-parent');
      if (ageMin <= 6) categories.push('early-years-solo');
      if (ageMin <= 13) categories.push('school-age');
      if (ageMax >= 10) categories.push('youth');
    }
  }
  
  // Remove duplicates
  return [...new Set(categories)];
}

/**
 * Map an activity to new structure
 */
function mapActivity(activity) {
  const { category, subcategory } = activity;
  
  let activityType = null;
  let activitySubtype = null;
  
  // Check if this category exists in our mappings
  const mapping = CATEGORY_MAPPINGS[category];
  
  if (mapping) {
    if (mapping.needsSubcategoryParsing) {
      // Complex category that needs subcategory parsing
      const subcatMapping = mapping.mappings[subcategory];
      if (subcatMapping) {
        activityType = subcatMapping.type;
        activitySubtype = subcatMapping.subtype || subcategory;
      } else {
        // Try to find partial match
        for (const [key, value] of Object.entries(mapping.mappings)) {
          if (subcategory && subcategory.includes(key)) {
            activityType = value.type;
            activitySubtype = value.subtype || subcategory;
            break;
          }
        }
      }
    } else {
      // Direct mapping
      activityType = mapping.activityType;
      
      // Map subtype
      if (mapping.subtypeMapping) {
        // Check for specific mapping
        let mapped = false;
        for (const [key, value] of Object.entries(mapping.subtypeMapping)) {
          if (key !== 'DEFAULT' && subcategory && subcategory.includes(key)) {
            activitySubtype = value || subcategory;
            mapped = true;
            break;
          }
        }
        
        // Use default if no specific mapping found
        if (!mapped) {
          activitySubtype = mapping.subtypeMapping.DEFAULT || subcategory;
        }
      }
    }
  }
  
  // Determine categories based on age
  const categories = determineCategories(activity);
  
  // Handle unmapped cases
  if (!activityType) {
    console.warn(`Unmapped activity - Category: ${category}, Subcategory: ${subcategory}`);
    activityType = 'Other';
    activitySubtype = subcategory || category;
  }
  
  return {
    activityType,
    activitySubtype,
    categories
  };
}

module.exports = {
  CATEGORY_MAPPINGS,
  determineCategories,
  mapActivity
};