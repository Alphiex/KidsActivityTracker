/**
 * Utility to standardize day abbreviations
 * Ensures all days are in the format: Mon, Tue, Wed, Thu, Fri, Sat, Sun
 */

const DAY_MAPPINGS = {
  // Full names
  'monday': 'Mon',
  'tuesday': 'Tue',
  'wednesday': 'Wed',
  'thursday': 'Thu',
  'friday': 'Fri',
  'saturday': 'Sat',
  'sunday': 'Sun',
  
  // Common incorrect abbreviations
  'mons': 'Mon',
  'tues': 'Tue',
  'weds': 'Wed',
  'thurs': 'Thu',
  'thur': 'Thu',
  'fris': 'Fri',
  'sats': 'Sat',
  'suns': 'Sun',
  
  // 2-letter versions
  'mo': 'Mon',
  'tu': 'Tue',
  'we': 'Wed',
  'th': 'Thu',
  'fr': 'Fri',
  'sa': 'Sat',
  'su': 'Sun',
  
  // Already correct 3-letter versions
  'mon': 'Mon',
  'tue': 'Tue',
  'wed': 'Wed',
  'thu': 'Thu',
  'fri': 'Fri',
  'sat': 'Sat',
  'sun': 'Sun'
};

/**
 * Standardize a day string to proper 3-letter format
 * @param {string} day - The day string to standardize
 * @returns {string} The standardized day abbreviation
 */
function standardizeDay(day) {
  if (!day) return day;
  
  const cleaned = day.trim().toLowerCase();
  return DAY_MAPPINGS[cleaned] || day;
}

/**
 * Standardize days in a schedule string
 * @param {string} schedule - The schedule string containing days
 * @returns {string} The schedule with standardized day abbreviations
 */
function standardizeSchedule(schedule) {
  if (!schedule || typeof schedule !== 'string') return schedule;
  
  let result = schedule;
  
  // Replace "Every" prefix if present
  result = result.replace(/^Every\s+/i, '');
  
  // Replace each incorrect day abbreviation
  Object.entries(DAY_MAPPINGS).forEach(([incorrect, correct]) => {
    // Use word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${incorrect}\\b`, 'gi');
    result = result.replace(regex, correct);
  });
  
  // Clean up any double spaces
  result = result.replace(/\s+/g, ' ').trim();
  
  return result;
}

/**
 * Extract and standardize days from a schedule string
 * @param {string} schedule - The schedule string
 * @returns {string[]} Array of standardized day abbreviations
 */
function extractDays(schedule) {
  if (!schedule || typeof schedule !== 'string') return [];
  
  const days = [];
  const standardDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // First standardize the schedule
  const standardized = standardizeSchedule(schedule);
  
  // Look for each standard day in the string
  standardDays.forEach(day => {
    if (standardized.includes(day)) {
      days.push(day);
    }
  });
  
  return days;
}

module.exports = {
  standardizeDay,
  standardizeSchedule,
  extractDays
};