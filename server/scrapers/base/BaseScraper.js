const { PrismaClient } = require('../../generated/prisma');
const { mapActivityType, loadTypesCache } = require('../../utils/activityTypeMapper');
const { findPotentialDuplicates, normalizeString } = require('../utils/stableIdGenerator');

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
      errors: 0,
      potentialDuplicates: 0
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

    // Filter out adult/senior activities
    const originalCount = activities.length;
    activities = activities.filter(activity => {
      const name = (activity.name || '').toLowerCase();
      const description = (activity.description || '').toLowerCase();
      const isAdultSenior = name.includes('adult') || name.includes('senior') ||
                           description.includes('adult') || description.includes('senior');
      return !isAdultSenior;
    });

    if (activities.length < originalCount) {
      console.log(`🚫 Filtered out ${originalCount - activities.length} adult/senior activities`);
    }

    console.log(`💾 Saving ${activities.length} activities to database...`);

    // Track IDs of activities processed in this scrape run
    const processedActivityIds = [];

    // Process each activity
    for (const activity of activities) {
      try {
        // Get activity type and subtype mappings
        const { activityTypeId, activitySubtypeId, isIndoor } = await mapActivityType(activity);

        // Find or create location if locationName is provided
        let locationId = activity.locationId;
        if (!locationId && activity.locationName) {
          try {
            const location = await this.findOrCreateLocation({
              name: activity.locationName,
              city: activity.city || this.config?.city,
              province: activity.province || this.config?.province || 'BC',
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

        // Add type mappings, locationId, and isIndoor to activity data and sanitize for database
        const activityWithTypes = this.sanitizeActivityData({
          ...activity,
          activityTypeId,
          activitySubtypeId,
          locationId,
          isIndoor
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
          // Filter out manually edited fields from the update data
          // These fields should not be overwritten by the scraper
          const manuallyEditedFields = existingActivity.manuallyEditedFields || [];
          const filteredActivityData = { ...activityWithTypes };

          if (manuallyEditedFields.length > 0) {
            for (const field of manuallyEditedFields) {
              if (field in filteredActivityData) {
                delete filteredActivityData[field];
              }
            }
            console.log(`🔒 Protected ${manuallyEditedFields.length} manually edited field(s) for "${activity.name}": ${manuallyEditedFields.join(', ')}`);
          }

          // Check for changes (only comparing fields that will be updated)
          const hasChanges = this.detectActivityChanges(existingActivity, filteredActivityData);

          if (hasChanges.changed) {
            // Update existing activity - fields were modified
            const updated = await this.prisma.activity.update({
              where: { id: existingActivity.id },
              data: {
                ...filteredActivityData,
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

            // Log the specific changes detected
            const changesStr = hasChanges.changes.map(c => `${c.field}: "${c.oldValue}" → "${c.newValue}"`).join(', ');
            console.log(`📝 UPDATED: "${updated.name}" [${updated.externalId}] - ${changesStr}`);
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
          // Before creating, check for potential duplicates (renamed activities)
          // This helps catch cases where an activity's name changed but it's the same activity
          const recentlyDeactivated = await this.prisma.activity.findMany({
            where: {
              providerId,
              isActive: false,
              updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
            },
            select: { id: true, name: true, locationName: true, externalId: true }
          });

          const duplicates = findPotentialDuplicates(activity, recentlyDeactivated, 0.8);

          if (duplicates.length > 0) {
            // Found a potential duplicate - log it and potentially reactivate
            const bestMatch = duplicates[0];
            console.log(`🔍 Potential duplicate detected for "${activity.name}":`);
            console.log(`   → Similar to deactivated: "${bestMatch.existing.name}" (confidence: ${(bestMatch.confidence * 100).toFixed(0)}%)`);
            console.log(`   → Reason: ${bestMatch.reason}`);
            stats.potentialDuplicates++;

            // If high confidence match, reactivate the old activity and update it
            if (bestMatch.confidence >= 0.9) {
              console.log(`   → Reactivating and updating existing activity`);
              const reactivated = await this.prisma.activity.update({
                where: { id: bestMatch.existing.id },
                data: {
                  ...activityWithTypes,
                  isActive: true,
                  isUpdated: true,
                  lastSeenAt: new Date(),
                  updatedAt: new Date()
                }
              });
              processedActivityIds.push(reactivated.id);
              stats.updated++;
              stats.changedActivities.push({
                name: reactivated.name,
                changes: [{ field: 'reactivated', oldValue: bestMatch.existing.name, newValue: activity.name }]
              });
              continue; // Skip creating new activity
            }
          }

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
            externalId: created.externalId,
            category: created.category,
            subcategory: created.subcategory,
            cost: created.cost
          });
          console.log(`✨ NEW: "${created.name}" [${created.externalId}] - ${created.category}`);
        }
      } catch (error) {
        console.error(`Error saving activity ${activity.name}:`, error.message);
        stats.errors++;
      }
    }

    // AFTER all activities are processed, mark activities NOT in this run as inactive
    // SAFEGUARD: Only deactivate if we got a reasonable number of activities
    // This prevents mass deactivation when a scraper fails or returns empty results
    const currentActiveCount = await this.prisma.activity.count({
      where: { providerId, isActive: true }
    });

    const minRequiredActivities = Math.max(10, Math.floor(currentActiveCount * 0.1));
    const shouldDeactivate = activities.length >= minRequiredActivities || currentActiveCount < 10;

    if (shouldDeactivate) {
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
    } else {
      console.warn(`⚠️  SAFEGUARD: Skipping deactivation - only ${activities.length} activities returned vs ${currentActiveCount} currently active (need at least ${minRequiredActivities})`);
      stats.removed = 0;
    }

    console.log(`✅ Database save complete: +${stats.created} ~${stats.updated} =${stats.unchanged} -${stats.removed} 🔍${stats.potentialDuplicates || 0} ✗${stats.errors}`);

    // Print summary of new and changed activities
    if (stats.created > 0 && stats.newActivities.length > 0) {
      console.log(`\n📊 NEW ACTIVITIES SUMMARY (${stats.created} total):`);
      const sampleNew = stats.newActivities.slice(0, 10);
      sampleNew.forEach(a => console.log(`   ✨ ${a.name} [${a.externalId}] - ${a.category}`));
      if (stats.newActivities.length > 10) {
        console.log(`   ... and ${stats.newActivities.length - 10} more`);
      }
    }

    if (stats.updated > 0 && stats.changedActivities.length > 0) {
      console.log(`\n📊 CHANGED ACTIVITIES SUMMARY (${stats.updated} total):`);
      const sampleChanged = stats.changedActivities.slice(0, 10);
      sampleChanged.forEach(a => {
        const fields = a.changes.map(c => c.field).join(', ');
        console.log(`   📝 ${a.name} - changed: ${fields}`);
      });
      if (stats.changedActivities.length > 10) {
        console.log(`   ... and ${stats.changedActivities.length - 10} more`);
      }
    }

    if (stats.removed > 0) {
      console.log(`\n⚠️  DEACTIVATED: ${stats.removed} activities no longer found in source`);
    }

    return stats;
  }

  /**
   * OPTIMIZED: Save activities to database using batch operations
   * Much faster for large datasets (1000+ activities)
   * @param {Array} activities - Array of normalized activity objects
   * @param {String} providerId - Provider ID in database
   * @returns {Object} - Statistics about the save operation
   */
  async saveActivitiesToDatabaseBatch(activities, providerId) {
    const stats = {
      created: 0,
      updated: 0,
      unchanged: 0,
      removed: 0,
      errors: 0,
      potentialDuplicates: 0,
      newActivities: [],
      changedActivities: []
    };

    // Filter out adult/senior activities
    const originalCount = activities.length;
    activities = activities.filter(activity => {
      const name = (activity.name || '').toLowerCase();
      const description = (activity.description || '').toLowerCase();
      const isAdultSenior = name.includes('adult') || name.includes('senior') ||
                           description.includes('adult') || description.includes('senior');
      return !isAdultSenior;
    });

    if (activities.length < originalCount) {
      console.log(`🚫 Filtered out ${originalCount - activities.length} adult/senior activities`);
    }

    console.log(`💾 Batch saving ${activities.length} activities to database...`);
    const startTime = Date.now();

    // Step 1: Pre-load type cache (one-time DB call)
    console.log('  📦 Loading activity type cache...');
    await loadTypesCache();

    // Step 2: Pre-fetch ALL existing activities for this provider (one query)
    console.log('  📦 Fetching existing activities...');
    const existingActivities = await this.prisma.activity.findMany({
      where: { providerId },
      select: {
        id: true,
        externalId: true,
        name: true,
        description: true,
        schedule: true,
        cost: true,
        spotsAvailable: true,
        registrationStatus: true,
        instructor: true,
        startTime: true,
        endTime: true,
        totalSpots: true,
        fullDescription: true,
        activityTypeId: true,
        activitySubtypeId: true,
        dateStart: true,
        dateEnd: true,
        manuallyEditedFields: true
      }
    });

    // Create a map for O(1) lookups
    const existingMap = new Map();
    for (const activity of existingActivities) {
      existingMap.set(activity.externalId, activity);
    }
    console.log(`  📊 Found ${existingActivities.length} existing activities`);

    // Step 3: Pre-fetch and cache locations (batch lookup)
    console.log('  📍 Processing locations...');
    const uniqueLocationNames = [...new Set(
      activities
        .filter(a => a.locationName && !a.locationId)
        .map(a => a.locationName.replace(/^(the|at|@)\s+/i, '').trim())
        .filter(name => name)
    )];

    // Fetch all existing locations in one query
    const existingLocations = await this.prisma.location.findMany({
      where: {
        name: { in: uniqueLocationNames, mode: 'insensitive' }
      }
    });

    const locationMap = new Map();
    for (const loc of existingLocations) {
      locationMap.set(loc.name.toLowerCase(), loc);
    }

    // Find locations that need to be created
    const locationsToCreate = [];
    for (const name of uniqueLocationNames) {
      if (!locationMap.has(name.toLowerCase())) {
        locationsToCreate.push({
          name: name,
          city: this.config?.city || 'Unknown',
          province: this.config?.province || 'BC',
          country: 'Canada',
          facility: 'Community Facility'
        });
      }
    }

    // Batch create missing locations
    if (locationsToCreate.length > 0) {
      console.log(`  📍 Creating ${locationsToCreate.length} new locations...`);
      await this.prisma.location.createMany({
        data: locationsToCreate,
        skipDuplicates: true
      });

      // Refresh location map
      const newLocations = await this.prisma.location.findMany({
        where: { name: { in: locationsToCreate.map(l => l.name), mode: 'insensitive' } }
      });
      for (const loc of newLocations) {
        locationMap.set(loc.name.toLowerCase(), loc);
      }
    }

    // Step 4: Process activities in batches
    const BATCH_SIZE = 100;
    const processedActivityIds = [];
    let processedCount = 0;

    console.log(`  🔄 Processing activities in batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < activities.length; i += BATCH_SIZE) {
      const batch = activities.slice(i, i + BATCH_SIZE);
      const toCreate = [];
      const toUpdate = [];
      const toUnchange = [];

      for (const activity of batch) {
        try {
          // Get activity type mapping (uses cached values)
          const { activityTypeId, activitySubtypeId, isIndoor } = await mapActivityType(activity);

          // Get location ID from cache
          let locationId = activity.locationId;
          if (!locationId && activity.locationName) {
            const cleanedName = activity.locationName.replace(/^(the|at|@)\s+/i, '').trim();
            const cachedLocation = locationMap.get(cleanedName.toLowerCase());
            if (cachedLocation) {
              locationId = cachedLocation.id;
            }
          }

          // Prepare activity data
          const activityData = this.sanitizeActivityData({
            ...activity,
            activityTypeId,
            activitySubtypeId,
            locationId,
            isIndoor
          });

          // Check if activity exists
          const existing = existingMap.get(activity.externalId);

          if (existing) {
            // Filter out manually edited fields
            const manuallyEditedFields = existing.manuallyEditedFields || [];
            const filteredData = { ...activityData };
            for (const field of manuallyEditedFields) {
              if (field in filteredData) {
                delete filteredData[field];
              }
            }

            // Check for changes
            const hasChanges = this.detectActivityChanges(existing, filteredData);

            if (hasChanges.changed) {
              toUpdate.push({
                id: existing.id,
                data: {
                  ...filteredData,
                  isUpdated: true,
                  isActive: true,
                  lastSeenAt: new Date(),
                  updatedAt: new Date()
                },
                changes: hasChanges.changes
              });
            } else {
              toUnchange.push(existing.id);
            }
            processedActivityIds.push(existing.id);
          } else {
            toCreate.push({
              ...activityData,
              providerId,
              isUpdated: false,
              isActive: true,
              lastSeenAt: new Date(),
              updatedAt: new Date()
            });
          }
        } catch (error) {
          console.error(`Error processing activity ${activity.name}:`, error.message);
          stats.errors++;
        }
      }

      // Execute batch operations using transaction
      try {
        await this.prisma.$transaction(async (tx) => {
          // Batch create new activities
          if (toCreate.length > 0) {
            const created = await tx.activity.createMany({
              data: toCreate,
              skipDuplicates: true
            });
            stats.created += created.count;
          }

          // Batch update changed activities
          for (const item of toUpdate) {
            await tx.activity.update({
              where: { id: item.id },
              data: item.data
            });
            stats.updated++;
            stats.changedActivities.push({
              name: item.data.name,
              changes: item.changes
            });
          }

          // Batch update unchanged activities (just timestamps)
          if (toUnchange.length > 0) {
            await tx.activity.updateMany({
              where: { id: { in: toUnchange } },
              data: {
                isUpdated: false,
                isActive: true,
                lastSeenAt: new Date(),
                updatedAt: new Date()
              }
            });
            stats.unchanged += toUnchange.length;
          }
        });

        // Get IDs of newly created activities
        if (toCreate.length > 0) {
          const newActivities = await this.prisma.activity.findMany({
            where: {
              providerId,
              externalId: { in: toCreate.map(a => a.externalId) }
            },
            select: { id: true, name: true, category: true, subcategory: true, cost: true }
          });
          for (const a of newActivities) {
            processedActivityIds.push(a.id);
            stats.newActivities.push({
              name: a.name,
              category: a.category,
              subcategory: a.subcategory,
              cost: a.cost
            });
          }
        }
      } catch (txError) {
        console.error(`Transaction error for batch:`, txError.message);
        stats.errors += batch.length;
      }

      processedCount += batch.length;
      if (processedCount % 500 === 0 || processedCount === activities.length) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  ⏳ Processed ${processedCount}/${activities.length} (${elapsed}s)`);
      }
    }

    // Step 5: Mark activities NOT in this run as inactive
    // SAFEGUARD: Only deactivate if we got a reasonable number of activities
    const currentActiveCount = await this.prisma.activity.count({
      where: { providerId, isActive: true }
    });

    const minRequiredActivities = Math.max(10, Math.floor(currentActiveCount * 0.1));
    const shouldDeactivate = activities.length >= minRequiredActivities || currentActiveCount < 10;

    if (shouldDeactivate) {
      const inactiveResult = await this.prisma.activity.updateMany({
        where: {
          providerId,
          id: { notIn: processedActivityIds },
          isActive: true
        },
        data: {
          isActive: false,
          updatedAt: new Date()
        }
      });
      stats.removed = inactiveResult.count;
    } else {
      console.warn(`⚠️  SAFEGUARD: Skipping deactivation - only ${activities.length} activities returned vs ${currentActiveCount} currently active (need at least ${minRequiredActivities})`);
      stats.removed = 0;
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Batch save complete in ${totalTime}s: +${stats.created} ~${stats.updated} =${stats.unchanged} -${stats.removed} 🔍${stats.potentialDuplicates || 0} ✗${stats.errors}`);

    // Print summary of new and changed activities
    if (stats.created > 0 && stats.newActivities.length > 0) {
      console.log(`\n📊 NEW ACTIVITIES SUMMARY (${stats.created} total):`);
      const sampleNew = stats.newActivities.slice(0, 10);
      sampleNew.forEach(a => console.log(`   ✨ ${a.name} [${a.externalId || 'no-id'}] - ${a.category}`));
      if (stats.newActivities.length > 10) {
        console.log(`   ... and ${stats.newActivities.length - 10} more`);
      }
    }

    if (stats.updated > 0 && stats.changedActivities.length > 0) {
      console.log(`\n📊 CHANGED ACTIVITIES SUMMARY (${stats.updated} total):`);
      const sampleChanged = stats.changedActivities.slice(0, 10);
      sampleChanged.forEach(a => {
        const fields = a.changes.map(c => c.field).join(', ');
        console.log(`   📝 ${a.name} - changed: ${fields}`);
      });
      if (stats.changedActivities.length > 10) {
        console.log(`   ... and ${stats.changedActivities.length - 10} more`);
      }
    }

    if (stats.removed > 0) {
      console.log(`\n⚠️  DEACTIVATED: ${stats.removed} activities no longer found in source`);
    }

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
    const province = locationData.province || this.config?.province || 'BC';

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
   * Clean up resources including Puppeteer temp directories
   */
  async cleanup() {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }

    // Clean up old Puppeteer temp directories to prevent disk filling
    await this.cleanupPuppeteerTempDirs();
  }

  /**
   * Clean up Puppeteer temporary directories older than 1 hour
   * These accumulate in /tmp and can fill up disk space
   */
  async cleanupPuppeteerTempDirs() {
    const fs = require('fs').promises;
    const path = require('path');
    const os = require('os');

    try {
      const tmpDir = os.tmpdir();
      const files = await fs.readdir(tmpDir);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      let cleaned = 0;

      for (const file of files) {
        // Match Puppeteer temp directory patterns
        if (!file.startsWith('puppeteer') &&
            !file.startsWith('.org.chromium') &&
            !file.startsWith('.com.google.Chrome')) {
          continue;
        }

        const filePath = path.join(tmpDir, file);
        try {
          const stats = await fs.stat(filePath);
          if (stats.isDirectory() && stats.mtimeMs < oneHourAgo) {
            await fs.rm(filePath, { recursive: true, force: true });
            cleaned++;
          }
        } catch (e) {
          // Ignore errors for individual files
        }
      }

      if (cleaned > 0) {
        this.logProgress(`Cleaned up ${cleaned} old Puppeteer temp directories`);
      }
    } catch (error) {
      // Silently ignore cleanup errors - not critical
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