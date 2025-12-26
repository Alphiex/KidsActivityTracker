const { PrismaClient } = require('../../generated/prisma');
const { mapActivityType } = require('../../utils/activityTypeMapper');

/**
 * Abstract base class for all scrapers in the Kids Activity Tracker system.
 * Provides common functionality and enforces interface compliance.
 */
class BaseScraper {
  constructor(config) {
    if (new.target === BaseScraper) {
      throw new TypeError('Cannot construct BaseScraper instances directly');
    }
    
    this.config = config;
    this.prisma = new PrismaClient();
    this.activities = [];
    this.stats = {
      created: 0,
      updated: 0,
      unchanged: 0,
      removed: 0,
      errors: 0
    };
  }

  /**
   * Main scraping method - must be implemented by subclasses
   * @returns {Promise<{activities: Array, stats: Object, report: String}>}
   */
  async scrape() {
    throw new Error('scrape() method must be implemented by subclass');
  }

  /**
   * Validate the scraper configuration
   * @returns {boolean}
   */
  validateConfig() {
    const required = ['name', 'code', 'platform', 'baseUrl'];
    for (const field of required) {
      if (!this.config[field]) {
        throw new Error(`Missing required config field: ${field}`);
      }
    }
    return true;
  }

  /**
   * Get provider information
   * @returns {Object}
   */
  getProviderInfo() {
    return {
      name: this.config.name,
      code: this.config.code,
      platform: this.config.platform,
      baseUrl: this.config.baseUrl
    };
  }

  /**
   * Sanitize activity data to only include valid database fields
   * @param {Object} activity - Activity data to sanitize
   * @returns {Object} - Sanitized activity data
   */
  sanitizeActivityData(activity) {
    // Valid database fields from schema
    const validFields = [
      'name', 'externalId', 'category', 'subcategory', 'description',
      'schedule', 'dateStart', 'dateEnd', 'registrationDate', 'ageMin', 'ageMax',
      'cost', 'spotsAvailable', 'totalSpots', 'locationId', 'locationName', 'registrationUrl',
      'courseId', 'dayOfWeek', 'registrationEndDate', 'registrationEndTime',
      'costIncludesTax', 'taxAmount', 'startTime', 'endTime', 'courseDetails',
      'dates', 'registrationStatus', 'registrationButtonText', 'detailUrl',
      'instructor', 'hasMultipleSessions', 'sessionCount', 'hasPrerequisites',
      'fullDescription', 'whatToBring', 'prerequisites', 'directRegistrationUrl',
      'contactInfo', 'activitySubtypeId', 'activityTypeId', 'rawData',
      'latitude', 'longitude', 'fullAddress'
    ];

    const sanitized = {};
    for (const field of validFields) {
      if (activity[field] !== undefined) {
        sanitized[field] = activity[field];
      }
    }

    return sanitized;
  }

  /**
   * Save activities to database with create/update/deactivate logic
   * @param {Array} activities - Array of normalized activity objects
   * @param {String} providerId - Provider ID in database
   * @returns {Object} - Statistics about the save operation
   */
  async saveActivitiesToDatabase(activities, providerId) {
    const stats = {
      created: 0,
      updated: 0,
      unchanged: 0,
      removed: 0,
      errors: 0,
      newActivities: [],
      changedActivities: []
    };

    console.log(`💾 Saving ${activities.length} activities to database...`);

    // Track IDs of activities processed in this scrape run
    const processedActivityIds = [];

    // Process each activity
    for (const activity of activities) {
      try {
        // Get activity type and subtype mappings
        const { activityTypeId, activitySubtypeId } = await mapActivityType(activity);

        // Find or create location if locationName is provided
        let locationId = activity.locationId;
        if (!locationId && activity.locationName) {
          try {
            const location = await this.findOrCreateLocation({
              name: activity.locationName,
              city: activity.city || this.config?.city,
              province: activity.province || 'BC',
              address: activity.address,
              fullAddress: activity.fullAddress,
              latitude: activity.latitude,
              longitude: activity.longitude
            });
            if (location) {
              locationId = location.id;
            }
          } catch (locError) {
            console.warn(`⚠️  Could not create location for "${activity.locationName}":`, locError.message);
          }
        }

        // Add type mappings and locationId to activity data and sanitize for database
        const activityWithTypes = this.sanitizeActivityData({
          ...activity,
          activityTypeId,
          activitySubtypeId,
          locationId
        });

        // Find existing activity
        const existingActivity = await this.prisma.activity.findUnique({
          where: {
            providerId_externalId: {
              providerId,
              externalId: activity.externalId
            }
          }
        });

        if (existingActivity) {
          // Check for changes
          const hasChanges = this.detectActivityChanges(existingActivity, activityWithTypes);

          if (hasChanges.changed) {
            // Update existing activity - fields were modified
            const updated = await this.prisma.activity.update({
              where: { id: existingActivity.id },
              data: {
                ...activityWithTypes,
                isUpdated: true,  // Mark as updated since fields changed
                isActive: true,   // Activity is active (seen in this scrape)
                lastSeenAt: new Date(),
                updatedAt: new Date()
              }
            });

            processedActivityIds.push(updated.id);
            stats.updated++;
            stats.changedActivities.push({
              name: updated.name,
              changes: hasChanges.changes
            });
          } else {
            // No changes, but still update timestamps and keep active
            const updated = await this.prisma.activity.update({
              where: { id: existingActivity.id },
              data: {
                isUpdated: false,  // No fields changed
                isActive: true,    // Activity is active (seen in this scrape)
                lastSeenAt: new Date(),
                updatedAt: new Date()
              }
            });
            processedActivityIds.push(updated.id);
            stats.unchanged++;
          }
        } else {
          // Create new activity
          const created = await this.prisma.activity.create({
            data: {
              ...activityWithTypes,
              providerId,
              isUpdated: false,  // New activities start as not updated
              isActive: true,    // New activities are active
              lastSeenAt: new Date(),
              updatedAt: new Date()
            }
          });

          processedActivityIds.push(created.id);
          stats.created++;
          stats.newActivities.push({
            name: created.name,
            category: created.category,
            subcategory: created.subcategory,
            cost: created.cost
          });
        }
      } catch (error) {
        console.error(`Error saving activity ${activity.name}:`, error.message);
        stats.errors++;
      }
    }

    // AFTER all activities are processed, mark activities NOT in this run as inactive
    // This matches the original NVRC scraper logic - safer because if scraper crashes,
    // existing activities remain active until a successful scrape completes
    const inactiveResult = await this.prisma.activity.updateMany({
      where: {
        providerId,
        id: { notIn: processedActivityIds },
        isActive: true  // Only deactivate currently active activities
      },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });

    stats.removed = inactiveResult.count;

    console.log(`✅ Database save complete: +${stats.created} ~${stats.updated} =${stats.unchanged} -${stats.removed} ✗${stats.errors}`);

    return stats;
  }

  /**
   * Detect changes between existing and new activity data
   * @param {Object} existing - Existing activity from database
   * @param {Object} newData - New activity data
   * @returns {Object} - Change detection result
   */
  detectActivityChanges(existing, newData) {
    const fieldsToCompare = [
      'name', 'description', 'schedule', 'cost', 'spotsAvailable',
      'registrationStatus', 'instructor', 'startTime', 'endTime',
      'totalSpots', 'fullDescription', 'activityTypeId', 'activitySubtypeId'
    ];

    const changes = [];
    let changed = false;

    for (const field of fieldsToCompare) {
      if (existing[field] !== newData[field]) {
        changed = true;
        changes.push({
          field,
          oldValue: existing[field],
          newValue: newData[field]
        });
      }
    }

    // Check date changes
    if (existing.dateStart?.getTime() !== newData.dateStart?.getTime() ||
        existing.dateEnd?.getTime() !== newData.dateEnd?.getTime()) {
      changed = true;
      changes.push({
        field: 'dates',
        oldValue: `${existing.dateStart} - ${existing.dateEnd}`,
        newValue: `${newData.dateStart} - ${newData.dateEnd}`
      });
    }

    return { changed, changes };
  }

  /**
   * Find or create a City record
   * @param {String} cityName - City name
   * @param {String} province - Province code (default: BC)
   * @returns {Object} - City record or null
   */
  async findOrCreateCity(cityName, province = 'BC') {
    if (!cityName || cityName === 'Unknown') return null;

    // Try to find existing city (case-insensitive)
    let city = await this.prisma.city.findFirst({
      where: {
        name: { equals: cityName, mode: 'insensitive' }
      }
    });

    if (!city) {
      // Create new city
      try {
        city = await this.prisma.city.create({
          data: {
            name: cityName,
            province: province,
            country: 'Canada'
          }
        });
        console.log(`🏙️  Created new city: ${city.name}, ${city.province}`);
      } catch (error) {
        // Handle race condition - city might have been created by another process
        if (error.code === 'P2002') {
          city = await this.prisma.city.findFirst({
            where: { name: { equals: cityName, mode: 'insensitive' } }
          });
        } else {
          throw error;
        }
      }
    }

    return city;
  }

  /**
   * Find or create location in database and link to city
   * @param {Object} locationData - Location information
   * @returns {Object} - Location record
   */
  async findOrCreateLocation(locationData) {
    if (!locationData.name) return null;

    // Clean the location name
    const cleanedName = locationData.name
      .replace(/^(the|at|@)\s+/i, '')
      .trim();

    if (!cleanedName) return null;

    // Try to find existing location by name (case-insensitive)
    let location = await this.prisma.location.findFirst({
      where: {
        OR: [
          { name: { equals: cleanedName, mode: 'insensitive' } },
          { name: { equals: locationData.name, mode: 'insensitive' } }
        ]
      }
    });

    // Determine city name from location data or config
    const cityName = locationData.city || this.config?.city || 'Unknown';
    const province = locationData.province || 'BC';

    // Find or create the city
    const city = await this.findOrCreateCity(cityName, province);

    if (location) {
      // Update city link if missing
      if (!location.cityId && city) {
        location = await this.prisma.location.update({
          where: { id: location.id },
          data: {
            cityId: city.id,
            city: city.name
          }
        });
        console.log(`🔗 Linked location "${location.name}" to city "${city.name}"`);
      }
      return location;
    }

    // Create new location
    try {
      location = await this.prisma.location.create({
        data: {
          name: cleanedName,
          address: locationData.address || '',
          city: city?.name || cityName,
          province: province,
          postalCode: locationData.postalCode || '',
          country: 'Canada',
          facility: locationData.facility || 'Community Facility',
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          fullAddress: locationData.fullAddress || null,
          cityId: city?.id || null
        }
      });

      console.log(`📍 Created new location: ${location.name} in ${location.city}`);
    } catch (error) {
      // Handle race condition - location might have been created by another process
      if (error.code === 'P2002') {
        location = await this.prisma.location.findFirst({
          where: { name: { equals: cleanedName, mode: 'insensitive' } }
        });
      } else {
        throw error;
      }
    }

    return location;
  }

  /**
   * Generate scraping report
   * @param {Object} stats - Scraping statistics
   * @param {Number} duration - Duration in minutes
   * @returns {String} - Formatted report
   */
  generateReport(stats, duration) {
    const timestamp = new Date().toISOString();
    
    return `
${this.config.name.toUpperCase()} SCRAPER REPORT
${'='.repeat(50)}
Generated: ${timestamp}
Duration: ${duration} minutes
Provider: ${this.config.name}
Platform: ${this.config.platform}

SUMMARY
-------
Total Activities Found: ${this.activities.length}
New Activities Added: ${stats.created}
Activities Updated: ${stats.updated}
Activities Unchanged: ${stats.unchanged}
Activities Removed: ${stats.removed}
Errors: ${stats.errors}

SUCCESS RATE
-----------
${((this.activities.length - stats.errors) / this.activities.length * 100).toFixed(1)}% successful
`;
  }

  /**
   * Log scraping progress
   * @param {String} message - Progress message
   * @param {Object} data - Optional data to log
   */
  logProgress(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.config.code.toUpperCase()}] ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  /**
   * Handle scraper errors with proper logging
   * @param {Error} error - The error that occurred
   * @param {String} context - Context where error occurred
   */
  handleError(error, context) {
    this.stats.errors++;
    const errorMessage = `Error in ${context}: ${error.message}`;
    console.error(`❌ [${this.config.code.toUpperCase()}] ${errorMessage}`);
    console.error(error.stack);
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }

  /**
   * Validate normalized activity data
   * @param {Object} activity - Activity data to validate
   * @returns {Object} - Validation result
   */
  validateActivityData(activity) {
    const errors = [];
    const warnings = [];

    // Required fields
    if (!activity.name) errors.push('Missing activity name');
    if (!activity.externalId) errors.push('Missing external ID');
    if (!activity.category) errors.push('Missing category');
    if (activity.cost === undefined || activity.cost < 0) errors.push('Invalid cost');

    // Date validation
    if (activity.dateStart && activity.dateEnd) {
      if (activity.dateStart > activity.dateEnd) {
        errors.push('Start date is after end date');
      }
    }

    // Age validation
    if (activity.ageMin !== undefined && activity.ageMax !== undefined) {
      if (activity.ageMin < 0 || activity.ageMax < 0) {
        errors.push('Negative age values');
      }
      if (activity.ageMin > activity.ageMax) {
        errors.push('Minimum age is greater than maximum age');
      }
    }

    // Warnings
    if (!activity.description) warnings.push('Missing description');
    if (!activity.locationName) warnings.push('Missing location');
    if (!activity.schedule) warnings.push('Missing schedule');

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

module.exports = BaseScraper;