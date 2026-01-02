/**
 * Data normalization utilities for standardizing activity data across different platforms
 * Enhanced for 100% field coverage on: location, time, cost, age, dates, days of week, activity, description
 */
class DataNormalizer {
  // Gender keywords for detection in activity names
  static GENDER_PATTERNS = {
    male: [
      /\bboys?\b/i,           // "Boys", "Boy's", "Boy"
      /\bboy['']s\b/i,        // "Boy's" with apostrophe
      /\bmale\b/i,            // "Male"
      /\bmen['']?s?\b/i,      // "Men", "Men's", "Mens"
      /\bguys?\b/i            // "Guy", "Guys"
    ],
    female: [
      /\bgirls?\b/i,          // "Girls", "Girl's", "Girl"
      /\bgirl['']s\b/i,       // "Girl's" with apostrophe
      /\bfemale\b/i,          // "Female"
      /\bwomen['']?s?\b/i,    // "Women", "Women's", "Womens"
      /\bladies\b/i           // "Ladies"
    ],
    coed: [
      /\bco[-\s]?ed\b/i,      // "Co-ed", "Coed", "Co ed"
      /\bmixed\b/i,           // "Mixed"
      /\ball\s+genders?\b/i   // "All genders"
    ]
  };

  // Category to age range mappings for fallback derivation
  static CATEGORY_AGE_MAPPINGS = {
    // Early Years categories
    'early years: parent participation': { min: 0, max: 5 },
    'early years: on my own': { min: 3, max: 5 },
    'parent & tot': { min: 0, max: 3 },
    'parent participation': { min: 0, max: 5 },
    'parent and tot': { min: 0, max: 3 },
    'infant': { min: 0, max: 1 },
    'baby': { min: 0, max: 2 },
    'toddler': { min: 1, max: 3 },
    'preschool': { min: 3, max: 5 },
    'pre-school': { min: 3, max: 5 },
    'kindergarten': { min: 4, max: 6 },
    // School Age categories
    'school age': { min: 5, max: 13 },
    'children': { min: 5, max: 12 },
    'kids': { min: 5, max: 12 },
    'elementary': { min: 5, max: 11 },
    // Youth categories
    'youth': { min: 13, max: 18 },
    'teen': { min: 13, max: 18 },
    'teens': { min: 13, max: 18 },
    'teenager': { min: 13, max: 18 },
    'junior': { min: 8, max: 12 },
    // Family/All Ages
    'family': { min: 0, max: 99 },
    'all ages': { min: 0, max: 99 },
    'all ages & family': { min: 0, max: 99 }
  };

  // Common facility/location name patterns for extraction
  static LOCATION_PATTERNS = [
    /(?:at|@|location:|venue:|held at|takes place at)\s*([^,\n]+)/i,
    /(?:facility|centre|center|arena|pool|park|hall|room):\s*([^,\n]+)/i
  ];

  // Time extraction patterns (ordered by specificity)
  static TIME_PATTERNS = [
    // "9:30am - 12:00pm" or "9:30 am - 12:00 pm"
    /(\d{1,2}):(\d{2})\s*(am|pm)\s*[-–—to]+\s*(\d{1,2}):(\d{2})\s*(am|pm)/i,
    // "9:30-12:00pm" (end period applies to both)
    /(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})\s*(am|pm)/i,
    // "9am - 12pm" or "9 am - 12 pm"
    /(\d{1,2})\s*(am|pm)\s*[-–—to]+\s*(\d{1,2})\s*(am|pm)/i,
    // Single time with minutes "9:30am" or "9:30 am"
    /(\d{1,2}):(\d{2})\s*(am|pm)/i,
    // Single time without minutes "9am" or "9 am"
    /(\d{1,2})\s*(am|pm)/i,
    // 24-hour format "09:30 - 12:00"
    /(\d{2}):(\d{2})\s*[-–—]\s*(\d{2}):(\d{2})/
  ];
  /**
   * Normalize activity data to standard format
   * @param {Object} rawActivity - Raw activity data from scraper
   * @param {Object} fieldMapping - Field mapping configuration
   * @param {Object} config - Provider configuration
   * @returns {Object} - Normalized activity data
   */
  static normalizeActivity(rawActivity, fieldMapping, config = {}) {
    const normalized = {
      // Core required fields
      name: this.mapField(rawActivity, fieldMapping.name) || 'Unknown Activity',
      externalId: this.mapField(rawActivity, fieldMapping.externalId) || this.generateExternalId(rawActivity),
      category: this.mapField(rawActivity, fieldMapping.category) || 'General',
      subcategory: this.mapField(rawActivity, fieldMapping.subcategory),
      
      // Dates and scheduling
      dateStart: this.parseDate(this.mapField(rawActivity, fieldMapping.dateStart)),
      dateEnd: this.parseDate(this.mapField(rawActivity, fieldMapping.dateEnd)),
      schedule: this.mapField(rawActivity, fieldMapping.schedule),
      startTime: this.normalizeTime(this.mapField(rawActivity, fieldMapping.startTime)),
      endTime: this.normalizeTime(this.mapField(rawActivity, fieldMapping.endTime)),
      dayOfWeek: this.normalizeDaysOfWeek(this.mapField(rawActivity, fieldMapping.daysOfWeek)),
      
      // Pricing and availability
      cost: this.normalizeCost(this.mapField(rawActivity, fieldMapping.cost)),
      spotsAvailable: this.normalizeNumber(this.mapField(rawActivity, fieldMapping.spotsAvailable)),
      totalSpots: this.normalizeNumber(this.mapField(rawActivity, fieldMapping.totalSpots)),
      registrationStatus: this.normalizeRegistrationStatus(this.mapField(rawActivity, fieldMapping.registrationStatus)),
      
      // Demographics - will be set below with priority logic
      ageMin: null,
      ageMax: null,
      gender: null, // 'male', 'female', or null for all genders
      isAdultActivity: false,
      
      // Location
      locationName: this.mapField(rawActivity, fieldMapping.locationName),
      fullAddress: this.mapField(rawActivity, fieldMapping.fullAddress),
      latitude: this.normalizeCoordinate(this.mapField(rawActivity, fieldMapping.latitude)),
      longitude: this.normalizeCoordinate(this.mapField(rawActivity, fieldMapping.longitude)),
      
      // Registration
      registrationUrl: this.normalizeUrl(this.mapField(rawActivity, fieldMapping.registrationUrl)),
      
      // Enhanced details
      description: this.mapField(rawActivity, fieldMapping.description),
      fullDescription: this.mapField(rawActivity, fieldMapping.fullDescription),
      instructor: this.mapField(rawActivity, fieldMapping.instructor),
      whatToBring: this.mapField(rawActivity, fieldMapping.whatToBring),
      
      // Metadata
      rawData: rawActivity
    };

    // PRIORITY 1: Extract age from activity NAME first - most reliable source
    // This catches patterns like "(4-10Y)", "55+", "Seniors", etc. in the name
    const nameAgeRange = this.extractAgeFromName(normalized.name);
    if (nameAgeRange) {
      if (nameAgeRange.isAdult) {
        // Mark as adult activity for filtering
        normalized.isAdultActivity = true;
        normalized.ageMin = nameAgeRange.min;
        normalized.ageMax = nameAgeRange.max;
      } else {
        // Valid kids activity with ages in name
        normalized.ageMin = nameAgeRange.min;
        normalized.ageMax = Math.min(nameAgeRange.max, 18);
      }
    }

    // PRIORITY 2: Use field-mapped ages only if name didn't have any
    if (!normalized.ageMin && !normalized.ageMax && !normalized.isAdultActivity) {
      const mappedMin = this.normalizeAge(this.mapField(rawActivity, fieldMapping.ageMin));
      const mappedMax = this.normalizeAge(this.mapField(rawActivity, fieldMapping.ageMax));

      // Check if mapped ages indicate adult activity (normalizeAge returns null for >18)
      // So we need to check raw values too
      const rawAgeMin = this.mapField(rawActivity, fieldMapping.ageMin);
      const rawAgeMax = this.mapField(rawActivity, fieldMapping.ageMax);

      if (rawAgeMin) {
        const rawMinNum = parseInt(String(rawAgeMin));
        if (rawMinNum > 18) {
          normalized.isAdultActivity = true;
          normalized.ageMin = rawMinNum;
          normalized.ageMax = rawAgeMax ? parseInt(String(rawAgeMax)) : 99;
        }
      }

      if (!normalized.isAdultActivity) {
        normalized.ageMin = mappedMin;
        normalized.ageMax = mappedMax;
      }
    }

    // PRIORITY 3: Extract from description/category text if still not found
    if (!normalized.ageMin && !normalized.ageMax && !normalized.isAdultActivity) {
      const ageRange = this.extractAgeRange(rawActivity);
      if (ageRange) {
        if (ageRange.isAdult) {
          normalized.isAdultActivity = true;
          normalized.ageMin = ageRange.min;
          normalized.ageMax = ageRange.max;
        } else {
          normalized.ageMin = ageRange.min;
          normalized.ageMax = ageRange.max;
        }
      }
    }

    // PRIORITY 4: Derive age from category if still not found
    if (!normalized.ageMin && !normalized.ageMax && !normalized.isAdultActivity && normalized.category) {
      const derivedAge = this.deriveAgeFromCategory(normalized.category, normalized.subcategory);
      if (derivedAge) {
        // Check if derived age is for adults
        if (derivedAge.min > 18) {
          normalized.isAdultActivity = true;
        }
        normalized.ageMin = derivedAge.min;
        normalized.ageMax = derivedAge.max;
      }
    }

    // Extract gender from activity name (e.g., "Boys Basketball", "Girls Softball")
    normalized.gender = this.extractGenderFromName(normalized.name);

    // Extract times from schedule/rawText if not provided
    if (!normalized.startTime || !normalized.endTime) {
      const times = this.extractTimeRange(rawActivity);
      if (times) {
        normalized.startTime = normalized.startTime || times.start;
        normalized.endTime = normalized.endTime || times.end;
      }
    }

    // Extract days of week from schedule/rawText if empty
    if (!normalized.dayOfWeek || normalized.dayOfWeek.length === 0) {
      const days = this.extractDaysFromText(rawActivity);
      if (days && days.length > 0) {
        normalized.dayOfWeek = days;
      }
    }

    // Extract dates from text if not found
    if (!normalized.dateStart || !normalized.dateEnd) {
      const dates = this.extractDateRange(rawActivity);
      if (dates) {
        normalized.dateStart = normalized.dateStart || dates.start;
        normalized.dateEnd = normalized.dateEnd || dates.end;
      }
    }

    // Extract location from text if not found
    if (!normalized.locationName) {
      normalized.locationName = this.extractLocationFromText(rawActivity);
    }

    // Clean and normalize description
    if (normalized.description) {
      normalized.description = this.cleanDescription(normalized.description);
    }
    if (normalized.fullDescription) {
      normalized.fullDescription = this.cleanDescription(normalized.fullDescription, 5000);
    }

    // Generate readable date range
    if (normalized.dateStart && normalized.dateEnd) {
      normalized.dates = this.formatDateRange(normalized.dateStart, normalized.dateEnd);
    }

    return normalized;
  }

  /**
   * Map a field from raw data using field mapping configuration
   * @param {Object} rawData - Raw data object
   * @param {String|Object} mapping - Field mapping (string for simple path, object for complex mapping)
   * @returns {*} - Mapped value
   */
  static mapField(rawData, mapping) {
    if (!mapping) return null;

    if (typeof mapping === 'string') {
      // Simple field path
      return this.getNestedValue(rawData, mapping);
    } else if (typeof mapping === 'object') {
      // Complex mapping with transformations
      let value = null;

      // Support multiple paths (try each until one has a value)
      if (mapping.paths && Array.isArray(mapping.paths)) {
        for (const path of mapping.paths) {
          value = this.getNestedValue(rawData, path);
          if (value !== null && value !== undefined) break;
        }
      } else if (mapping.path) {
        value = this.getNestedValue(rawData, mapping.path);
      }

      if (mapping.transform) {
        return this.applyTransform(value, mapping.transform, rawData);
      }

      return value;
    }

    return null;
  }

  /**
   * Get nested value from object using dot notation
   * @param {Object} obj - Object to search
   * @param {String} path - Dot notation path (e.g., 'activity.details.name')
   * @returns {*} - Value at path or null
   */
  static getNestedValue(obj, path) {
    if (!obj || !path) return null;
    
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  /**
   * Apply transformation to a value
   * @param {*} value - Value to transform
   * @param {String|Function} transform - Transformation to apply
   * @param {Object} rawData - Original raw data object (for transforms that need context)
   * @returns {*} - Transformed value
   */
  static applyTransform(value, transform, rawData = null) {
    if (!value) return value;

    if (typeof transform === 'function') {
      return transform(value, rawData);
    }
    
    switch (transform) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'trim':
        return String(value).trim();
      case 'parseFloat':
        return parseFloat(value) || 0;
      case 'parseInt':
        return parseInt(value) || 0;
      default:
        return value;
    }
  }

  /**
   * Parse date string to Date object
   * @param {String} dateStr - Date string in various formats
   * @returns {Date|null} - Parsed date or null
   */
  static parseDate(dateStr) {
    if (!dateStr) return null;

    // If already a Date object, return it
    if (dateStr instanceof Date) {
      return isNaN(dateStr.getTime()) ? null : dateStr;
    }

    try {
      // Handle slash-separated date formats: MM/DD/YY, MM/DD/YYYY, DD/MM/YYYY
      const slashMatch = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (slashMatch) {
        const first = parseInt(slashMatch[1]);
        const second = parseInt(slashMatch[2]);
        let year = parseInt(slashMatch[3]);
        if (year < 100) year += 2000; // Convert 25 to 2025

        // If first number > 12, it must be DD/MM format (European)
        if (first > 12) {
          const day = first;
          const month = second - 1;
          return new Date(year, month, day);
        }
        // Otherwise assume MM/DD format (North American)
        const month = first - 1;
        const day = second;
        return new Date(year, month, day);
      }

      // Handle ISO format YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
          return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
        }
      }

      // Handle "Month Day" format by adding current year
      if (/^[A-Z][a-z]{2}\s+\d{1,2}$/.test(dateStr)) {
        const currentYear = new Date().getFullYear();
        return new Date(`${dateStr}, ${currentYear}`);
      }

      // Handle "Day, DD-Mon-YY" or "DD-Mon-YY" format (e.g., "Sat, 17-Jan-26" or "17-Jan-26")
      // Used by Intelligenz/Recreation Excellence (Lethbridge, Pitt Meadows, etc.)
      // Note: Day prefix requires a comma or space to avoid matching digits
      const ddMonYYMatch = String(dateStr).match(/(?:[A-Za-z]+,\s*)?(\d{1,2})[-/]([A-Za-z]{3})[-/](\d{2,4})/);
      if (ddMonYYMatch) {
        const months = {
          'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
          'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
        };
        const day = parseInt(ddMonYYMatch[1]);
        const month = months[ddMonYYMatch[2].toLowerCase()];
        let year = parseInt(ddMonYYMatch[3]);
        if (year < 100) year += 2000; // Convert 26 to 2026

        if (month !== undefined) {
          return new Date(year, month, day);
        }
      }

      // Try standard Date parsing
      const parsed = new Date(dateStr);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch (error) {
      console.warn(`Failed to parse date: ${dateStr}`);
      return null;
    }
  }

  /**
   * Normalize coordinate value (latitude or longitude)
   * @param {String|Number} coord - Coordinate value
   * @returns {Number|null} - Normalized coordinate or null
   */
  static normalizeCoordinate(coord) {
    if (coord === null || coord === undefined) return null;

    const num = typeof coord === 'string' ? parseFloat(coord) : coord;

    // Validate it's a reasonable coordinate
    if (isNaN(num)) return null;

    // Return with reasonable precision (6 decimal places = ~11cm accuracy)
    return Math.round(num * 1000000) / 1000000;
  }

  /**
   * Normalize time string to consistent format
   * @param {String} timeStr - Time string in various formats
   * @returns {String|null} - Normalized time string (e.g., "3:00 PM")
   */
  static normalizeTime(timeStr) {
    if (!timeStr) return null;
    
    // Remove extra spaces and normalize
    timeStr = timeStr.trim().replace(/\s+/g, ' ');
    
    // Handle various formats
    const timePatterns = [
      /(\d{1,2}):(\d{2})\s*(am|pm)/i,
      /(\d{1,2}):(\d{2})/,
      /(\d{1,2})\s*(am|pm)/i
    ];
    
    for (const pattern of timePatterns) {
      const match = timeStr.match(pattern);
      if (match) {
        let hour = parseInt(match[1]);
        const minute = match[2] ? parseInt(match[2]) : 0;
        const period = match[3] ? match[3].toLowerCase() : '';
        
        // Convert to 12-hour format with AM/PM
        if (period === 'pm' && hour !== 12) {
          hour += 12;
        } else if (period === 'am' && hour === 12) {
          hour = 0;
        }
        
        // Convert back to 12-hour display format
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const displayPeriod = hour >= 12 ? 'PM' : 'AM';
        
        return `${displayHour}:${minute.toString().padStart(2, '0')} ${displayPeriod}`;
      }
    }
    
    return timeStr;
  }

  /**
   * Normalize days of week to standard array format
   * @param {String|Array} daysInput - Days input in various formats
   * @returns {Array} - Standardized days array
   */
  static normalizeDaysOfWeek(daysInput) {
    if (!daysInput) return [];
    
    if (Array.isArray(daysInput)) {
      return daysInput;
    }
    
    const dayMappings = {
      'monday': 'Mon', 'mon': 'Mon', 'mons': 'Mon',
      'tuesday': 'Tue', 'tue': 'Tue', 'tues': 'Tue', 
      'wednesday': 'Wed', 'wed': 'Wed', 'weds': 'Wed',
      'thursday': 'Thu', 'thu': 'Thu', 'thurs': 'Thu', 'thur': 'Thu',
      'friday': 'Fri', 'fri': 'Fri', 'fris': 'Fri',
      'saturday': 'Sat', 'sat': 'Sat', 'sats': 'Sat',
      'sunday': 'Sun', 'sun': 'Sun', 'suns': 'Sun'
    };
    
    const days = [];
    const input = String(daysInput).toLowerCase();
    
    for (const [pattern, abbrev] of Object.entries(dayMappings)) {
      if (input.includes(pattern)) {
        days.push(abbrev);
      }
    }
    
    return [...new Set(days)]; // Remove duplicates
  }

  /**
   * Normalize cost to number format
   * @param {String|Number} costInput - Cost in various formats
   * @returns {Number} - Normalized cost as number
   */
  static normalizeCost(costInput) {
    if (typeof costInput === 'number') return costInput;
    if (!costInput) return 0;
    
    const costStr = String(costInput).toLowerCase();
    
    // Handle "free" activities
    if (costStr.includes('free') || costStr.includes('no cost')) {
      return 0;
    }
    
    // Extract number from string (handle $75.00, $75, etc.)
    const match = costStr.match(/[\d,]+\.?\d*/);
    if (match) {
      return parseFloat(match[0].replace(',', '')) || 0;
    }
    
    return 0;
  }

  /**
   * Normalize number fields
   * @param {String|Number} numberInput - Number in various formats
   * @returns {Number|null} - Normalized number or null
   */
  static normalizeNumber(numberInput) {
    if (typeof numberInput === 'number') return numberInput;
    if (!numberInput) return null;
    
    const parsed = parseInt(String(numberInput));
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Normalize age values
   * @param {String|Number} ageInput - Age in various formats
   * @returns {Number|null} - Normalized age or null
   */
  static normalizeAge(ageInput) {
    if (typeof ageInput === 'number') return ageInput;
    if (!ageInput) return null;
    
    const parsed = parseInt(String(ageInput));
    return isNaN(parsed) || parsed < 0 || parsed > 18 ? null : parsed;
  }

  /**
   * Normalize registration status
   * @param {String} statusInput - Status in various formats
   * @returns {String} - Normalized status
   */
  static normalizeRegistrationStatus(statusInput) {
    if (!statusInput) return 'Unknown';
    
    const status = String(statusInput).toLowerCase();
    
    if (status.includes('open') || status.includes('available') || status.includes('sign up')) {
      return 'Open';
    } else if (status.includes('full') || status.includes('sold out')) {
      return 'Full';
    } else if (status.includes('closed') || status.includes('ended')) {
      return 'Closed';
    } else if (status.includes('waitlist') || status.includes('wait list')) {
      return 'Waitlist';
    }
    
    return 'Unknown';
  }

  /**
   * Normalize URL to ensure it's valid
   * @param {String} urlInput - URL string
   * @returns {String|null} - Valid URL or null
   */
  static normalizeUrl(urlInput) {
    if (!urlInput) return null;
    
    try {
      // If it's already a valid URL, return it
      new URL(urlInput);
      return urlInput;
    } catch (error) {
      // Try adding protocol if missing
      try {
        if (!urlInput.startsWith('http')) {
          const withProtocol = `https://${urlInput}`;
          new URL(withProtocol);
          return withProtocol;
        }
      } catch (e) {
        console.warn(`Invalid URL: ${urlInput}`);
      }
    }
    
    return null;
  }

  /**
   * Extract age range from activity text - returns raw ages without filtering
   * This allows detecting adult activities (55+, etc.) for exclusion
   * @param {Object} rawActivity - Raw activity data
   * @param {Object} options - Options: { capAt18: boolean, returnAdult: boolean }
   * @returns {Object|null} - Age range {min, max, isAdult} or null
   */
  static extractAgeRange(rawActivity, options = {}) {
    const { capAt18 = true, returnAdult = false } = options;

    // Look for age information in various fields
    const textFields = [
      rawActivity.name,
      rawActivity.activityType,
      rawActivity.subcategory,
      rawActivity.description,
      rawActivity.category,
      rawActivity.ageRestrictions,
      rawActivity.rawText
    ].filter(Boolean);

    const fullText = textFields.join(' ');

    // Various age range patterns - ordered by specificity
    const patterns = [
      // "Age: 2 to 3 y 12m" - PerfectMind format with months
      /age:\s*(\d+)\s*(?:y)?\s*(?:\d+\s*m)?\s*to\s*(\d+)\s*y/i,
      // "(0-6yrs)" or "(5-13yrs)" or "(4-10Y)" - common format in activity names
      /\((\d+)\s*-\s*(\d+)\s*(?:yrs?|years?|y)\)/i,
      // "1-5yrs" or "1-5 yrs" or "1-5Y" in activity name
      /(\d+)\s*-\s*(\d+)\s*(?:yrs?|years?|y)\b/i,
      // "5 to 13 years" or "5 to 13 yrs"
      /(\d+)\s*to\s*(\d+)\s*(?:years?|yrs?|y)\b/i,
      // "ages 5-13"
      /ages?\s*(\d+)\s*-\s*(\d+)/i,
      // "ages 5 to 13"
      /ages?\s*(\d+)\s*to\s*(\d+)/i,
      // "Age: 5-13" or "Age: 5 - 13"
      /age:\s*(\d+)\s*(?:-|–|to)\s*(\d+)/i,
      // "(5-13)" - parentheses with just numbers
      /\((\d+)\s*-\s*(\d+)\)/,
      // "5-13" at the start of name or after space (like "7-12 Beginners")
      /(?:^|\s)(\d+)\s*-\s*(\d+)(?:\s|$)/
    ];

    for (const pattern of patterns) {
      const match = fullText.match(pattern);
      if (match) {
        const min = parseInt(match[1]);
        const max = parseInt(match[2]);
        if (min <= max && min >= 0 && max <= 99) {
          const isAdult = min > 18 || (min >= 18 && max > 25);

          // If it's an adult activity, only return if returnAdult is true
          if (isAdult && !returnAdult) {
            return { min, max, isAdult: true };
          }

          // Cap at 18 for children's activities if requested
          return {
            min,
            max: capAt18 ? Math.min(max, 18) : max,
            isAdult
          };
        }
      }
    }

    // Check for single age patterns like "55+" or "18+"
    const singleAgePatterns = [
      /(\d+)\s*(?:yrs?|years?)\s*(?:&|and)\s*(?:up|older|above)/i, // "5yrs & up"
      /(\d+)\s*\+/i, // "55+" or "18+"
      /(\d+)\s*(?:yrs?|years?)\s*\+/i // "55 yrs+"
    ];

    for (const pattern of singleAgePatterns) {
      const match = fullText.match(pattern);
      if (match) {
        const min = parseInt(match[1]);
        if (min >= 0) {
          const isAdult = min > 18;

          // If it's an adult activity (55+, 18+, etc.)
          if (isAdult) {
            if (returnAdult) {
              return { min, max: 99, isAdult: true };
            }
            // Return the flag so caller knows this is an adult activity
            return { min, max: 99, isAdult: true };
          }

          // Kids activity with min age
          return { min, max: 18, isAdult: false };
        }
      }
    }

    return null;
  }

  /**
   * Extract gender from activity name
   * @param {String} activityName - The activity name
   * @returns {String|null} - 'male', 'female', or null for all genders
   */
  static extractGenderFromName(activityName) {
    if (!activityName) return null;

    const name = activityName;

    // Check for co-ed first (explicit mixed gender)
    for (const pattern of this.GENDER_PATTERNS.coed) {
      if (pattern.test(name)) {
        return null; // Explicitly co-ed means all genders
      }
    }

    // Check for male patterns
    for (const pattern of this.GENDER_PATTERNS.male) {
      if (pattern.test(name)) {
        return 'male';
      }
    }

    // Check for female patterns
    for (const pattern of this.GENDER_PATTERNS.female) {
      if (pattern.test(name)) {
        return 'female';
      }
    }

    // No gender indicator found - available for all genders
    return null;
  }

  /**
   * Extract age specifically from activity name - most reliable source
   * @param {String} activityName - The activity name
   * @returns {Object|null} - Age range {min, max, isAdult} or null
   */
  static extractAgeFromName(activityName) {
    if (!activityName) return null;

    const name = activityName.toLowerCase();

    // Check for explicit adult keywords first
    const adultKeywords = [
      /\b(55|60|65|70)\s*\+/,          // Senior ages
      /\bseniors?\b/i,                  // "Seniors" or "Senior"
      /\badults?\s+only\b/i,            // "Adults Only"
      /\b(19|20|21)\s*\+/,              // Adult minimum ages
      /\bover\s*(18|19|21)\b/i          // "Over 18", "Over 21"
    ];

    for (const pattern of adultKeywords) {
      if (pattern.test(activityName)) {
        const match = activityName.match(/(\d+)\s*\+/);
        const min = match ? parseInt(match[1]) : 18;
        return { min, max: 99, isAdult: true };
      }
    }

    // Pattern priority for name parsing (most specific first)
    const namePatterns = [
      // "(4-10Y)" or "(3-5Y)" format
      { pattern: /\((\d+)\s*-\s*(\d+)\s*Y\)/i, type: 'range' },
      // "(5-13yrs)" or "(5-13 yrs)"
      { pattern: /\((\d+)\s*-\s*(\d+)\s*(?:yrs?|years?)\)/i, type: 'range' },
      // "(5-13)" just numbers in parentheses
      { pattern: /\((\d+)\s*-\s*(\d+)\)/i, type: 'range' },
      // "7-12 Beginners" - age range at start
      { pattern: /^(\d+)\s*-\s*(\d+)\s+/i, type: 'range' },
      // "Kids 5-12" or "Youth 13-17"
      { pattern: /(?:kids?|youth|children|teens?)\s*(?:\()?(\d+)\s*-\s*(\d+)/i, type: 'range' },
      // "(6-8Y)" single letter Y
      { pattern: /(\d+)\s*-\s*(\d+)\s*Y\b/i, type: 'range' },
      // "18Y+" or "12Y+"
      { pattern: /(\d+)\s*Y\s*\+/i, type: 'plus' },
      // "12+" or "18+"
      { pattern: /(\d+)\s*\+/, type: 'plus' },
      // "Teens/Adults 12yrs+"
      { pattern: /(\d+)\s*(?:yrs?|years?)\s*\+/i, type: 'plus' }
    ];

    for (const { pattern, type } of namePatterns) {
      const match = activityName.match(pattern);
      if (match) {
        if (type === 'range') {
          const min = parseInt(match[1]);
          const max = parseInt(match[2]);
          if (min <= max && min >= 0 && max <= 99) {
            const isAdult = min > 18 || (min >= 18 && max > 25);
            return { min, max, isAdult };
          }
        } else if (type === 'plus') {
          const min = parseInt(match[1]);
          if (min >= 0) {
            const isAdult = min > 18;
            return { min, max: isAdult ? 99 : 18, isAdult };
          }
        }
      }
    }

    return null;
  }

  /**
   * Format date range for display
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {String} - Formatted date range
   */
  static formatDateRange(startDate, endDate) {
    if (!startDate || !endDate) return '';
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const formatDate = (date) => {
      return `${months[date.getMonth()]} ${date.getDate()}`;
    };
    
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  }

  /**
   * Generate external ID if not provided
   * @param {Object} rawActivity - Raw activity data
   * @returns {String} - Generated external ID
   */
  static generateExternalId(rawActivity) {
    // Use course ID, activity ID, or generate from name and dates
    if (rawActivity.courseId) return rawActivity.courseId;
    if (rawActivity.activityId) return rawActivity.activityId;
    if (rawActivity.id) return String(rawActivity.id);

    // Generate from name and dates
    const name = (rawActivity.name || 'activity').replace(/[^a-zA-Z0-9]/g, '_');
    const date = rawActivity.startDate || rawActivity.dateStart || Date.now();
    return `${name}_${date}`.substring(0, 50);
  }

  /**
   * Derive age range from category name
   * @param {String} category - Category name
   * @param {String} subcategory - Subcategory name (optional)
   * @returns {Object|null} - Age range {min, max} or null
   */
  static deriveAgeFromCategory(category, subcategory) {
    const searchTexts = [
      (category || '').toLowerCase(),
      (subcategory || '').toLowerCase()
    ].filter(Boolean);

    for (const text of searchTexts) {
      // Check exact matches first
      if (this.CATEGORY_AGE_MAPPINGS[text]) {
        return this.CATEGORY_AGE_MAPPINGS[text];
      }

      // Check partial matches
      for (const [pattern, ageRange] of Object.entries(this.CATEGORY_AGE_MAPPINGS)) {
        if (text.includes(pattern)) {
          return ageRange;
        }
      }
    }

    return null;
  }

  /**
   * Extract time range from raw activity text
   * @param {Object} rawActivity - Raw activity data
   * @returns {Object|null} - Time range {start, end} or null
   */
  static extractTimeRange(rawActivity) {
    const textFields = [
      rawActivity.schedule,
      rawActivity.time,
      rawActivity.timeRange,
      rawActivity.rawText,
      rawActivity.description,
      rawActivity.sessionInfo
    ].filter(Boolean);

    const fullText = textFields.join(' ');

    // Pattern for time ranges: "9:30am - 12:00pm" or "9:30 am - 12:00 pm"
    const rangePattern = /(\d{1,2}):?(\d{2})?\s*(am|pm)?\s*[-–—to]+\s*(\d{1,2}):?(\d{2})?\s*(am|pm)/i;
    const match = fullText.match(rangePattern);

    if (match) {
      const startHour = match[1];
      const startMin = match[2] || '00';
      const startPeriod = match[3] || match[6]; // Use end period if start not specified
      const endHour = match[4];
      const endMin = match[5] || '00';
      const endPeriod = match[6];

      const formatTime = (hour, min, period) => {
        const h = parseInt(hour);
        const m = parseInt(min);
        const p = (period || 'am').toUpperCase();
        return `${h}:${m.toString().padStart(2, '0')} ${p}`;
      };

      return {
        start: formatTime(startHour, startMin, startPeriod),
        end: formatTime(endHour, endMin, endPeriod)
      };
    }

    // Try to find just a start time
    const singleTimePattern = /(\d{1,2}):?(\d{2})?\s*(am|pm)/i;
    const singleMatch = fullText.match(singleTimePattern);
    if (singleMatch) {
      const hour = singleMatch[1];
      const min = singleMatch[2] || '00';
      const period = singleMatch[3].toUpperCase();
      return {
        start: `${hour}:${min.padStart(2, '0')} ${period}`,
        end: null
      };
    }

    return null;
  }

  /**
   * Extract days of week from raw activity text
   * @param {Object} rawActivity - Raw activity data
   * @returns {Array} - Array of day abbreviations
   */
  static extractDaysFromText(rawActivity) {
    const textFields = [
      rawActivity.schedule,
      rawActivity.days,
      rawActivity.daysOfWeek,
      rawActivity.dayOfWeek,
      rawActivity.rawText,
      rawActivity.sessionInfo
    ].filter(Boolean);

    const fullText = textFields.join(' ').toLowerCase();
    const days = new Set();

    // Map of day patterns to standard abbreviations
    const dayPatterns = [
      { patterns: ['monday', 'mon\\.?\\b', '\\bm\\b(?=[^a-z]|$)'], abbrev: 'Mon' },
      { patterns: ['tuesday', 'tue\\.?\\b', 'tues\\.?\\b', '\\btu\\b'], abbrev: 'Tue' },
      { patterns: ['wednesday', 'wed\\.?\\b', '\\bw\\b(?=[^a-z]|$)'], abbrev: 'Wed' },
      { patterns: ['thursday', 'thu\\.?\\b', 'thurs?\\.?\\b', '\\bth\\b'], abbrev: 'Thu' },
      { patterns: ['friday', 'fri\\.?\\b', '\\bf\\b(?=[^a-z]|$)'], abbrev: 'Fri' },
      { patterns: ['saturday', 'sat\\.?\\b', '\\bsa\\b'], abbrev: 'Sat' },
      { patterns: ['sunday', 'sun\\.?\\b', '\\bsu\\b'], abbrev: 'Sun' }
    ];

    for (const { patterns, abbrev } of dayPatterns) {
      for (const pattern of patterns) {
        if (new RegExp(pattern, 'i').test(fullText)) {
          days.add(abbrev);
          break;
        }
      }
    }

    // Check for "M/W/F" or "M, W, F" patterns
    const mwfPattern = /\b([mtwrfsu])[\s,\/&]+([mtwrfsu])(?:[\s,\/&]+([mtwrfsu]))?(?:[\s,\/&]+([mtwrfsu]))?\b/i;
    const mwfMatch = fullText.match(mwfPattern);
    if (mwfMatch) {
      const letterMap = {
        'm': 'Mon', 't': 'Tue', 'w': 'Wed', 'r': 'Thu', 'f': 'Fri', 's': 'Sat', 'u': 'Sun'
      };
      for (let i = 1; i <= 4; i++) {
        if (mwfMatch[i]) {
          const letter = mwfMatch[i].toLowerCase();
          if (letterMap[letter]) {
            days.add(letterMap[letter]);
          }
        }
      }
    }

    // Check for "weekdays" or "weekends"
    if (/weekday/i.test(fullText)) {
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach(d => days.add(d));
    }
    if (/weekend/i.test(fullText)) {
      ['Sat', 'Sun'].forEach(d => days.add(d));
    }

    // Check for "daily" or "every day"
    if (/\bdaily\b|\bevery\s*day\b/i.test(fullText)) {
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(d => days.add(d));
    }

    return Array.from(days);
  }

  /**
   * Extract date range from raw activity text
   * @param {Object} rawActivity - Raw activity data
   * @returns {Object|null} - Date range {start, end} or null
   */
  static extractDateRange(rawActivity) {
    const textFields = [
      rawActivity.dates,
      rawActivity.dateRange,
      rawActivity.schedule,
      rawActivity.rawText,
      rawActivity.sessionInfo
    ].filter(Boolean);

    const fullText = textFields.join(' ');

    // Month name mapping
    const months = {
      'jan': 0, 'january': 0, 'feb': 1, 'february': 1, 'mar': 2, 'march': 2,
      'apr': 3, 'april': 3, 'may': 4, 'jun': 5, 'june': 5,
      'jul': 6, 'july': 6, 'aug': 7, 'august': 7, 'sep': 8, 'sept': 8, 'september': 8,
      'oct': 9, 'october': 9, 'nov': 10, 'november': 10, 'dec': 11, 'december': 11
    };

    // Pattern: "Jan 5, 2026 - Mar 9, 2026" or "January 5, 2026 - March 9, 2026" (each date has year)
    // This format is used by ActiveNetwork API
    const fullDateRangePattern = /([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})\s*[-–—to]+\s*([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})/i;
    const fullDateMatch = fullText.match(fullDateRangePattern);
    if (fullDateMatch) {
      const startMonth = months[fullDateMatch[1].toLowerCase()];
      const startDay = parseInt(fullDateMatch[2]);
      const startYear = parseInt(fullDateMatch[3]);
      const endMonth = months[fullDateMatch[4].toLowerCase()];
      const endDay = parseInt(fullDateMatch[5]);
      const endYear = parseInt(fullDateMatch[6]);

      if (startMonth !== undefined && endMonth !== undefined) {
        return {
          start: new Date(startYear, startMonth, startDay),
          end: new Date(endYear, endMonth, endDay)
        };
      }
    }

    // Pattern: "12-Jan-2026 - 09-Feb-2026" or "12 Jan 2026 - 09 Feb 2026" (DD-Mon-YYYY format)
    // This format is used by some PerfectMind providers
    const ddMonYYYYPattern = /(\d{1,2})[-\s]([a-z]+)[-\s](\d{4})\s*[-–—to]+\s*(\d{1,2})[-\s]([a-z]+)[-\s](\d{4})/i;
    const ddMonYYYYMatch = fullText.match(ddMonYYYYPattern);
    if (ddMonYYYYMatch) {
      const startDay = parseInt(ddMonYYYYMatch[1]);
      const startMonth = months[ddMonYYYYMatch[2].toLowerCase()];
      const startYear = parseInt(ddMonYYYYMatch[3]);
      const endDay = parseInt(ddMonYYYYMatch[4]);
      const endMonth = months[ddMonYYYYMatch[5].toLowerCase()];
      const endYear = parseInt(ddMonYYYYMatch[6]);

      if (startMonth !== undefined && endMonth !== undefined) {
        return {
          start: new Date(startYear, startMonth, startDay),
          end: new Date(endYear, endMonth, endDay)
        };
      }
    }

    // Pattern: "January 6 - March 24, 2025" or "Jan 6 - Mar 24, 2025"
    const namedDateRangePattern = /([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*[-–—to]+\s*([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:[,\s]+(\d{4}))?/i;
    const namedMatch = fullText.match(namedDateRangePattern);
    if (namedMatch) {
      const startMonth = months[namedMatch[1].toLowerCase()];
      const startDay = parseInt(namedMatch[2]);
      const endMonth = months[namedMatch[3].toLowerCase()];
      const endDay = parseInt(namedMatch[4]);
      const year = namedMatch[5] ? parseInt(namedMatch[5]) : new Date().getFullYear();

      if (startMonth !== undefined && endMonth !== undefined) {
        return {
          start: new Date(year, startMonth, startDay),
          end: new Date(endMonth < startMonth ? year + 1 : year, endMonth, endDay)
        };
      }
    }

    // Pattern: "Jan 6 - 24" (same month)
    const sameMonthPattern = /([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*[-–—to]+\s*(\d{1,2})(?:st|nd|rd|th)?(?:[,\s]+(\d{4}))?/i;
    const sameMonthMatch = fullText.match(sameMonthPattern);
    if (sameMonthMatch && !namedMatch) {
      const month = months[sameMonthMatch[1].toLowerCase()];
      const startDay = parseInt(sameMonthMatch[2]);
      const endDay = parseInt(sameMonthMatch[3]);
      const year = sameMonthMatch[4] ? parseInt(sameMonthMatch[4]) : new Date().getFullYear();

      if (month !== undefined) {
        return {
          start: new Date(year, month, startDay),
          end: new Date(year, month, endDay)
        };
      }
    }

    // Pattern: "01/06/2025 - 03/24/2025" or "1/6/25 - 3/24/25"
    const numericDatePattern = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*[-–—to]+\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/;
    const numericMatch = fullText.match(numericDatePattern);
    if (numericMatch) {
      const startYear = numericMatch[3].length === 2 ? 2000 + parseInt(numericMatch[3]) : parseInt(numericMatch[3]);
      const endYear = numericMatch[6].length === 2 ? 2000 + parseInt(numericMatch[6]) : parseInt(numericMatch[6]);
      return {
        start: new Date(startYear, parseInt(numericMatch[1]) - 1, parseInt(numericMatch[2])),
        end: new Date(endYear, parseInt(numericMatch[4]) - 1, parseInt(numericMatch[5]))
      };
    }

    // Single date pattern: "January 6, 2025" or "Jan 6"
    const singleDatePattern = /([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:[,\s]+(\d{4}))?/i;
    const singleMatch = fullText.match(singleDatePattern);
    if (singleMatch) {
      const month = months[singleMatch[1].toLowerCase()];
      const day = parseInt(singleMatch[2]);
      const year = singleMatch[3] ? parseInt(singleMatch[3]) : new Date().getFullYear();

      if (month !== undefined) {
        const date = new Date(year, month, day);
        return { start: date, end: date };
      }
    }

    return null;
  }

  /**
   * Extract location name from raw activity text
   * @param {Object} rawActivity - Raw activity data
   * @returns {String|null} - Location name or null
   */
  static extractLocationFromText(rawActivity) {
    const textFields = [
      rawActivity.location,
      rawActivity.venue,
      rawActivity.facility,
      rawActivity.rawText,
      rawActivity.description
    ].filter(Boolean);

    const fullText = textFields.join(' ');

    for (const pattern of this.LOCATION_PATTERNS) {
      const match = fullText.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Check for common facility keywords
    const facilityPatterns = [
      /([A-Z][a-zA-Z\s]+(?:Recreation Centre|Community Centre|Arena|Pool|Park|Hall|Gymnasium))/,
      /([A-Z][a-zA-Z\s]+(?:Rec Centre|Comm Centre|Sports Centre))/i
    ];

    for (const pattern of facilityPatterns) {
      const match = fullText.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Clean and normalize description text
   * @param {String} description - Raw description text
   * @param {Number} maxLength - Maximum length (default 500)
   * @returns {String} - Cleaned description
   */
  static cleanDescription(description, maxLength = 500) {
    if (!description) return '';

    let cleaned = description
      // Remove HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Remove multiple whitespace
      .replace(/\s+/g, ' ')
      // Remove leading/trailing whitespace
      .trim();

    // Truncate if needed
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength - 3) + '...';
    }

    return cleaned;
  }

  /**
   * Extract cost from text with multiple cost handling
   * @param {String} text - Text containing cost information
   * @returns {Number} - Extracted cost (takes the primary/base cost)
   */
  static extractCostFromText(text) {
    if (!text) return 0;

    const textStr = String(text).toLowerCase();

    // Handle "free" activities
    if (textStr.includes('free') || textStr.includes('no cost') || textStr.includes('no charge')) {
      return 0;
    }

    // Extract all dollar amounts
    const costPattern = /\$\s*([\d,]+(?:\.\d{2})?)/g;
    const costs = [];
    let match;
    while ((match = costPattern.exec(textStr)) !== null) {
      const amount = parseFloat(match[1].replace(',', ''));
      if (!isNaN(amount)) {
        costs.push(amount);
      }
    }

    if (costs.length === 0) return 0;

    // If multiple costs, take the first one (usually the base price)
    // unless one is labeled as "resident" which is typically lower
    if (textStr.includes('resident')) {
      return Math.min(...costs);
    }

    return costs[0];
  }

  /**
   * Validate and enhance activity data for completeness
   * @param {Object} activity - Activity to validate
   * @returns {Object} - Validation result with completeness score
   */
  static validateCompleteness(activity) {
    const requiredFields = ['name', 'externalId', 'category'];
    const importantFields = ['dateStart', 'dateEnd', 'startTime', 'endTime', 'dayOfWeek', 'cost', 'ageMin', 'ageMax', 'locationName', 'description'];

    const missing = {
      required: requiredFields.filter(f => !activity[f]),
      important: importantFields.filter(f => {
        if (f === 'dayOfWeek') return !activity[f] || activity[f].length === 0;
        if (f === 'cost') return activity[f] === undefined || activity[f] === null;
        return !activity[f];
      })
    };

    const totalFields = requiredFields.length + importantFields.length;
    const presentFields = totalFields - missing.required.length - missing.important.length;
    const completeness = Math.round((presentFields / totalFields) * 100);

    return {
      isValid: missing.required.length === 0,
      completeness,
      missing
    };
  }
}

module.exports = DataNormalizer;