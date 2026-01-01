import { PrismaClient, Activity, Prisma } from '../../generated/prisma';
import { prisma as sharedPrisma } from '../lib/prisma';
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
  dateMatchMode?: 'partial' | 'full'; // 'partial' = overlap, 'full' = completely within range
  dayOfWeek?: string[];
  location?: string;
  locations?: string[]; // Support multiple locations
  providerId?: string;
  hideClosedActivities?: boolean; // Hide activities that are closed for registration
  hideFullActivities?: boolean; // Hide activities with no spots available
  hideClosedOrFull?: boolean; // Hide activities that are closed OR full
  hasCoordinates?: boolean; // Only return activities with lat/lng for map view
  limit?: number;
  offset?: number;
  sortBy?: 'cost' | 'dateStart' | 'name' | 'createdAt' | 'distance' | 'availability';
  sortOrder?: 'asc' | 'desc';
  includeInactive?: boolean; // Only for admin use
  randomSeed?: string; // Seed for consistent random ordering across pagination
}

export class EnhancedActivityService {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || sharedPrisma;
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
      dateMatchMode = 'partial',
      dayOfWeek,
      location,
      locations, // Support multiple locations
      providerId,
      hideClosedActivities = false,
      hideFullActivities = false,
      hideClosedOrFull = false,
      hasCoordinates = false,
      limit = 50,
      offset = 0,
      sortBy = 'availability', // Default to availability-first random ordering
      sortOrder = 'asc',
      includeInactive = false,
      randomSeed
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
    const where: Prisma.ActivityWhereInput = {};

    // Activity status filter:
    // - For normal app traffic, only return active activities.
    // - For admin/debug use, allow including inactive records.
    //
    // NOTE: `isUpdated` is used by some scripts/migrations, but many scrapers only set `isActive`.
    // Filtering on `isUpdated: true` will hide legitimately active/new activities.
    if (!includeInactive) {
      where.isActive = true;
    }
    // When includeInactive is true, we don't filter by isActive at all

    // Map view filter - only return activities with coordinates
    if (hasCoordinates) {
      where.latitude = { not: null };
      where.longitude = { not: null };
    }

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
    // Logic: Find activities that overlap with the requested age range
    // - ageMin filter: Child must be old enough (activity.ageMin <= child's age)
    // - ageMax filter: Child must be young enough (activity.ageMax >= child's age)
    //                  AND activity must accept children this young (activity.ageMin <= ageMax)
    if (ageMin !== undefined || ageMax !== undefined) {
      const andConditions = [];
      if (ageMin !== undefined) {
        // Activity must accept children at least as young as ageMin
        // (activity.ageMin <= ageMin means a child of ageMin years is old enough)
        andConditions.push({
          OR: [
            { ageMin: { lte: ageMin } },
            { ageMin: null }
          ]
        });
      }
      if (ageMax !== undefined) {
        // Activity must accept children as old as ageMax
        // (activity.ageMax >= ageMax means a child of ageMax years is young enough)
        andConditions.push({
          OR: [
            { ageMax: { gte: ageMax } },
            { ageMax: null }
          ]
        });
        // ALSO: Activity's minimum age must be <= ageMax
        // (if activity requires age 12+, it shouldn't appear when searching for kids up to 8)
        andConditions.push({
          OR: [
            { ageMin: { lte: ageMax } },
            { ageMin: null }
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
    // 'partial' (default): Activity overlaps with date range (dateEnd >= startDate AND dateStart <= endDate)
    // 'full': Activity must be completely within date range (dateStart >= startDate AND dateEnd <= endDate)
    if (startDate || endDate) {
      console.log(`📅 [ActivityService] Date filter applied:`, {
        startDate,
        endDate,
        dateMatchMode
      });

      if (dateMatchMode === 'full') {
        // Full mode: Activity dates must be completely within the specified range
        if (startDate) {
          where.dateStart = { gte: startDate };
        }
        if (endDate) {
          where.dateEnd = { lte: endDate };
        }
      } else {
        // Partial mode (default): Activity just needs to overlap with the date range
        if (startDate) {
          where.dateEnd = { gte: startDate };
        }
        if (endDate) {
          where.dateStart = { lte: endDate };
        }
      }
    }

    // Day of week filter - filter through sessions table
    // The dayOfWeek data is stored in ActivitySession, not Activity
    // Frontend sends full names (Monday, Tuesday) but DB has abbreviated (Mon, Tue)
    if (dayOfWeek && dayOfWeek.length > 0) {
      // Map full day names to abbreviated format used in ActivitySession
      const dayNameMap: Record<string, string> = {
        'Monday': 'Mon',
        'Tuesday': 'Tue',
        'Wednesday': 'Wed',
        'Thursday': 'Thu',
        'Friday': 'Fri',
        'Saturday': 'Sat',
        'Sunday': 'Sun',
        // Also handle abbreviated names if passed directly
        'Mon': 'Mon',
        'Tue': 'Tue',
        'Wed': 'Wed',
        'Thu': 'Thu',
        'Fri': 'Fri',
        'Sat': 'Sat',
        'Sun': 'Sun',
      };

      const abbreviatedDays = dayOfWeek
        .map(day => dayNameMap[day] || day)
        .filter(day => day); // Remove any unmapped values

      if (abbreviatedDays.length > 0) {
        // Filter activities that have sessions on the specified days
        where.sessions = {
          some: {
            dayOfWeek: { in: abbreviatedDays }
          }
        };
        console.log(`📅 [ActivityService] Day of week filter: ${dayOfWeek.join(', ')} → ${abbreviatedDays.join(', ')}`);
      }
    }

    // Location filter - use normalized location schema  
    // Apply location filter whenever location is specified (regardless of activity type)
    const hasLocationFilter = !!(locations || location);
    
    console.log('📍 [ActivityService] Location filter check:', {
      isActivityTypeSearch,
      locations,
      location,
      hasLocationFilter
    });
    
    if (hasLocationFilter && locations && locations.length > 0) {
      // Check if they are UUIDs (location IDs) or names
      const isLocationId = locations[0] && locations[0].match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      if (isLocationId) {
        // Filter by location IDs directly
        where.locationId = { in: locations };
      } else {
        // Filter by location names OR city names (since users might pass either)
        // IMPORTANT: If we already have an OR clause (from search), we need to AND the location filter
        const locationCondition: Prisma.ActivityWhereInput = {
          OR: [
            { location: { is: { name: { in: locations } } } }, // Direct location name match
            { location: { is: { city: { in: locations, mode: 'insensitive' } } } } // City name match (city is a string field)
          ]
        };
        
        if (where.OR) {
          // We have a search OR clause - combine with AND
          const searchCondition = { OR: where.OR };
          delete where.OR;
          where.AND = where.AND || [];
          (where.AND as Prisma.ActivityWhereInput[]).push(searchCondition, locationCondition);
          console.log('📍 [ActivityService] Combined search + location with AND');
        } else {
          where.OR = locationCondition.OR;
        }
      }
    } else if (hasLocationFilter && location) {
      // Single location by name (backward compatibility) - check both location and city names
      // IMPORTANT: If we already have an OR clause (from search), we need to AND the location filter
      const locationCondition: Prisma.ActivityWhereInput = {
        OR: [
          { location: { is: { name: { contains: location, mode: 'insensitive' } } } },
          { location: { is: { city: { contains: location, mode: 'insensitive' } } } }
        ]
      };
      
      if (where.OR) {
        // We have a search OR clause - combine with AND
        const searchCondition = { OR: where.OR };
        delete where.OR;
        where.AND = where.AND || [];
        (where.AND as Prisma.ActivityWhereInput[]).push(searchCondition, locationCondition);
        console.log('📍 [ActivityService] Combined search + single location with AND');
      } else {
        where.OR = locationCondition.OR;
      }
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
    let activities: Activity[];
    let total: number;

    if (sortBy === 'availability') {
      // Availability-first random ordering:
      // 1. Activities with spots available (Open status) come first
      // 2. Within each group, order is randomized but consistent for pagination
      // Uses a seeded hash for deterministic randomization

      const seed = randomSeed || new Date().toISOString().slice(0, 10); // Default seed: today's date

      // Simple hash function for deterministic random ordering
      const hashCode = (str: string): number => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
      };

      // Get availability priority (lower = better)
      const getAvailabilityPriority = (activity: any): number => {
        const status = activity.registrationStatus;
        const spots = activity.spotsAvailable;

        if (status === 'Open' && (spots === null || spots > 0)) return 0;
        if (status === 'Waitlist') return 1;
        if (status === null || status === 'Unknown') return 2;
        return 3; // Full, Closed, etc.
      };

      // Fetch all matching activities (just IDs and sort fields for efficiency)
      const allMatching = await this.prisma.activity.findMany({
        where: finalWhere,
        select: {
          id: true,
          registrationStatus: true,
          spotsAvailable: true
        }
      });

      total = allMatching.length;

      // Sort by availability priority, then by seeded random
      const sorted = allMatching.sort((a, b) => {
        const priorityA = getAvailabilityPriority(a);
        const priorityB = getAvailabilityPriority(b);

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        // Same priority - use seeded random
        const hashA = hashCode(a.id + seed);
        const hashB = hashCode(b.id + seed);
        return hashA - hashB;
      });

      // Get the page slice
      const pageIds = sorted.slice(offset, offset + limit).map(a => a.id);

      if (pageIds.length > 0) {
        // Fetch full activity records for this page
        const unorderedActivities = await this.prisma.activity.findMany({
          where: { id: { in: pageIds } },
          include: {
            provider: true,
            location: {
              include: {
                cityRecord: true
              }
            },
            activityType: true,
            activitySubtype: true,
            _count: {
              select: { favorites: true }
            }
          }
        });

        // Restore the sort order
        const activityMap = new Map(unorderedActivities.map(a => [a.id, a]));
        activities = pageIds.map(id => activityMap.get(id)!).filter(Boolean);
      } else {
        activities = [];
      }

      console.log(`🎲 [ActivityService] Availability-first random sort applied (seed: ${seed})`);
    } else {
      // Standard Prisma ordering for other sort modes
      [activities, total] = await Promise.all([
        this.prisma.activity.findMany({
          where: finalWhere,
          include: {
            provider: true,
            location: {
              include: {
                cityRecord: true // Include city data for complete location info
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
    }

    console.log(`📊 [ActivityService] Query results:`, {
      totalFound: total,
      returnedCount: activities.length,
      firstActivity: activities[0] ? {
        name: activities[0].name,
        courseId: activities[0].externalId,
        category: activities[0].category,
        subcategory: activities[0].subcategory,
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
    if (!activity || (!includeInactive && !activity.isActive)) {
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
      where: { isActive: true },
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
        where: { providerId, isActive: true }
      }),
      this.prisma.activity.count({
        where: { providerId, isActive: false }
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