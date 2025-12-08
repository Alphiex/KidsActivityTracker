import { PrismaClient, Activity, Prisma } from '../../generated/prisma';
const { convertToActivityTypes } = require('../constants/activityTypes');
import { buildActivityWhereClause, GlobalActivityFilters } from '../utils/activityFilters';

interface SearchParams {
  search?: string;
  category?: string;
  categories?: string; // Comma-separated list of categories or activity types
  activityType?: string; // Filter by activity type ID or code
  activitySubtype?: string; // Filter by activity subtype ID or code
  ageMin?: number;
  ageMax?: number;
  costMin?: number;
  costMax?: number;
  startDate?: Date;
  endDate?: Date;
  dayOfWeek?: string[];
  location?: string;
  locations?: string[]; // Support multiple locations
  providerId?: string;
  hideClosedActivities?: boolean; // Hide activities that are closed for registration
  hideFullActivities?: boolean; // Hide activities with no spots available
  hideClosedOrFull?: boolean; // Hide activities that are closed OR full
  limit?: number;
  offset?: number;
  sortBy?: 'cost' | 'dateStart' | 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  includeInactive?: boolean; // Only for admin use
}

export class EnhancedActivityService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async searchActivities(params: SearchParams) {
    const {
      search,
      category,
      categories,
      activityType,
      activitySubtype,
      ageMin,
      ageMax,
      costMin,
      costMax,
      startDate,
      endDate,
      dayOfWeek,
      location,
      locations, // Support multiple locations
      providerId,
      hideClosedActivities = false,
      hideFullActivities = false,
      hideClosedOrFull = false,
      limit = 50,
      offset = 0,
      sortBy = 'dateStart',
      sortOrder = 'asc',
      includeInactive = false
    } = params;

    // DEBUG LOGGING
    console.log('🔍 [ActivityService] searchActivities called with:', {
      activityType,
      activitySubtype,
      hideClosedActivities,
      hideFullActivities,
      hideClosedOrFull,
      limit,
      offset,
      search,
      category,
      categories,
      includeInactive
    });

    // Determine search type early to control filtering logic
    const isActivityTypeSearch = !!(activityType || activitySubtype || categories);

    // Build where clause
    const where: Prisma.ActivityWhereInput = {
      // Use isUpdated instead of deprecated isActive field unless explicitly requested
      isUpdated: includeInactive ? undefined : true
    };

    // Text search
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { name: { contains: search, mode: 'insensitive' } } },
        { category: { contains: search, mode: 'insensitive' } },
        { subcategory: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Category filter - for now, use the old category field
    if (category) {
      // TODO: Once ActivityCategory junction table is fully populated,
      // switch to using the new categories relationship
      where.category = category;
    } else if (categories) {
      // Handle multiple categories (comma-separated) - typically activity types
      const categoryList = categories.split(',').map(c => c.trim()).filter(c => c);
      
      if (categoryList.length > 0) {
        // Convert categories to activity types (handles both legacy and new names)
        const activityTypes = convertToActivityTypes(categoryList);
        
        // Look up the activity type IDs from the database
        const activityTypeRecords = await this.prisma.activityType.findMany({
          where: {
            OR: [
              { code: { in: activityTypes.map(t => t.toLowerCase().replace(/\s+/g, '-')) } },
              { name: { in: activityTypes } }
            ]
          }
        });
        
        if (activityTypeRecords.length > 0) {
          const typeIds = activityTypeRecords.map(t => t.id);
          // Use ONLY the activity type IDs for filtering, not legacy category
          where.activityTypeId = { in: typeIds };
          console.log(`✅ [ActivityService] Filtering by activity type IDs:`, typeIds);
        } else {
          // Only use legacy category field if no activity types were found
          where.category = { in: categoryList };
          console.log(`⚠️ [ActivityService] No activity types found, falling back to legacy categories:`, categoryList);
        }
      }
    }

    // Activity Type filter - uses foreign key relationship
    if (activityType) {
      // Check if it's a UUID or a code
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activityType);
      
      if (isUuid) {
        where.activityTypeId = activityType;
      } else {
        // Look up the activity type by code OR name
        const activityTypeRecord = await this.prisma.activityType.findFirst({
          where: {
            OR: [
              { code: activityType.toLowerCase().replace(/\s+/g, '-') },
              { name: { equals: activityType, mode: 'insensitive' } }
            ]
          }
        });
        
        if (activityTypeRecord) {
          console.log(`✅ [ActivityService] Found activity type:`, {
            name: activityTypeRecord.name,
            id: activityTypeRecord.id,
            code: activityTypeRecord.code
          });
          where.activityTypeId = activityTypeRecord.id;
        } else {
          // Activity type not found - return empty results
          console.log(`❌ [ActivityService] Activity type '${activityType}' not found - returning empty results`);
          return {
            activities: [],
            pagination: {
              total: 0,
              limit,
              offset,
              pages: 0
            }
          };
        }
      }
    }

    // Activity Subtype filter - uses foreign key relationship
    if (activitySubtype) {
      // Check if it's a UUID
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activitySubtype);
      
      if (isUuid) {
        where.activitySubtypeId = activitySubtype;
      } else {
        // Look up the activity subtype by code OR name
        // If we have an activityTypeId already set, use it to narrow the search
        const subtypeWhere: any = {
          OR: [
            { code: activitySubtype.toLowerCase().replace(/\s+/g, '-') },
            { name: { equals: activitySubtype, mode: 'insensitive' } }
          ]
        };
        
        // If we already filtered by activity type, use it to get the right subtype
        if (where.activityTypeId) {
          subtypeWhere.activityTypeId = where.activityTypeId;
        }
        
        const activitySubtypeRecord = await this.prisma.activitySubtype.findFirst({
          where: subtypeWhere
        });
        
        if (activitySubtypeRecord) {
          console.log(`✅ [ActivityService] Found activity subtype:`, {
            name: activitySubtypeRecord.name,
            id: activitySubtypeRecord.id,
            code: activitySubtypeRecord.code,
            activityTypeId: activitySubtypeRecord.activityTypeId
          });
          where.activitySubtypeId = activitySubtypeRecord.id;
        } else {
          // Subtype not found - return empty results
          console.log(`❌ [ActivityService] Activity subtype '${activitySubtype}' not found${where.activityTypeId ? ' under the specified type' : ''} - returning empty results`);
          return {
            activities: [],
            pagination: {
              total: 0,
              limit,
              offset,
              pages: 0
            }
          };
        }
      }
    }

    // Age range filter
    if (ageMin !== undefined || ageMax !== undefined) {
      const andConditions = [];
      if (ageMin !== undefined) {
        andConditions.push({
          OR: [
            { ageMin: { lte: ageMin } },
            { ageMin: null }
          ]
        });
      }
      if (ageMax !== undefined) {
        andConditions.push({
          OR: [
            { ageMax: { gte: ageMax } },
            { ageMax: null }
          ]
        });
      }
      if (andConditions.length > 0) {
        where.AND = where.AND ? [...(Array.isArray(where.AND) ? where.AND : [where.AND]), ...andConditions] : andConditions;
      }
    }

    // Cost range filter
    if (costMin !== undefined || costMax !== undefined) {
      const costFilter: any = {};
      if (costMin !== undefined) costFilter.gte = costMin;
      if (costMax !== undefined) costFilter.lte = costMax;
      where.cost = costFilter;
      console.log(`💰 [ActivityService] Cost filter applied:`, {
        costMin,
        costMax,
        filter: costFilter
      });
    }

    // Date range filter
    if (startDate) {
      where.dateEnd = { gte: startDate };
    }
    if (endDate) {
      where.dateStart = { lte: endDate };
    }

    // Day of week filter
    if (dayOfWeek && dayOfWeek.length > 0) {
      where.dayOfWeek = { hasSome: dayOfWeek };
    }

    // Location filter - use normalized location schema  
    // IMPORTANT: Only apply location filters when:
    // 1. User is explicitly searching by location (not activity type/subtype)
    // 2. OR when getting personalized/recommended results
    const isLocationBasedSearch = !isActivityTypeSearch && (locations || location);
    
    console.error('❌❌❌ CRITICAL DEBUG - isActivityTypeSearch:', isActivityTypeSearch);
    console.error('❌❌❌ CRITICAL DEBUG - locations:', locations);  
    console.error('❌❌❌ CRITICAL DEBUG - isLocationBasedSearch:', isLocationBasedSearch);
    
    if (isLocationBasedSearch && locations && locations.length > 0) {
      console.error('❌❌❌ APPLYING LOCATION FILTER - THIS SHOULD NOT HAPPEN FOR ACTIVITY TYPE SEARCHES!');
      // Check if they are UUIDs (location IDs) or names
      const isLocationId = locations[0] && locations[0].match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      if (isLocationId) {
        // Filter by location IDs directly
        where.locationId = { in: locations };
      } else {
        // Filter by location names OR city names (since users might pass either)
        where.location = {
          OR: [
            { name: { in: locations } }, // Direct location name match
            { city: { name: { in: locations } } } // City name match
          ]
        };
      }
    } else if (isLocationBasedSearch && location) {
      // Single location by name (backward compatibility) - check both location and city names
      where.location = {
        OR: [
          { name: { contains: location, mode: 'insensitive' } },
          { city: { name: { contains: location, mode: 'insensitive' } } }
        ]
      };
    }

    // Provider filter
    if (providerId) {
      where.providerId = providerId;
    }

    // Apply global filters using shared utility
    console.log('🔧 [ActivityService] Global filter params:', {
      hideClosedActivities,
      hideFullActivities,
      hideClosedOrFull,
      types: { hideClosedActivities: typeof hideClosedActivities, hideFullActivities: typeof hideFullActivities, hideClosedOrFull: typeof hideClosedOrFull }
    });

    const finalWhere = buildActivityWhereClause(where, {
      hideClosedActivities,
      hideFullActivities,
      hideClosedOrFull
    });
    
    console.log('🔧 [ActivityService] buildActivityWhereClause result:', JSON.stringify(finalWhere, null, 2));

    console.log('📋 [ActivityService] Final where clause before query:', JSON.stringify(finalWhere, null, 2));

    // Execute query
    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where: finalWhere,
        include: {
          provider: true,
          location: {
            include: {
              city: true // Include city data for complete location info
            }
          },
          activityType: true,
          activitySubtype: true,
          _count: {
            select: { favorites: true }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset
      }),
      this.prisma.activity.count({ where: finalWhere })
    ]);

    console.log(`📊 [ActivityService] Query results:`, {
      totalFound: total,
      returnedCount: activities.length,
      firstActivity: activities[0] ? {
        name: activities[0].name,
        courseId: activities[0].externalId,
        activityType: activities[0].activityType?.name,
        activitySubtype: activities[0].activitySubtype?.name,
        spotsAvailable: activities[0].spotsAvailable,
        registrationStatus: activities[0].registrationStatus
      } : null
    });

    return {
      activities,
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getActivity(id: string, includeInactive = false) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: {
        provider: true,
        activityType: true,
        activitySubtype: true,
        location: true,
        _count: {
          select: { 
            favorites: true,
            childActivities: true
          }
        }
      }
    });

    // Return null if activity is inactive and we're not including inactive
    if (!activity || (!includeInactive && !activity.isUpdated)) {
      return null;
    }

    return activity;
  }

  async getActivityByProviderAndCourseId(providerId: string, courseId: string) {
    return this.prisma.activity.findUnique({
      where: {
        providerId_externalId: {
          providerId,
          externalId: courseId
        }
      },
      include: {
        provider: true,
        location: true
      }
    });
  }

  async getUpcomingActivities(params: {
    limit?: number;
    offset?: number;
    daysAhead?: number;
  }) {
    const { limit = 50, offset = 0, daysAhead = 30 } = params;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.searchActivities({
      startDate: new Date(),
      endDate: futureDate,
      limit,
      offset,
      sortBy: 'dateStart',
      sortOrder: 'asc'
    });
  }

  async getActivitiesByCategory() {
    const categories = await this.prisma.activity.groupBy({
      by: ['category'],
      where: { isUpdated: true },
      _count: { _all: true },
      orderBy: { _count: { category: 'desc' } }
    });

    return categories.map(cat => ({
      category: cat.category,
      count: cat._count._all
    }));
  }

  async getActivityHistory(activityId: string) {
    return this.prisma.activityHistory.findMany({
      where: { activityId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getProviderStats(providerId: string) {
    const [activeCount, inactiveCount, lastRun] = await Promise.all([
      this.prisma.activity.count({
        where: { providerId, isUpdated: true }
      }),
      this.prisma.activity.count({
        where: { providerId, isUpdated: false }
      }),
      this.prisma.scraperRun.findFirst({
        where: { providerId },
        orderBy: { startedAt: 'desc' }
      })
    ]);

    return {
      activeActivities: activeCount,
      inactiveActivities: inactiveCount,
      totalActivities: activeCount + inactiveCount,
      lastScraperRun: lastRun
    };
  }

  async cleanup() {
    await this.prisma.$disconnect();
  }
}

// Export a singleton instance
export const activityService = new EnhancedActivityService();