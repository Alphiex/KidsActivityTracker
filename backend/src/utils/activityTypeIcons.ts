/**
 * Activity type icon mappings
 * Maps activity type names from API to Material Community Icons
 */

export const activityTypeIcons: { [key: string]: string } = {
  // Water sports
  'Swimming & Aquatics': 'swim',
  
  // Sports
  'Team Sports': 'basketball',
  'Racquet Sports': 'tennis',
  'Individual Sports': 'run',
  'Skating & Wheels': 'skate',
  
  // Arts & Movement
  'Dance': 'dance-ballroom',
  'Gymnastics & Movement': 'gymnastics',
  'Performing Arts': 'drama-masks',
  'Visual Arts': 'palette',
  'Music': 'music-note',
  
  // Combat & Fitness
  'Martial Arts': 'karate',
  'Fitness & Wellness': 'dumbbell',
  
  // Specialized Programs
  'Early Development': 'baby-face',
  'STEM & Education': 'school',
  'Life Skills & Leadership': 'account-group',
  'Culinary Arts': 'chef-hat',
  'Camps': 'tent',
  'Outdoor & Adventure': 'pine-tree',
  'Other': 'tag',
};

/**
 * Activity type color mappings for gradients
 * Used in AllActivityTypesScreen for colored cards
 */
export const activityTypeColors: { [key: string]: string[] } = {
  // Water sports - Blue tones
  'Swimming & Aquatics': ['#00BCD4', '#0097A7'],
  
  // Sports - Green/Orange tones
  'Team Sports': ['#4CAF50', '#388E3C'],
  'Racquet Sports': ['#8BC34A', '#689F38'],
  'Individual Sports': ['#FF9800', '#F57C00'],
  'Skating & Wheels': ['#03A9F4', '#0288D1'],
  
  // Arts & Movement - Purple/Pink tones
  'Dance': ['#E91E63', '#C2185B'],
  'Gymnastics & Movement': ['#9C27B0', '#7B1FA2'],
  'Performing Arts': ['#673AB7', '#512DA8'],
  'Visual Arts': ['#FF5722', '#E64A19'],
  'Music': ['#795548', '#5D4037'],
  
  // Combat & Fitness - Red/Orange tones
  'Martial Arts': ['#F44336', '#D32F2F'],
  'Fitness & Wellness': ['#FF9800', '#F57C00'],
  
  // Specialized Programs - Various tones
  'Early Development': ['#FFEB3B', '#F9A825'],
  'STEM & Education': ['#2196F3', '#1976D2'],
  'Life Skills & Leadership': ['#607D8B', '#455A64'],
  'Culinary Arts': ['#FF5722', '#E64A19'],
  'Camps': ['#4CAF50', '#388E3C'],
  'Outdoor & Adventure': ['#8BC34A', '#689F38'],
  'Other': ['#9E9E9E', '#757575'],
};

/**
 * Get icon for activity type, with fallback
 */
export const getActivityTypeIcon = (activityTypeName: string): string => {
  return activityTypeIcons[activityTypeName] || 'tag';
};

/**
 * Get colors for activity type, with fallback
 */
export const getActivityTypeColors = (activityTypeName: string): string[] => {
  return activityTypeColors[activityTypeName] || ['#9E9E9E', '#757575'];
};