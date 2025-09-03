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

    // Mark all existing activities as not updated initially (for this scrape run)
    await this.prisma.activity.updateMany({
      where: { providerId },
      data: { 
        isUpdated: false,
        // Keep isActive for backward compatibility during migration
        isActive: false
      }
    });

    // Process each activity
    for (const activity of activities) {
      try {
        // Get activity type and subtype mappings
        const { activityTypeId, activitySubtypeId } = await mapActivityType(activity);
        
        // Add type mappings to activity data
        const activityWithTypes = {
          ...activity,
          activityTypeId,
          activitySubtypeId
        };
        
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
                isActive: true,   // Keep for backward compatibility
                lastSeenAt: new Date(),
                updatedAt: new Date()
              }
            });
            
            stats.updated++;
            stats.changedActivities.push({
              name: updated.name,
              changes: hasChanges.changes
            });
          } else {
            // No changes, but still update timestamps
            await this.prisma.activity.update({
              where: { id: existingActivity.id },
              data: {
                isUpdated: false,  // No fields changed, keep as not updated
                isActive: true,    // Keep for backward compatibility
                lastSeenAt: new Date(),
                updatedAt: new Date()  // Always update timestamp
              }
            });
            stats.unchanged++;
          }
        } else {
          // Create new activity
          const created = await this.prisma.activity.create({
            data: {
              ...activityWithTypes,
              providerId,
              isUpdated: false,  // New activities start as not updated
              isActive: true,    // Keep for backward compatibility
              lastSeenAt: new Date(),
              updatedAt: new Date()  // Set initial timestamp
            }
          });
          
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

    // Count removed activities (still marked as inactive)
    stats.removed = await this.prisma.activity.count({
      where: {
        providerId,
        isActive: false
      }
    });

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
   * Find or create location in database
   * @param {Object} locationData - Location information
   * @returns {Object} - Location record
   */
  async findOrCreateLocation(locationData) {
    if (!locationData.name) return null;

    // Try to find existing location
    let location = await this.prisma.location.findFirst({
      where: { name: locationData.name }
    });

    if (!location) {
      // Create new location
      location = await this.prisma.location.create({
        data: {
          name: locationData.name,
          address: locationData.address || '',
          city: locationData.city || 'Unknown',
          province: locationData.province || 'BC',
          postalCode: locationData.postalCode || '',
          country: 'Canada',
          facility: locationData.facility || 'Community Facility',
          latitude: locationData.latitude,
          longitude: locationData.longitude
        }
      });
      
      console.log(`📍 Created new location: ${location.name}`);
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