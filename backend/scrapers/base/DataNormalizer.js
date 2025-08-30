/**
 * Data normalization utilities for standardizing activity data across different platforms
 */
class DataNormalizer {
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
      
      // Demographics
      ageMin: this.normalizeAge(this.mapField(rawActivity, fieldMapping.ageMin)),
      ageMax: this.normalizeAge(this.mapField(rawActivity, fieldMapping.ageMax)),
      
      // Location
      locationName: this.mapField(rawActivity, fieldMapping.locationName),
      fullAddress: this.mapField(rawActivity, fieldMapping.fullAddress),
      
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

    // Parse age range if not provided separately
    if (!normalized.ageMin && !normalized.ageMax) {
      const ageRange = this.extractAgeRange(rawActivity);
      if (ageRange) {
        normalized.ageMin = ageRange.min;
        normalized.ageMax = ageRange.max;
      }
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
      const value = this.getNestedValue(rawData, mapping.path);
      
      if (mapping.transform) {
        return this.applyTransform(value, mapping.transform);
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
   * @returns {*} - Transformed value
   */
  static applyTransform(value, transform) {
    if (!value) return value;
    
    if (typeof transform === 'function') {
      return transform(value);
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
    
    // Try different date formats
    const formats = [
      // ISO format
      /^\d{4}-\d{2}-\d{2}$/,
      // US format MM/DD/YYYY
      /^\d{2}\/\d{2}\/\d{4}$/,
      // US format MM/DD/YY
      /^\d{2}\/\d{2}\/\d{2}$/,
      // Month Day format (e.g., "Sep 15")
      /^[A-Z][a-z]{2}\s+\d{1,2}$/
    ];

    try {
      // Handle MM/DD/YY format specifically
      if (/^\d{2}\/\d{2}\/\d{2}$/.test(dateStr)) {
        const [month, day, year] = dateStr.split('/');
        return new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
      }
      
      // Handle "Month Day" format by adding current year
      if (/^[A-Z][a-z]{2}\s+\d{1,2}$/.test(dateStr)) {
        const currentYear = new Date().getFullYear();
        return new Date(`${dateStr}, ${currentYear}`);
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
   * Extract age range from text
   * @param {Object} rawActivity - Raw activity data
   * @returns {Object|null} - Age range {min, max} or null
   */
  static extractAgeRange(rawActivity) {
    // Look for age information in various fields
    const textFields = [
      rawActivity.name,
      rawActivity.description,
      rawActivity.category,
      rawActivity.subcategory,
      rawActivity.ageRestrictions
    ].filter(Boolean);
    
    const fullText = textFields.join(' ');
    
    // Various age range patterns
    const patterns = [
      /(\d+)\s*-\s*(\d+)\s*(?:years?|yrs?)/i,
      /(\d+)\s*to\s*(\d+)\s*(?:years?|yrs?)/i,
      /ages?\s*(\d+)\s*-\s*(\d+)/i,
      /\((\d+)-(\d+)\s*yrs?\)/i,
      /ages?\s*(\d+)\s*to\s*(\d+)/i
    ];
    
    for (const pattern of patterns) {
      const match = fullText.match(pattern);
      if (match) {
        const min = parseInt(match[1]);
        const max = parseInt(match[2]);
        if (min <= max && min >= 0 && max <= 18) {
          return { min, max };
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
}

module.exports = DataNormalizer;