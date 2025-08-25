/**
 * Utility to consolidate similar activity types into main categories
 * This mirrors the backend consolidation logic for frontend display
 */

const consolidationMap: Record<string, string[]> = {
  // Swimming activities
  'Swimming': ['Swimming', 'Private Lessons Swimming', 'Swimming - Aquatic Leadership', 'Swim.*'],
  
  // Music activities  
  'Music': ['Music', 'Private Lessons Music'],
  
  // Sports (keep general sports separate from specific sports)
  'Sports': ['Sports'],
  
  // Skating
  'Skating': ['Skating', 'Skate.*'],
  
  // Visual Arts
  'Visual Arts': ['Visual Arts', 'Arts Visual.*'],
  
  // Dance
  'Dance': ['Dance', 'Ballet', 'Hip Hop', 'Arts Dance.*'],
  
  // Martial Arts
  'Martial Arts': ['Martial Arts', 'Karate', 'Taekwondo', 'Judo'],
  
  // Camps
  'Camps': ['Part Day Camp', 'Full Day Camp', 'Day Camp.*', 'Camp.*'],
};

/**
 * Consolidate an activity type to its main category
 * @param activityType - The activity type to consolidate
 * @returns The consolidated activity type
 */
export function consolidateActivityType(activityType: string): string {
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
 * Consolidate an array of activity types and deduplicate
 * @param activityTypes - Array of activity types to consolidate
 * @returns Array of unique consolidated activity types
 */
export function consolidateActivityTypes(activityTypes: string[]): string[] {
  if (!activityTypes || !Array.isArray(activityTypes)) return [];
  
  const consolidated = activityTypes.map(type => consolidateActivityType(type));
  // Remove duplicates
  return Array.from(new Set(consolidated));
}