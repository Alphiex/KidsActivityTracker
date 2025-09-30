/**
 * Utility functions for parsing activity types and extracting age ranges
 */

/**
 * Parse activity type string to extract clean type and age range
 * Examples:
 * - "Arts Dance (0-6yrs)" -> { type: "Dance", category: "Arts", ageMin: 0, ageMax: 6 }
 * - "Swimming Lessons (3-5yrs)" -> { type: "Swimming Lessons", ageMin: 3, ageMax: 5 }
 * - "Tennis" -> { type: "Tennis", ageMin: null, ageMax: null }
 */
function parseActivityType(activityTypeString) {
  if (!activityTypeString) {
    return { type: 'General', category: null, ageMin: null, ageMax: null };
  }

  // Extract age range if present
  const ageMatch = activityTypeString.match(/\((\d+)[\s-]+(\d+)\s*(?:yrs?|years?|y)?\)/i);
  let ageMin = null;
  let ageMax = null;
  
  if (ageMatch) {
    ageMin = parseInt(ageMatch[1]);
    ageMax = parseInt(ageMatch[2]);
  } else {
    // Check for "All Ages" or similar
    if (activityTypeString.toLowerCase().includes('all ages')) {
      ageMin = 0;
      ageMax = 99;
    }
  }

  // Remove age range from string
  let cleanType = activityTypeString.replace(/\s*\([^)]+\)\s*$/, '').trim();
  
  // Extract category if present (e.g., "Arts Dance" -> category: "Arts", type: "Dance")
  let category = null;
  let type = cleanType;
  
  // Common category patterns
  const categoryPatterns = [
    { pattern: /^Arts\s+(.+)$/i, category: 'Arts' },
    { pattern: /^Sports\s+(.+)$/i, category: 'Sports' },
    { pattern: /^Camps\s+(.+)$/i, category: 'Camps' },
    { pattern: /^Aquatic\s+(.+)$/i, category: 'Aquatic' },
    { pattern: /^Fitness\s+(.+)$/i, category: 'Fitness' },
    { pattern: /^Education\s+(.+)$/i, category: 'Education' },
    { pattern: /^STEM\s+(.+)$/i, category: 'STEM' },
  ];
  
  for (const { pattern, category: cat } of categoryPatterns) {
    const match = cleanType.match(pattern);
    if (match) {
      category = cat;
      type = match[1].trim();
      break;
    }
  }
  
  // Normalize common activity types
  const typeNormalization = {
    'dance': 'Dance',
    'dancing': 'Dance',
    'ballet': 'Ballet',
    'hip hop': 'Hip Hop',
    'swim': 'Swimming',
    'swimming lessons': 'Swimming Lessons',
    'tennis': 'Tennis',
    'basketball': 'Basketball',
    'soccer': 'Soccer',
    'football': 'Football',
    'hockey': 'Hockey',
    'skating': 'Skating',
    'gymnastics': 'Gymnastics',
    'martial arts': 'Martial Arts',
    'karate': 'Karate',
    'yoga': 'Yoga',
    'art': 'Art',
    'visual': 'Visual Arts',
    'music': 'Music',
    'drama': 'Drama',
    'day camp': 'Day Camp',
    'part day': 'Part Day Camp',
    'full day': 'Full Day Camp',
  };
  
  const normalizedType = typeNormalization[type.toLowerCase()] || type;
  
  return {
    type: normalizedType,
    category: category,
    ageMin: ageMin,
    ageMax: ageMax
  };
}

/**
 * Extract age range from activity details text
 * Looks for patterns like "Age: 3 to 5", "Ages 6-8", etc.
 */
function extractAgeRangeFromText(text) {
  if (!text) return { min: null, max: null };

  // Helper to convert years and months to decimal years
  const parseAgeWithMonths = (years, months) => {
    const y = parseInt(years) || 0;
    const m = parseInt(months) || 0;
    return y + (m / 12);
  };

  // Helper to round age to nearest integer (round up if >= 0.5 years)
  const roundAge = (age) => Math.round(age);

  // Pattern: "1m to 5 y 12m" or "6m to 3y" - complex format with optional months
  const complexRangeMatch = text.match(/(\d+)\s*m?\s*(?:to|through|-)\s*(\d+)\s*y\s*(\d+)?\s*m?/i);
  if (complexRangeMatch) {
    // Check if first number is months (m) or years
    const firstNum = parseInt(complexRangeMatch[1]);
    const minAge = text.match(/(\d+)\s*m\s*(?:to|through|-)/i)
      ? parseAgeWithMonths(0, firstNum)  // First is months only
      : firstNum;  // First is years

    const maxYears = parseInt(complexRangeMatch[2]);
    const maxMonths = complexRangeMatch[3] ? parseInt(complexRangeMatch[3]) : 0;
    const maxAge = parseAgeWithMonths(maxYears, maxMonths);

    return {
      min: roundAge(minAge),
      max: roundAge(maxAge)
    };
  }

  // Pattern: "5 y 12m" - single age with years and months
  const singleComplexMatch = text.match(/(\d+)\s*y\s*(\d+)?\s*m/i);
  if (singleComplexMatch) {
    const years = parseInt(singleComplexMatch[1]);
    const months = singleComplexMatch[2] ? parseInt(singleComplexMatch[2]) : 0;
    const age = roundAge(parseAgeWithMonths(years, months));
    return { min: age, max: age };
  }

  // Pattern: "6m" - months only
  const monthsOnlyMatch = text.match(/^(\d+)\s*m$/i);
  if (monthsOnlyMatch) {
    const age = roundAge(parseAgeWithMonths(0, parseInt(monthsOnlyMatch[1])));
    return { min: age, max: age };
  }

  // Various standard age range patterns
  const patterns = [
    /Age:\s*(\d+)\s*(?:to|through|-)\s*(\d+)/i,
    /Ages?\s+(\d+)\s*(?:to|through|-)\s*(\d+)/i,
    /(\d+)\s*-\s*(\d+)\s*(?:years?|yrs?)/i,  // "1-5 yrs" or "1-5yrs"
    /(\d+)\s*(?:to|through)\s*(\d+)\s*(?:years?|yrs?)/i,  // "1 to 5 years"
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const min = parseInt(match[1]);
      const max = match[2] ? parseInt(match[2]) : min;
      return { min, max };
    }
  }

  // Check for single age
  const singleAgeMatch = text.match(/Age:\s*(\d+)/i);
  if (singleAgeMatch) {
    const age = parseInt(singleAgeMatch[1]);
    return { min: age, max: age };
  }

  return { min: null, max: null };
}

module.exports = {
  parseActivityType,
  extractAgeRangeFromText
};