/**
 * Activity Type Constants and Mappings
 * 
 * This file contains the mapping between display names (shown in UI)
 * and database values (stored in activities)
 */

// Mapping from display names to database values
// The key is what we show in the UI, the value is what's in the database
export const ACTIVITY_TYPE_DB_MAPPING: { [key: string]: string[] } = {
  'Swimming & Aquatics': ['Swimming & Aquatics', 'Swimming'],
  'Team Sports': ['Team Sports', 'Sports - Team'],
  'Individual Sports': ['Individual Sports', 'Sports - Individual'],
  'Racquet Sports': ['Racquet Sports'],
  'Martial Arts': ['Martial Arts'],
  'Dance': ['Dance'],
  'Visual Arts': ['Visual Arts', 'Arts & Crafts', 'Arts - Visual'],
  'Music': ['Music', 'Arts - Music'],
  'Performing Arts': ['Performing Arts', 'Theatre', 'Theater', 'Drama'],
  'Skating & Wheels': ['Skating & Wheels', 'Skating'],
  'Gymnastics & Movement': ['Gymnastics & Movement', 'Gymnastics'],
  'Camps': ['Camps', 'Day Camps', 'Summer Camp'],
  'STEM & Education': ['STEM & Education', 'STEM', 'Educational'],
  'Fitness & Wellness': ['Fitness & Wellness', 'Fitness', 'Yoga'],
  'Outdoor & Adventure': ['Outdoor & Adventure', 'Outdoor', 'Adventure'],
  'Culinary Arts': ['Culinary Arts', 'Cooking'],
  'Language & Culture': ['Language & Culture', 'Languages', 'Language'],
  'Special Needs Programs': ['Special Needs Programs', 'Special Needs'],
  'Multi-Sport': ['Multi-Sport'],
  'Life Skills & Leadership': ['Life Skills & Leadership', 'Leadership'],
  'Early Development': ['Early Development'],
  'Other Activity': ['Other Activity']
};

/**
 * Get the database values for a display name
 * @param displayName The name shown in the UI
 * @returns Array of possible database values
 */
export function getDatabaseValues(displayName: string): string[] {
  return ACTIVITY_TYPE_DB_MAPPING[displayName] || [displayName];
}

/**
 * Get the display name for a database value
 * @param dbValue The value from the database
 * @returns The display name for the UI
 */
export function getDisplayName(dbValue: string): string {
  for (const [display, values] of Object.entries(ACTIVITY_TYPE_DB_MAPPING)) {
    if (values.includes(dbValue)) {
      return display;
    }
  }
  return dbValue; // Return as-is if no mapping found
}

/**
 * Convert legacy category IDs to activity types
 */
export const LEGACY_CATEGORY_TO_ACTIVITY_TYPE: { [key: string]: string } = {
  'sports': 'Team Sports',
  'arts': 'Visual Arts',
  'music': 'Music',
  'dance': 'Dance',
  'science': 'STEM & Education',
  'technology': 'STEM & Education',
  'outdoor': 'Outdoor & Adventure',
  'educational': 'STEM & Education',
  'camps': 'Camps',
  'swimming': 'Swimming & Aquatics',
  'martial-arts': 'Martial Arts',
  'theater': 'Performing Arts'
};

/**
 * Convert legacy categories to activity types
 */
export function convertToActivityTypes(legacyCategories: string[]): string[] {
  if (!Array.isArray(legacyCategories)) return [];
  
  return legacyCategories.map(cat => {
    return LEGACY_CATEGORY_TO_ACTIVITY_TYPE[cat] || cat;
  }).filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
}