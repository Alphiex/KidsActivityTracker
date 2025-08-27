/**
 * Global utility to fix ALL day abbreviations to standard 3-letter format
 * Mon, Tue, Wed, Thu, Fri, Sat, Sun
 */

// Comprehensive mapping of ALL possible wrong day formats to correct 3-letter abbreviations
const DAY_REPLACEMENTS: { [key: string]: string } = {
  // Full day names
  'monday': 'Mon',
  'tuesday': 'Tue',
  'wednesday': 'Wed',
  'thursday': 'Thu',
  'friday': 'Fri',
  'saturday': 'Sat',
  'sunday': 'Sun',
  
  // Plural full day names
  'mondays': 'Mon',
  'tuesdays': 'Tue',
  'wednesdays': 'Wed',
  'thursdays': 'Thu',
  'fridays': 'Fri',
  'saturdays': 'Sat',
  'sundays': 'Sun',
  
  // ALL 4-letter wrong abbreviations (case insensitive)
  'mons': 'Mon',
  'tues': 'Tue',
  'weds': 'Wed',
  'thurs': 'Thu',
  'thur': 'Thu',
  'fris': 'Fri',
  'sats': 'Sat',
  'suns': 'Sun',
  
  // Other variations we've seen
  'thus': 'Thu',
  'turs': 'Thu',
  'wedn': 'Wed',
  'wend': 'Wed',
};

/**
 * Fix day abbreviations in any string
 * Replaces ALL wrong day formats with standard 3-letter abbreviations
 * @param text - The text containing day abbreviations to fix
 * @returns The text with corrected day abbreviations
 */
export function fixDayAbbreviations(text: string | null | undefined): string {
  if (!text) return '';
  
  let cleaned = text;
  
  // First pass: Replace all known wrong formats
  Object.entries(DAY_REPLACEMENTS).forEach(([wrong, correct]) => {
    // Case insensitive replacement with word boundaries
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    cleaned = cleaned.replace(regex, correct);
  });
  
  // Second pass: Catch ANY remaining 4+ letter day abbreviations
  // This regex matches any word starting with day prefixes and having 4+ letters
  cleaned = cleaned.replace(
    /\b(Mon[a-z]+|Tue[a-z]+|Wed[a-z]+|Thu[a-z]+|Fri[a-z]+|Sat[a-z]+|Sun[a-z]+)\b/gi,
    (match) => {
      // Extract first 3 letters and format properly
      const prefix = match.substring(0, 3);
      return prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase();
    }
  );
  
  // Third pass: Fix any uppercase variations that might remain
  cleaned = cleaned.replace(/\b(MON|TUE|WED|THU|FRI|SAT|SUN)\b/g, (match) => {
    return match.charAt(0) + match.slice(1).toLowerCase();
  });
  
  return cleaned;
}

/**
 * Check if a string contains any wrong day abbreviations
 * Useful for validation and testing
 */
export function hasWrongDayAbbreviations(text: string | null | undefined): boolean {
  if (!text) return false;
  
  // Check for any 4+ letter day abbreviations
  const wrongPattern = /\b(Mon[a-z]+|Tue[a-z]+|Wed[a-z]+|Thu[a-z]+|Fri[a-z]+|Sat[a-z]+|Sun[a-z]+|MONS|TUES|WEDS|THURS|FRIS|SATS|SUNS)\b/i;
  return wrongPattern.test(text);
}

/**
 * Get the standard 3-letter abbreviation for a day name
 */
export function getDayAbbreviation(dayName: string): string {
  const normalized = dayName.toLowerCase().trim();
  
  // Check our replacement map first
  if (DAY_REPLACEMENTS[normalized]) {
    return DAY_REPLACEMENTS[normalized];
  }
  
  // If it starts with a known day prefix, return the proper abbreviation
  const dayPrefixes: { [key: string]: string } = {
    'mon': 'Mon',
    'tue': 'Tue',
    'wed': 'Wed',
    'thu': 'Thu',
    'fri': 'Fri',
    'sat': 'Sat',
    'sun': 'Sun',
  };
  
  const prefix = normalized.substring(0, 3);
  if (dayPrefixes[prefix]) {
    return dayPrefixes[prefix];
  }
  
  // Return as-is if we don't recognize it
  return dayName;
}

// Export a constant with the correct day abbreviations
export const CORRECT_DAY_ABBREVIATIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const CORRECT_DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];