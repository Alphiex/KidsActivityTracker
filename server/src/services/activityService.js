const prisma = require('../config/database');
const { standardizeSchedule } = require('../utils/dayFormatter');
const { buildActivityWhereClause } = require('../utils/activityFilters');

class ActivityService {
  /**
   * Upsert activities from scraper results
   * @param {Array} activities - Array of scraped activities
   * @param {string} providerId - Provider ID
   * @returns {Object} Summary of operations
   */
  async upsertActivities(activities, providerId) {
    const summary = {
      created: 0,
      updated: 0,
      deactivated: 0,
      errors: []
    };

    // Get all existing activities for this provider
    const existingActivities = await prisma.activity.findMany({
      where: { providerId },
      select: { id: true, externalId: true }
    });

    const existingIds = new Set(existingActivities.map(a => a.externalId));
    const scrapedIds = new Set(activities.map(a => a.id));

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Process each scraped activity
      for (const activity of activities) {
        try {
          // Find or create location
          let locationId = null;
          if (activity.location) {
            const location = await tx.location.upsert({
              where: {
                name_address: {
                  name: activity.location,
                  address: activity.facility || ''
                }
              },
              update: {
                facility: activity.facility
              },
              create: {
                name: activity.location,
                address: activity.facility || '',
                facility: activity.facility,
                city: 'North Vancouver', // Default for NVRC
                province: 'BC'
              }
            });
            locationId = location.id;
          }

          // Helper function to parse dates like "May 21, 2025 9:00am"
          const parseDate = (dateStr) => {
            if (!dateStr) return null;
            try {
              // Try direct parsing first
              const date = new Date(dateStr);
              if (date.toString() !== 'Invalid Date') return date;
              
              // Handle "May 21, 2025 9:00am" format by adding space before am/pm
              const cleanedDate = dateStr.replace(/(\d{1,2}:\d{2})(am|pm)/i, '$1 $2');
              const parsed = new Date(cleanedDate);
              if (parsed.toString() !== 'Invalid Date') return parsed;
              
              // Try manual parsing for formats like "May 22, 2025 7:00am"
              const manualParse = dateStr.match(/(\w+)\s+(\d{1,2}),\s+(\d{4})\s+(\d{1,2}):(\d{2})(am|pm)/i);
              if (manualParse) {
                const [_, month, day, year, hour, minute, ampm] = manualParse;
                const hour24 = ampm.toLowerCase() === 'pm' && hour !== '12' ? parseInt(hour) + 12 : 
                              ampm.toLowerCase() === 'am' && hour === '12' ? 0 : parseInt(hour);
                const dateStr2 = `${month} ${day}, ${year} ${hour24}:${minute}:00`;
                const parsed2 = new Date(dateStr2);
                if (parsed2.toString() !== 'Invalid Date') return parsed2;
              }
              
              return null;
            } catch (error) {
              return null;
            }
          };

          // Prepare activity data
          const activityData = {
            name: activity.name,
            category: activity.category,
            subcategory: activity.subcategory,
            description: activity.alert || activity.description,
            schedule: standardizeSchedule(activity.schedule),
            dateStart: parseDate(activity.dateRange?.start),
            dateEnd: parseDate(activity.dateRange?.end),
            registrationDate: parseDate(activity.registrationDate),
            ageMin: activity.ageRange?.min || 0,
            ageMax: activity.ageRange?.max || 18,
            cost: activity.cost || 0,
            spotsAvailable: activity.spotsAvailable || 0,
            locationId,
            locationName: activity.location,
            registrationUrl: activity.registrationUrl,
            courseId: activity.courseId,
            isActive: true,
            isUpdated: true, // Set both fields for compatibility
            lastSeenAt: new Date(),
            rawData: activity
          };

          // Prepare additional data
          const hasMultipleSessions = activity.sessions && activity.sessions.length > 1;
          const sessionCount = activity.sessions ? activity.sessions.length : 0;
          const hasPrerequisites = activity.prerequisites && activity.prerequisites.length > 0;
          
          // Add new fields to activity data
          activityData.hasMultipleSessions = hasMultipleSessions;
          activityData.sessionCount = sessionCount;
          activityData.hasPrerequisites = hasPrerequisites;
          
          // Add enhanced fields if available
          if (activity.instructor) activityData.instructor = activity.instructor;
          if (activity.fullDescription) activityData.fullDescription = activity.fullDescription;
          if (activity.whatToBring) activityData.whatToBring = activity.whatToBring;
          
          // Upsert activity
          const upserted = await tx.activity.upsert({
            where: {
              providerId_externalId: {
                providerId,
                externalId: activity.externalId || activity.courseId || activity.id
              }
            },
            create: {
              ...activityData,
              providerId,
              externalId: activity.externalId || activity.courseId || activity.id
            },
            update: activityData,
            include: {
              _count: {
                select: { history: true }
              }
            }
          });

          if (upserted._count.history === 0) {
            summary.created++;
          } else {
            summary.updated++;
          }

          // Track significant changes
          const activityExternalId = activity.externalId || activity.courseId || activity.id;
          if (existingIds.has(activityExternalId)) {
            await this.trackChanges(tx, upserted.id, activityData);
          }
          
          // Handle sessions
          if (activity.sessions && activity.sessions.length > 0) {
            // Delete existing sessions for this activity
            await tx.activitySession.deleteMany({
              where: { activityId: upserted.id }
            });
            
            // Create new sessions
            const sessionData = activity.sessions.map((session, index) => ({
              activityId: upserted.id,
              sessionNumber: index + 1,
              date: session.date,
              startTime: session.time ? session.time.split('-')[0]?.trim() : session.startTime,
              endTime: session.time ? session.time.split('-')[1]?.trim() : session.endTime,
              location: session.location,
              instructor: session.instructor,
              notes: session.notes
            }));
            
            await tx.activitySession.createMany({
              data: sessionData
            });
          }
          
          // Handle prerequisites
          if (activity.prerequisites && Array.isArray(activity.prerequisites) && activity.prerequisites.length > 0) {
            // Delete existing prerequisites for this activity
            await tx.activityPrerequisite.deleteMany({
              where: { activityId: upserted.id }
            });
            
            // Create new prerequisites
            const prereqData = activity.prerequisites.map(prereq => ({
              activityId: upserted.id,
              name: prereq.name,
              description: prereq.description,
              url: prereq.url,
              courseId: prereq.courseId,
              isRequired: prereq.isRequired !== false
            }));
            
            await tx.activityPrerequisite.createMany({
              data: prereqData
            });
          }

        } catch (error) {
          summary.errors.push({
            activityId: activity.id,
            error: error.message
          });
        }
      }

      // Deactivate activities not found in current scrape
      const toDeactivate = [...existingIds].filter(id => !scrapedIds.has(id));
      if (toDeactivate.length > 0) {
        const deactivated = await tx.activity.updateMany({
          where: {
            providerId,
            externalId: { in: toDeactivate },
            isActive: true
          },
          data: {
            isActive: false,
            isUpdated: false, // Set both fields for compatibility
            updatedAt: new Date()
          }
        });
        summary.deactivated = deactivated.count;
      }

      return summary;
    });

    return result;
  }

  /**
   * Track changes to activities
   */
  async trackChanges(tx, activityId, newData) {
    const existing = await tx.activity.findUnique({
      where: { id: activityId }
    });

    const trackedFields = ['cost', 'spotsAvailable', 'schedule', 'locationName'];
    const changes = [];

    for (const field of trackedFields) {
      if (existing[field] !== newData[field]) {
        changes.push({
          activityId,
          fieldName: field,
          oldValue: String(existing[field] || ''),
          newValue: String(newData[field] || '')
        });
      }
    }

    if (changes.length > 0) {
      await tx.activityHistory.createMany({ data: changes });
    }
  }

  /**
   * Search activities with filters
   */
  async searchActivities(filters = {}) {
    const {
      ageMin,
      ageMax,
      costMin,
      costMax,
      categories,
      activityTypes, // For filtering by activity types (Swimming, Dance, etc.)
      locations,
      locationIds, // For filtering by specific location IDs
      providers,
      search,
      subcategory,
      daysOfWeek, // For filtering by days
      isActive = true,
      excludeClosed = false,
      excludeFull = false,
      hideClosedActivities = false, // New global filter
      hideFullActivities = false,    // New global filter
      hideClosedOrFull = false,      // New combined global filter
      createdAfter, // For new activities
      updatedAfter, // For recently updated activities
      startDateAfter, // For activities starting after a date
      startDateBefore, // For activities starting before a date
      page = 1,
      limit = 50
    } = filters;

    // Build where clause with isActive filter restored
    const where = {};
    // Re-enable isActive filter now that activity status is corrected
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Age filter
    if (ageMin !== undefined || ageMax !== undefined) {
      if (!where.AND) {
        where.AND = [];
      }
      where.AND.push(
        { ageMin: { lte: ageMax || 18 } },
        { ageMax: { gte: ageMin || 0 } }
      );
    }

    // Cost filter
    if (costMin !== undefined && costMax !== undefined) {
      where.cost = { gte: costMin, lte: costMax };
    } else if (costMin !== undefined) {
      where.cost = { gte: costMin };
    } else if (costMax !== undefined) {
      where.cost = { lte: costMax };
    }

    // Days of week filter
    if (daysOfWeek && daysOfWeek.length > 0) {
      // Filter by schedule field containing any of the specified days
      const daysCondition = {
        OR: daysOfWeek.map(day => ({
          schedule: { contains: day, mode: 'insensitive' }
        }))
      };
      
      // If where.AND doesn't exist, create it
      if (!where.AND) {
        where.AND = [];
      }
      where.AND.push(daysCondition);
    }

    // Date filters
    if (createdAfter) {
      where.createdAt = { gte: new Date(createdAfter) };
    }
    
    if (updatedAfter) {
      where.updatedAt = { gte: new Date(updatedAfter) };
    }
    
    if (startDateAfter) {
      where.dateStart = { gte: new Date(startDateAfter) };
    }
    
    if (startDateBefore) {
      where.dateStart = { lte: new Date(startDateBefore) };
    }

    // Category filter
    if (categories && categories.length > 0) {
      where.category = { in: categories };
    }

    // Activity Types filter (for filtering by Swimming, Dance, etc.)
    if (activityTypes && activityTypes.length > 0) {
      console.log('🔍 ActivityService: Filtering by activityTypes:', activityTypes);
      
      // Get all matching ActivityType records for the provided names
      const types = await prisma.activityType.findMany({
        where: {
          name: { in: activityTypes }
        },
        select: { id: true, name: true }
      });
      
      console.log('🔍 ActivityService: Found ActivityType matches:', types);
      
      if (types.length > 0) {
        const typeIds = types.map(t => t.id);
        where.activityTypeId = { in: typeIds };
        console.log('🔍 ActivityService: Filtering by activityTypeId IN:', typeIds);
      }
    }

    // Location filter - use normalized location schema
    if (locationIds && locationIds.length > 0) {
      // Direct location ID filtering
      where.locationId = { in: locationIds };
    } else if (locations && locations.length > 0) {
      // Check if they are UUIDs (location IDs) or names
      const isLocationId = locations[0] && locations[0].match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      if (isLocationId) {
        // Filter by location IDs directly
        where.locationId = { in: locations };
      } else {
        // Filter by location names using join to Location table
        where.location = {
          name: { in: locations }
        };
      }
    }

    // Provider filter
    if (providers && providers.length > 0) {
      where.provider = {
        name: { in: providers }
      };
    }

    // Subcategory filter
    if (subcategory) {
      // For browse by activity type, use pattern matching
      // This catches all variations like "Swimming", "Swimmer 1", "Swim Parent", etc.
      
      // Special cases for broad categories that need pattern matching
      const categoryPatterns = {
        'Swimming': 'Swim', // Matches Swimming, Swimmer, Swim Parent, etc.
        'Camps': 'Camp',     // Matches Part Day Camp, Full Day Camp, etc.
      };
      
      // Use the pattern if available, otherwise use the subcategory as-is
      const searchPattern = categoryPatterns[subcategory] || subcategory;
      where.subcategory = { contains: searchPattern, mode: 'insensitive' };
    }

    // Search filter - search across multiple fields
    if (search) {
      const searchCondition = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
          { subcategory: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { location: { name: { contains: search, mode: 'insensitive' } } },
          { fullDescription: { contains: search, mode: 'insensitive' } },
          { instructor: { contains: search, mode: 'insensitive' } },
          { provider: { name: { contains: search, mode: 'insensitive' } } }
        ]
      };
      
      // Add search condition to AND array to combine with other filters
      if (!where.AND) {
        where.AND = [];
      }
      where.AND.push(searchCondition);
    }

    // Exclude closed and/or full activities filter
    if (excludeClosed || excludeFull) {
      where.NOT = [];
      
      if (excludeClosed) {
        // Exclude activities with registration status indicating they are closed or cancelled
        where.NOT.push(
          { registrationStatus: { contains: 'closed', mode: 'insensitive' } },
          { registrationStatus: { contains: 'cancelled', mode: 'insensitive' } }
        );
      }
      
      if (excludeFull) {
        // Exclude activities that are full
        where.NOT.push(
          { registrationStatus: { contains: 'full', mode: 'insensitive' } },
          { spotsAvailable: 0 }  // Also check if spots available is 0
        );
      }
    }

    const skip = (page - 1) * limit;

    // Apply global filters using buildActivityWhereClause
    const finalWhere = buildActivityWhereClause(where, {
      hideClosedActivities,
      hideFullActivities,
      hideClosedOrFull
    });

    console.log('🔍 [ActivityService.searchActivities] Applying global filters:', {
      hideClosedActivities,
      hideFullActivities,
      hideClosedOrFull
    });

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where: finalWhere,
        include: {
          provider: true,
          location: {
            include: {
              city: true // Include city data for normalized schema
            }
          },
          activityType: true, // CRITICAL: Include activity type relationship
          activitySubtype: true, // CRITICAL: Include activity subtype relationship
          sessions: {
            orderBy: { sessionNumber: 'asc' }
          },
          prerequisitesList: true,
          _count: {
            select: { favorites: true }
          }
        },
        orderBy: [
          { dateStart: 'asc' },
          { name: 'asc' }
        ],
        skip,
        take: limit
      }),
      prisma.activity.count({ where: finalWhere })
    ]);

    return {
      activities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get activity by ID
   */
  async getActivityById(id) {
    return prisma.activity.findUnique({
      where: { id },
      include: {
        provider: true,
        location: true,
        sessions: {
          orderBy: { sessionNumber: 'asc' }
        },
        prerequisitesList: {
          orderBy: { createdAt: 'asc' }
        },
        favorites: {
          select: {
            id: true,
            userId: true,
            notifyOnChange: true,
            createdAt: true
          }
        },
        _count: {
          select: { favorites: true }
        }
      }
    });
  }

  /**
   * Get activity statistics
   */
  async getStatistics() {
    const [
      totalActive,
      byCategory,
      byProvider,
      upcomingCount,
      priceRanges
    ] = await Promise.all([
      prisma.activity.count({}), // Count all activities
      prisma.activity.groupBy({
        by: ['category'],
        // No isActive filter - count all activities
        _count: { id: true }
      }),
      prisma.activity.groupBy({
        by: ['providerId'],
        // No isActive filter - count all activities
        _count: { id: true }
      }),
      prisma.activity.count({
        where: {
          // Only filter by date, not isActive
          dateStart: { gte: new Date() }
        }
      }),
      prisma.$queryRaw`
        WITH price_categories AS (
          SELECT 
            CASE 
              WHEN cost = 0 THEN 'Free'
              WHEN cost <= 50 THEN '$1-50'
              WHEN cost <= 100 THEN '$51-100'
              WHEN cost <= 200 THEN '$101-200'
              ELSE '$200+'
            END as price_range,
            CASE 
              WHEN cost = 0 THEN 1
              WHEN cost <= 50 THEN 2
              WHEN cost <= 100 THEN 3
              WHEN cost <= 200 THEN 4
              ELSE 5
            END as sort_order
          FROM "Activity"
          -- Removed isActive filter to include all activities
        )
        SELECT 
          price_range,
          COUNT(*)::int as count
        FROM price_categories
        GROUP BY price_range
        ORDER BY MIN(sort_order)
      `
    ]);

    return {
      totalActive,
      byCategory: byCategory.map(c => ({
        category: c.category,
        count: c._count.id
      })),
      byProvider,
      upcomingCount,
      priceRanges
    };
  }
}

module.exports = new ActivityService();