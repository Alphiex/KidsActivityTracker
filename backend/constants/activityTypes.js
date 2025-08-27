/**
 * Official list of Activity Types for the Kids Activity Tracker system
 * These should be used in frontend preferences and activity filtering
 */

const ACTIVITY_TYPES = [
  'Swimming & Aquatics',
  'Team Sports',
  'Individual Sports',
  'Racquet Sports',
  'Martial Arts',
  'Dance',
  'Visual Arts',
  'Music',
  'Performing Arts',
  'Skating & Wheels',
  'Gymnastics & Movement',
  'Camps',
  'STEM & Education',
  'Fitness & Wellness',
  'Outdoor & Adventure',
  'Culinary Arts',
  'Language & Culture',
  'Special Needs Programs',
  'Multi-Sport',
  'Life Skills & Leadership',
  'Early Development'
];

// Mapping from old category/preference names to new activity types
const LEGACY_TO_ACTIVITY_TYPE_MAPPING = {
  // Old swimming variations
  'Swimming': 'Swimming & Aquatics',
  'Swimming Lessons': 'Swimming & Aquatics',
  'Aquatic Leadership': 'Swimming & Aquatics',
  'Water Safety': 'Swimming & Aquatics',
  
  // Old sports variations
  'Sports - Team': 'Team Sports',
  'Sports - Individual': 'Individual Sports',
  'Basketball': 'Team Sports',
  'Soccer': 'Team Sports',
  'Football': 'Team Sports',
  'Baseball': 'Team Sports',
  'Volleyball': 'Team Sports',
  'Hockey': 'Team Sports',
  'Tennis': 'Racquet Sports',
  'Badminton': 'Racquet Sports',
  
  // Old arts variations
  'Arts': 'Visual Arts',
  'Arts - Visual': 'Visual Arts',
  'Arts & Crafts': 'Visual Arts',
  'Arts - Music': 'Music',
  'Arts - Performing': 'Performing Arts',
  'music': 'Music',  // lowercase from frontend
  'arts': 'Visual Arts',  // lowercase from frontend
  'Drama': 'Performing Arts',
  'Theatre': 'Performing Arts',
  'Theater': 'Performing Arts',
  
  // Old activity variations
  'Skating': 'Skating & Wheels',
  'Gymnastics': 'Gymnastics & Movement',
  'Day Camps': 'Camps',
  'Summer Camp': 'Camps',
  'School Programs': 'Camps',
  
  // Old education variations
  'STEM': 'STEM & Education',
  'science': 'STEM & Education',  // lowercase from frontend
  'Academic': 'STEM & Education',
  'Educational': 'STEM & Education',
  
  // Old fitness variations
  'Fitness': 'Fitness & Wellness',
  'Yoga': 'Fitness & Wellness',
  
  // Old outdoor variations
  'Outdoor': 'Outdoor & Adventure',
  'Adventure': 'Outdoor & Adventure',
  'Nature': 'Outdoor & Adventure',
  
  // Other variations
  'Cooking': 'Culinary Arts',
  'Languages': 'Language & Culture',
  'Language': 'Language & Culture',
  'Special Needs': 'Special Needs Programs',
  'Leadership': 'Life Skills & Leadership'
};

/**
 * Convert legacy category names to new activity types
 * @param {string[]} legacyCategories - Array of old category names
 * @returns {string[]} Array of new activity type names
 */
function convertToActivityTypes(legacyCategories) {
  if (!Array.isArray(legacyCategories)) return [];
  
  const converted = legacyCategories.map(cat => {
    // First check if it's already a valid activity type
    if (ACTIVITY_TYPES.includes(cat)) {
      return cat;
    }
    // Otherwise try to map it
    return LEGACY_TO_ACTIVITY_TYPE_MAPPING[cat] || cat;
  });
  
  // Remove duplicates
  return [...new Set(converted)];
}

module.exports = {
  ACTIVITY_TYPES,
  LEGACY_TO_ACTIVITY_TYPE_MAPPING,
  convertToActivityTypes
};