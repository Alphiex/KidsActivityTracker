/**
 * Utility class for filtering activities to kids-only content.
 * Used by all scrapers to ensure consistent filtering across platforms.
 */
class KidsActivityFilter {
  // Maximum age to consider as "kids" activity
  static MAX_KIDS_AGE = 18;

  // Patterns that indicate kids/youth/family programs
  static KIDS_CATEGORY_PATTERNS = [
    /preschool/i,
    /children/i,
    /child/i,
    /kids?/i,
    /youth/i,
    /teen/i,
    /teenager/i,
    /family/i,
    /camp/i,
    /early\s*years?/i,
    /school\s*age/i,
    /toddler/i,
    /infant/i,
    /baby/i,
    /junior/i,
    /parent\s*(&|and)\s*(tot|child|baby)/i,
    /mom\s*(&|and)\s*(tot|baby)/i,
    /dad\s*(&|and)\s*(tot|baby)/i,
    /swimming\s*lessons?/i,
    /skating\s*lessons?/i,
    /gymnastics/i,
    /martial\s*arts/i,
    /dance\s*(class|lesson)/i,
    /little\s*(ones?|kickers?|dancers?)/i,
    /pee\s*wee/i,
    /mini/i,
    /beginner/i,
    /learn\s*to\s*(swim|skate|ski)/i
  ];

  // Patterns that indicate adult-only programs (should be excluded)
  static ADULT_ONLY_PATTERNS = [
    // Senior age patterns
    /\b(50|55|60|65|70|75|80)\s*\+/i,
    /\bfor\s*(50|55|60|65|70)\s*\+/i,
    /\bseniors?\b/i,
    /\bsenior\s*(citizen|adult)s?\b/i,
    /\bolder\s*adults?\b/i,
    /\bactive\s*aging\b/i,
    /\bretirement\b/i,
    /\bmature\s*adults?\b/i,
    /\bgolden\s*(age|years)\b/i,

    // Adult-only patterns
    /\badults?\s*only\b/i,
    /\badults?\s*\(?(18|19|21)\+?\)?/i,
    /\b(18|19|21)\s*(?:years?\s*)?(and\s*over|\+|older)/i,
    /\bover\s*(18|19|21)\b/i,
    /\b(18|19|21)\s*y(?:ears?)?\s*\+/i,

    // Age-restricted patterns
    /\bage\s*(18|19|21)\s*(and\s*over|\+)/i,
    /\bages?\s*(18|19|21)\s*-\s*\d+/i,
    /\bminimum\s*age\s*(18|19|21)/i
  ];

  // Age keywords to extract from activity names/descriptions
  static AGE_KEYWORDS = {
    'infant': { min: 0, max: 1 },
    'baby': { min: 0, max: 2 },
    'toddler': { min: 1, max: 3 },
    'preschool': { min: 3, max: 5 },
    'pre-school': { min: 3, max: 5 },
    'kindergarten': { min: 4, max: 6 },
    'early years': { min: 0, max: 5 },
    'school age': { min: 5, max: 12 },
    'school-age': { min: 5, max: 12 },
    'tween': { min: 9, max: 12 },
    'preteen': { min: 10, max: 12 },
    'teen': { min: 13, max: 17 },
    'teenager': { min: 13, max: 17 },
    'youth': { min: 12, max: 18 },
    'junior': { min: 6, max: 12 },
    'senior youth': { min: 15, max: 18 },
    'young adult': { min: 16, max: 21 },
    'adult': { min: 18, max: 99 }
  };

  /**
   * Check if a category name suggests kids activities
   * @param {string} categoryName - The category name to check
   * @returns {boolean} - True if category is likely for kids
   */
  static isKidsCategory(categoryName) {
    if (!categoryName) return true; // Include if no category info

    const name = categoryName.toLowerCase();

    // First, check if it's explicitly adult-only
    if (this.ADULT_ONLY_PATTERNS.some(pattern => pattern.test(name))) {
      return false;
    }

    // If it matches kids patterns, definitely include
    if (this.KIDS_CATEGORY_PATTERNS.some(pattern => pattern.test(name))) {
      return true;
    }

    // Default: include generic categories (will filter by age later)
    return true;
  }

  /**
   * Check if an activity is for kids based on age range
   * @param {Object} activity - Activity object with ageMin/ageMax
   * @returns {boolean} - True if activity is for kids
   */
  static isKidsActivity(activity) {
    // Check if already flagged as adult activity by DataNormalizer
    if (activity.isAdultActivity === true) {
      return false;
    }

    const name = (activity.name || '');
    const category = (activity.category || '');
    const combined = `${name} ${category}`;

    // FIRST: Extract age from activity name - most reliable
    const nameAge = this.extractAgeFromName(name);
    if (nameAge) {
      // If name clearly indicates adult activity
      if (nameAge.min > this.MAX_KIDS_AGE) {
        return false;
      }
      // If name indicates kids activity
      if (nameAge.min <= this.MAX_KIDS_AGE) {
        return true;
      }
    }

    // SECOND: Check for adult-only patterns in name/category
    if (this.ADULT_ONLY_PATTERNS.some(pattern => pattern.test(combined))) {
      return false;
    }

    // THIRD: Use explicit age fields if available
    const ageMin = activity.ageMin ?? activity.ageRange?.min ?? null;
    const ageMax = activity.ageMax ?? activity.ageRange?.max ?? null;

    if (ageMin !== null) {
      // If minimum age is above our threshold, it's an adult activity
      if (ageMin > this.MAX_KIDS_AGE) {
        return false;
      }
      // If min age is appropriate for kids
      return true;
    }

    // FOURTH: Check for kids category patterns
    if (this.KIDS_CATEGORY_PATTERNS.some(pattern => pattern.test(combined))) {
      return true;
    }

    // Default to include (benefit of the doubt for activities without clear age info)
    return true;
  }

  /**
   * Extract age range specifically from activity name
   * @param {string} name - Activity name
   * @returns {Object|null} - { min, max } or null if not found
   */
  static extractAgeFromName(name) {
    if (!name) return null;

    // Check for senior/adult patterns first
    const seniorMatch = name.match(/\b(50|55|60|65|70|75|80)\s*\+/i);
    if (seniorMatch) {
      return { min: parseInt(seniorMatch[1]), max: 99 };
    }

    // Check for 18+, 19+, 21+ patterns
    const adultMatch = name.match(/\b(18|19|21)\s*(?:y(?:ears?)?)?\s*\+/i);
    if (adultMatch) {
      return { min: parseInt(adultMatch[1]), max: 99 };
    }

    // Check for "(4-10Y)" or "(3-5Y)" format
    const yFormatMatch = name.match(/\((\d+)\s*-\s*(\d+)\s*Y\)/i);
    if (yFormatMatch) {
      return { min: parseInt(yFormatMatch[1]), max: parseInt(yFormatMatch[2]) };
    }

    // Check for "(5-13yrs)" format
    const yrsFormatMatch = name.match(/\((\d+)\s*-\s*(\d+)\s*(?:yrs?|years?)\)/i);
    if (yrsFormatMatch) {
      return { min: parseInt(yrsFormatMatch[1]), max: parseInt(yrsFormatMatch[2]) };
    }

    // Check for "(5-13)" format (just numbers in parentheses)
    const parenMatch = name.match(/\((\d+)\s*-\s*(\d+)\)/);
    if (parenMatch) {
      const min = parseInt(parenMatch[1]);
      const max = parseInt(parenMatch[2]);
      // Only use if it looks like an age range (not a year or other number)
      if (min >= 0 && min <= 99 && max <= 99 && min < max) {
        return { min, max };
      }
    }

    // Check for "7-12 Beginners" pattern (age range at start of name)
    const startMatch = name.match(/^(\d+)\s*-\s*(\d+)\s+/);
    if (startMatch) {
      const min = parseInt(startMatch[1]);
      const max = parseInt(startMatch[2]);
      if (min >= 0 && min <= 18 && max <= 99) {
        return { min, max };
      }
    }

    return null;
  }

  /**
   * Filter array of activities to kids-only
   * @param {Array} activities - Array of activity objects
   * @returns {Array} - Filtered array of kids activities
   */
  static filterActivities(activities) {
    if (!Array.isArray(activities)) return [];

    return activities.filter(activity => this.isKidsActivity(activity));
  }

  /**
   * Filter array of links/categories to kids-relevant ones
   * @param {Array} links - Array of link objects with text/name property
   * @param {string} textProperty - Property name containing link text (default: 'text')
   * @returns {Array} - Filtered array of kids-relevant links
   */
  static filterKidsLinks(links, textProperty = 'text') {
    if (!Array.isArray(links)) return [];

    return links.filter(link => {
      const text = link[textProperty] || link.name || link.title || '';
      return this.isKidsCategory(text);
    });
  }

  /**
   * Extract age range from text (activity name, description, etc.)
   * @param {string} text - Text to extract age from
   * @returns {Object|null} - { min, max } or null if not found
   */
  static extractAgeRange(text) {
    if (!text) return null;

    const lowerText = text.toLowerCase();

    // Pattern 1: "Ages 5-12" or "Age 5 to 12" or "5-12 years"
    const rangePattern = /(?:ages?:?\s*)?(\d+)\s*(?:-|to|–)\s*(\d+)\s*(?:years?|yrs?)?/i;
    const rangeMatch = text.match(rangePattern);
    if (rangeMatch) {
      return {
        min: parseInt(rangeMatch[1], 10),
        max: parseInt(rangeMatch[2], 10)
      };
    }

    // Pattern 2: "Ages 5+" or "5 years and up"
    const minPattern = /(?:ages?:?\s*)?(\d+)\s*(?:\+|and\s*(?:up|over|older))/i;
    const minMatch = text.match(minPattern);
    if (minMatch) {
      return {
        min: parseInt(minMatch[1], 10),
        max: 99
      };
    }

    // Pattern 3: "Under 5" or "Up to 5 years"
    const maxPattern = /(?:under|up\s*to)\s*(\d+)\s*(?:years?|yrs?)?/i;
    const maxMatch = text.match(maxPattern);
    if (maxMatch) {
      return {
        min: 0,
        max: parseInt(maxMatch[1], 10)
      };
    }

    // Pattern 4: Check for age keywords
    for (const [keyword, range] of Object.entries(this.AGE_KEYWORDS)) {
      if (lowerText.includes(keyword)) {
        return { ...range };
      }
    }

    return null;
  }

  /**
   * Check if text contains adult-only indicators
   * @param {string} text - Text to check
   * @returns {boolean} - True if text indicates adult-only
   */
  static isAdultOnlyText(text) {
    if (!text) return false;
    return this.ADULT_ONLY_PATTERNS.some(pattern => pattern.test(text));
  }

  /**
   * Get statistics about filtering results
   * @param {Array} original - Original activities array
   * @param {Array} filtered - Filtered activities array
   * @returns {Object} - Statistics about the filtering
   */
  static getFilterStats(original, filtered) {
    const originalCount = original?.length || 0;
    const filteredCount = filtered?.length || 0;
    const removedCount = originalCount - filteredCount;

    return {
      original: originalCount,
      filtered: filteredCount,
      removed: removedCount,
      percentKept: originalCount > 0
        ? Math.round((filteredCount / originalCount) * 100)
        : 0
    };
  }
}

module.exports = KidsActivityFilter;
