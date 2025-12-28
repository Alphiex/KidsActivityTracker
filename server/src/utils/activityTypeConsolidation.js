/**
 * Utility to consolidate similar activity types into main categories
 */

const consolidationMap = {
  // Swimming activities
  'Swimming & Aquatics': ['Swimming', 'Private Lessons Swimming', 'Swimming - Aquatic Leadership', 'Swim.*', 'Aquatic.*'],

  // Music activities
  'Music': ['Music', 'Private Lessons Music'],

  // Team Sports
  'Team Sports': ['Soccer', 'Basketball', 'Volleyball', 'Baseball', 'Hockey', 'Football', 'Lacrosse'],

  // Individual Sports
  'Individual Sports': ['Golf', 'Archery', 'Fencing', 'Track', 'Running'],

  // Racquet Sports
  'Racquet Sports': ['Tennis', 'Badminton', 'Squash', 'Pickleball'],

  // Skating
  'Skating & Wheels': ['Skating', 'Skate.*', 'Roller.*', 'Skateboard.*'],

  // Visual Arts
  'Visual Arts': ['Visual Arts', 'Arts Visual.*', 'Art', 'Paint.*', 'Draw.*', 'Pottery', 'Craft.*'],

  // Dance
  'Dance': ['Dance', 'Ballet', 'Hip Hop', 'Arts Dance.*', 'Jazz', 'Tap'],

  // Martial Arts
  'Martial Arts': ['Martial Arts', 'Karate', 'Taekwondo', 'Judo', 'Kung Fu'],

  // Camps
  'Camps': ['Part Day Camp', 'Full Day Camp', 'Day Camp.*', 'Camp.*'],

  // Gymnastics
  'Gymnastics & Movement': ['Gymnastics', 'Tumbl.*', 'Acro.*', 'Trampoline'],

  // STEM
  'STEM & Education': ['Science', 'Coding', 'Robot.*', 'STEM', 'Engineering'],

  // Fitness
  'Fitness & Wellness': ['Fitness', 'Yoga', 'Pilates', 'Workout'],

  // Everything else stays as is
};

/**
 * Consolidate an activity type to its main category
 * @param {string} activityType - The activity type to consolidate
 * @returns {string} - The consolidated activity type
 */
function consolidateActivityType(activityType) {
  if (!activityType) return activityType;
  
  // First, clean any age ranges
  const cleanType = activityType.replace(/\s*\([^)]+\)\s*$/, '').trim();
  
  // Check consolidation map
  for (const [mainType, patterns] of Object.entries(consolidationMap)) {
    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        // Convert wildcard to regex
        const regex = new RegExp(`^${pattern.replace('*', '.*')}$`, 'i');
        if (regex.test(cleanType)) {
          return mainType;
        }
      } else if (cleanType.toLowerCase() === pattern.toLowerCase()) {
        return mainType;
      }
    }
  }
  
  // If no consolidation found, return the clean type
  return cleanType;
}

/**
 * Consolidate activity types from database results
 * @param {Array} activityTypes - Array of activity types with counts
 * @returns {Array} - Consolidated activity types with aggregated counts
 */
function consolidateActivityTypes(activityTypes) {
  const consolidated = {};
  
  activityTypes.forEach(type => {
    if (!type.name) return;
    
    const mainType = consolidateActivityType(type.name);
    
    if (!consolidated[mainType]) {
      consolidated[mainType] = {
        name: mainType,
        count: 0,
        originalTypes: []
      };
    }
    
    consolidated[mainType].count += type.count;
    consolidated[mainType].originalTypes.push(type.name);
  });
  
  // Convert to array and sort by count
  return Object.values(consolidated)
    .map(({ originalTypes, ...rest }) => rest) // Remove originalTypes from output
    .sort((a, b) => b.count - a.count);
}

module.exports = {
  consolidateActivityType,
  consolidateActivityTypes
};