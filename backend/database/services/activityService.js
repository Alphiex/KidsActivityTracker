const prisma = require('../config/database');

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
            schedule: activity.schedule,
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
      costMax,
      categories,
      locations,
      providers,
      search,
      subcategory,
      isActive = true,
      excludeClosed = false,
      excludeFull = false,
      createdAfter, // For new activities
      updatedAfter, // For recently updated activities
      startDateAfter, // For activities starting after a date
      startDateBefore, // For activities starting before a date
      page = 1,
      limit = 50
    } = filters;

    const where = { isActive };

    // Age filter
    if (ageMin !== undefined || ageMax !== undefined) {
      where.AND = [
        { ageMin: { lte: ageMax || 18 } },
        { ageMax: { gte: ageMin || 0 } }
      ];
    }

    // Cost filter
    if (costMax !== undefined) {
      where.cost = { lte: costMax };
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

    // Location filter
    if (locations && locations.length > 0) {
      where.locationName = { in: locations };
    }

    // Provider filter
    if (providers && providers.length > 0) {
      where.provider = {
        name: { in: providers }
      };
    }

    // Subcategory filter
    if (subcategory) {
      // Map consolidated types to their actual subcategories in the database
      const subcategoryMappings = {
        'Swimming': [
          'Swimming (0-6yrs)',
          'Swimming (0-6yrs PP)',
          'Swimming (6-12yrs)',
          'Swimming (10-18yrs)',
          'Swimming - Aquatic Leadership (10-18yrs)',
          'Private Lessons Swimming (All Ages)'
        ],
        'Music': [
          'Music (0-6yrs PP)',
          'Music (5-13yrs)',
          'Music (10-18yrs)',
          'Private Lessons Music (All Ages)',
          'Arts Music (0-6yrs PP)',
          'Arts Music (5-13yrs)',
          'Arts Music (10-18yrs)'
        ],
        'Sports': [
          'Sports (0-6yrs)',
          'Sports (0-6yrs PP)',
          'Sports (5-13yrs)',
          'Sports (10-18yrs)'
        ],
        'Skating': [
          'Skating (0-6yrs)',
          'Skating (0-6yrs PP)',
          'Skating (5-13yrs)'
        ],
        'Martial Arts': [
          'Martial Arts (0-6yrs)',
          'Martial Arts (0-6yrs PP)',
          'Martial Arts (5-13yrs)',
          'Martial Arts (10-20yrs)'
        ],
        'Visual Arts': [
          'Arts Visual (0-6yrs)',
          'Arts Visual (0-6yrs PP)',
          'Arts Visual (5-13yrs)',
          'Arts Visual (10-18yrs)',
          'Arts Visual (All Ages & Family)'
        ],
        'Dance': [
          'Arts Dance (0-6yrs)',
          'Arts Dance (0-6yrs PP)',
          'Arts Dance (5-13yrs)'
        ],
        'Camps': [
          'Camps Part Day (0-6yrs)',
          'Camps Part Day (5-13yrs)',
          'Camps Full Day (5-13yrs)',
          'Camps Single Day (5-13yrs)'
        ]
      };
      
      // Check if this is a consolidated type that needs expansion
      if (subcategoryMappings[subcategory]) {
        where.subcategory = { in: subcategoryMappings[subcategory] };
      } else {
        // For activity types not in the mapping, try pattern matching
        // This handles cases like "Tennis", "Fitness", etc.
        where.OR = [
          { subcategory: { contains: subcategory, mode: 'insensitive' } },
          { subcategory: subcategory }
        ];
      }
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { subcategory: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
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

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        include: {
          provider: true,
          location: true,
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
      prisma.activity.count({ where })
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
      prisma.activity.count({ where: { isActive: true } }),
      prisma.activity.groupBy({
        by: ['category'],
        where: { isActive: true },
        _count: { id: true }
      }),
      prisma.activity.groupBy({
        by: ['providerId'],
        where: { isActive: true },
        _count: { id: true }
      }),
      prisma.activity.count({
        where: {
          isActive: true,
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
          WHERE "isActive" = true
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