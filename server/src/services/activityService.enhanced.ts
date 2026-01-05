import { PrismaClient, Activity, Prisma } from '../../generated/prisma';
import { prisma as sharedPrisma } from '../lib/prisma';
const { convertToActivityTypes } = require('../constants/activityTypes');
import { buildActivityWhereClause, GlobalActivityFilters } from '../utils/activityFilters';
import { sponsoredActivityService } from './sponsoredActivityService';
import { calculateDistance } from '../utils/distanceUtils';

interface SearchParams {
  search?: string;
  category?: string;
  categories?: string; // Comma-separated list of categories or activity types
  activityType?: string; // Filter by activity type ID or code
  activitySubtype?: string; // Filter by activity subtype ID or code
  ageMin?: number;
  ageMax?: number;
  gender?: string; // 'male' or 'female' - filters activities; null/undefined = show all
  costMin?: number;
  costMax?: number;
  startDate?: Date;
  endDate?: Date;
  dateMatchMode?: 'partial' | 'full'; // 'partial' = overlap, 'full' = completely within range
  dayOfWeek?: string[];
  location?: string;
  locations?: string[]; // Support multiple locations
  city?: string; // Filter by city name (fallback when no coordinates)
  province?: string; // Filter by province/state (fallback when no coordinates)
  providerId?: string;
  hideClosedActivities?: boolean; // Hide activities that are closed for registration
  hideFullActivities?: boolean; // Hide activities with no spots available
  hideClosedOrFull?: boolean; // Hide activities that are closed OR full
  hasCoordinates?: boolean; // Only return activities with lat/lng for map view
  environmentFilter?: 'indoor' | 'outdoor' | 'all'; // Filter by indoor/outdoor
  // Geographic filtering - bounding box based on user location and radius
  userLat?: number; // User's latitude for distance filtering
  userLon?: number; // User's longitude for distance filtering
  radiusKm?: number; // Search radius in kilometers
  limit?: number;
  offset?: number;
  sortBy?: 'cost' | 'dateStart' | 'name' | 'createdAt' | 'distance' | 'availability';
  sortOrder?: 'asc' | 'desc';
  includeInactive?: boolean; // Only for admin use
  includePastActivities?: boolean; // Only for admin use - include activities with end dates in the past
  randomSeed?: string; // Seed for consistent random ordering across pagination
  // Sponsored activity options
  sponsoredMode?: 'top' | 'section' | 'none'; // 'top' = 3 at top of results, 'section' = sponsor section only, 'none' = no sponsored
  userId?: string; // For impression tracking
  sessionId?: string; // For impression tracking
  deviceType?: string; // For impression tracking
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
      gender,
      costMin,
      costMax,
      startDate,
      endDate,
      dateMatchMode = 'partial',
      dayOfWeek,
      location,
      locations, // Support multiple locations
      city, // Filter by city name
      province, // Filter by province/state
      providerId,
      hideClosedActivities = false,
      hideFullActivities = false,
      hideClosedOrFull = false,
      hasCoordinates = false,
      environmentFilter,
      // Geographic filtering
      userLat,
      userLon,
      radiusKm,
      limit = 50,
      offset = 0,
      sortBy = 'availability', // Default to availability-first random ordering
      sortOrder = 'asc',
      includeInactive = false,
      includePastActivities = false,
      randomSeed,
      // Sponsored activity options
      sponsoredMode = 'top', // Default: show 3 sponsored at top
      userId,
      sessionId,
      deviceType
    } = params;

    // DEBUG LOGGING
    console.log('🔍 [ActivityService] searchActivities called with:', {
      activityType,
      activitySubtype,
      hideClosedActivities,
      hideFullActivities,
      hideClosedOrFull,
      userLat,
      userLon,
      radiusKm,
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

    // Exclude past activities filter:
    // - By default, hide activities whose end date has passed
    // - Activities with no end date (null) are included
    // - For admin use, can include past activities with includePastActivities=true
    if (!includePastActivities) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today

      // Add as AND condition - activity must have either:
      // 1. An end date >= today (not yet ended)
      // 2. No end date (dateEnd is null)
      where.AND = where.AND || [];
      (where.AND as Prisma.ActivityWhereInput[]).push({
        OR: [
          { dateEnd: { gte: today } },
          { dateEnd: null }
        ]
      });

      console.log('📅 [ActivityService] Excluding past activities (dateEnd >= today or null)');
    }

    // Map view filter - only return activities with coordinates
    if (hasCoordinates) {
      where.latitude = { not: null };
      where.longitude = { not: null };
    }

    // Environment filter (indoor/outdoor)
    if (environmentFilter && environmentFilter !== 'all') {
      if (environmentFilter === 'indoor') {
        where.isIndoor = true;
      } else if (environmentFilter === 'outdoor') {
        where.isIndoor = false;
      }
      console.log(`🏠 [ActivityService] Environment filter applied: ${environmentFilter}`);
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
              { code: { in: activityTypes.map((t: string) => t.toLowerCase().replace(/\s+/g, '-')) } },
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

    // Gender filter - TOP PRIORITY for matching child to activities
    // Logic: If child has gender specified, only show activities that:
    // 1. Are explicitly for that gender (gender = 'male' or 'female')
    // 2. OR are for all genders (gender = null)
    // Activities with null gender are available to everyone
    if (gender && (gender === 'male' || gender === 'female')) {
      const genderFilter: Prisma.ActivityWhereInput = {
        OR: [
          { gender: gender },      // Activity specifically for this gender
          { gender: null }         // Activity for all genders (no restriction)
        ]
      };
      where.AND = where.AND || [];
      (where.AND as Prisma.ActivityWhereInput[]).push(genderFilter);
      console.log(`👤 [ActivityService] Gender filter applied: ${gender} (includes null/unspecified)`);
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

    // Day of week filter - check both Activity.dayOfWeek array and ActivitySession.dayOfWeek
    // Activity.dayOfWeek is a String[] with abbreviated day names (Mon, Tue, etc.)
    // ActivitySession.dayOfWeek is a String? with abbreviated day names
    // Frontend sends full names (Monday, Tuesday) but DB has abbreviated (Mon, Tue)
    if (dayOfWeek && dayOfWeek.length > 0) {
      // Map full day names to abbreviated format
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
        // Filter activities that have the day in EITHER:
        // 1. Activity.dayOfWeek array (primary storage)
        // 2. ActivitySession.dayOfWeek (legacy/secondary storage)
        const dayOfWeekFilter: Prisma.ActivityWhereInput = {
          OR: [
            // Check Activity.dayOfWeek array - hasSome checks if array contains any of the values
            { dayOfWeek: { hasSome: abbreviatedDays } },
            // Also check sessions table for activities that store days there
            { sessions: { some: { dayOfWeek: { in: abbreviatedDays } } } }
          ]
        };

        // Add to AND conditions to combine with other filters
        where.AND = where.AND || [];
        (where.AND as Prisma.ActivityWhereInput[]).push(dayOfWeekFilter);

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

    // City/Province filter - fallback when no coordinates available
    // Only apply if we don't already have location filtering via locations array
    if (!hasLocationFilter && (city || province)) {
      const cityProvinceConditions: Prisma.ActivityWhereInput[] = [];

      if (city) {
        cityProvinceConditions.push({
          location: { is: { city: { equals: city, mode: 'insensitive' } } }
        });
        console.log('📍 [ActivityService] City filter applied:', city);
      }

      if (province) {
        cityProvinceConditions.push({
          location: { is: { province: { equals: province, mode: 'insensitive' } } }
        });
        console.log('📍 [ActivityService] Province filter applied:', province);
      }

      // If both city and province specified, require both (AND)
      if (city && province) {
        where.AND = where.AND || [];
        (where.AND as Prisma.ActivityWhereInput[]).push(...cityProvinceConditions);
      } else {
        // Single filter - add to AND conditions
        where.AND = where.AND || [];
        (where.AND as Prisma.ActivityWhereInput[]).push(cityProvinceConditions[0]);
      }
    }

    // Provider filter
    if (providerId) {
      where.providerId = providerId;
    }

    // Apply global filters using shared utility (includes distance filtering)
    console.log('🔧 [ActivityService] Global filter params:', {
      hideClosedActivities,
      hideFullActivities,
      hideClosedOrFull,
      userLat,
      userLon,
      radiusKm,
      types: { hideClosedActivities: typeof hideClosedActivities, hideFullActivities: typeof hideFullActivities, hideClosedOrFull: typeof hideClosedOrFull }
    });

    const finalWhere = buildActivityWhereClause(where, {
      hideClosedActivities,
      hideFullActivities,
      hideClosedOrFull,
      userLat,
      userLon,
      radiusKm,
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

      // Get featured tier priority (lower = better, featured comes first)
      const getFeaturedPriority = (activity: any): number => {
        if (!activity.isFeatured) return 99; // Not featured - lowest priority
        const tier = activity.featuredTier?.toLowerCase();
        if (tier === 'gold') return 0;
        if (tier === 'silver') return 1;
        if (tier === 'bronze') return 2;
        return 3; // Featured but unknown tier
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
          spotsAvailable: true,
          isFeatured: true,
          featuredTier: true
        }
      });

      total = allMatching.length;

      // Sort by: 1) Featured tier (gold > silver > bronze > non-featured)
      //          2) Availability priority
      //          3) Seeded random for consistency
      const sorted = allMatching.sort((a, b) => {
        // First: Featured activities always come first
        const featuredA = getFeaturedPriority(a);
        const featuredB = getFeaturedPriority(b);
        if (featuredA !== featuredB) {
          return featuredA - featuredB;
        }

        // Second: Sort by availability within same featured tier
        const priorityA = getAvailabilityPriority(a);
        const priorityB = getAvailabilityPriority(b);
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        // Third: Use seeded random for consistent pagination
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
      // Always prioritize featured activities first (gold > silver > bronze), then apply requested sort
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
          orderBy: [
            { isFeatured: 'desc' },  // Featured activities first
            { featuredTier: 'asc' }, // Gold < Silver < Bronze alphabetically works for tier ordering
            { [sortBy]: sortOrder }  // Then apply requested sort
          ],
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

    // Calculate distance for each activity if user coordinates provided
    // Also track if activity is in the same city as user for prioritization
    let activitiesWithDistance = activities as (Activity & { distance?: number; isSameCity?: boolean })[];

    // Normalize city for comparison (case-insensitive, trim whitespace)
    const normalizeCity = (c: string | null | undefined): string =>
      (c || '').toLowerCase().trim();
    const userCity = normalizeCity(city);

    if (userLat != null && userLon != null) {
      activitiesWithDistance = activities.map(activity => {
        // Get activity's city from location relation
        const activityCity = normalizeCity((activity as any).location?.city);
        const isSameCity = userCity && activityCity && activityCity === userCity;

        if (activity.latitude != null && activity.longitude != null) {
          const distance = calculateDistance(userLat, userLon, activity.latitude, activity.longitude);
          return {
            ...activity,
            distance: Math.round(distance * 10) / 10, // Round to 1 decimal
            isSameCity
          };
        }
        return { ...activity, distance: undefined, isSameCity };
      });

      // For 'distance' sort mode - sort by same city first, then distance
      if (sortBy === 'distance') {
        activitiesWithDistance.sort((a, b) => {
          // First: Same city activities come first
          if (a.isSameCity && !b.isSameCity) return -1;
          if (!a.isSameCity && b.isSameCity) return 1;

          // Second: Distance (closest first)
          if (a.distance == null && b.distance == null) return 0;
          if (a.distance == null) return 1;
          if (b.distance == null) return -1;
          return a.distance - b.distance;
        });
        console.log(`📍 [ActivityService] Sorted by city + distance (${userCity || 'no city'} first, then closest)`);
      }
      // For 'availability' sort mode - prioritize same city, then availability, then distance
      else if (sortBy === 'availability') {
        const getAvailabilityTier = (activity: any): number => {
          const status = activity.registrationStatus;
          const spots = activity.spotsAvailable;
          if (status === 'Open' && (spots === null || spots > 0)) return 0;
          if (status === 'Waitlist') return 1;
          if (status === null || status === 'Unknown') return 2;
          return 3;
        };

        const getFeaturedTier = (activity: any): number => {
          if (!activity.isFeatured) return 99;
          const tier = activity.featuredTier?.toLowerCase();
          if (tier === 'gold') return 0;
          if (tier === 'silver') return 1;
          if (tier === 'bronze') return 2;
          return 3;
        };

        // Sort by: featured tier → SAME CITY → availability tier → distance
        activitiesWithDistance.sort((a, b) => {
          // First: Featured activities always at top
          const featuredA = getFeaturedTier(a);
          const featuredB = getFeaturedTier(b);
          if (featuredA !== featuredB) return featuredA - featuredB;

          // Second: Same city activities come before other cities
          if (a.isSameCity && !b.isSameCity) return -1;
          if (!a.isSameCity && b.isSameCity) return 1;

          // Third: Availability tier (within same city/other cities)
          const availA = getAvailabilityTier(a);
          const availB = getAvailabilityTier(b);
          if (availA !== availB) return availA - availB;

          // Fourth: Distance (closest first within same availability tier)
          if (a.distance == null && b.distance == null) return 0;
          if (a.distance == null) return 1;
          if (b.distance == null) return -1;
          return a.distance - b.distance;
        });
        console.log(`📍 [ActivityService] Sorted by featured → city (${userCity || 'no city'}) → availability → distance`);
      }
    }

    // Handle sponsored activities (only on first page, only for 'top' mode)
    let sponsoredActivities: Activity[] = [];
    let finalActivities = activitiesWithDistance as Activity[];

    if (sponsoredMode === 'top' && offset === 0) {
      try {
        // Get up to 3 sponsored activities matching the same filters
        const sponsoredResult = await sponsoredActivityService.selectSponsoredActivities(
          finalWhere,
          3, // Max 3 sponsored at top
          true // Exclude from regular sponsor section
        );

        sponsoredActivities = sponsoredResult.sponsoredActivities;

        if (sponsoredActivities.length > 0) {
          // Get IDs of sponsored activities to exclude from regular results
          const sponsoredIds = new Set(sponsoredActivities.map(a => a.id));

          // Filter out sponsored activities from regular results to avoid duplicates
          const regularActivities = activitiesWithDistance.filter(a => !sponsoredIds.has(a.id));

          // Combine: sponsored first, then regular
          // Adjust to maintain the requested limit
          const totalToShow = Math.min(limit, sponsoredActivities.length + regularActivities.length);
          const regularToShow = totalToShow - sponsoredActivities.length;
          finalActivities = [...sponsoredActivities, ...regularActivities.slice(0, regularToShow)] as Activity[];

          console.log(`🎯 [ActivityService] Added ${sponsoredActivities.length} sponsored activities at top`);

          // Record impressions asynchronously (don't wait)
          sponsoredActivityService.recordImpressions(
            sponsoredActivities.map(a => a.id),
            'top_result',
            {
              userId,
              sessionId,
              searchQuery: search,
              filters: { category, activityType, ageMin, ageMax, location },
              deviceType
            }
          ).catch(err => console.error('[ActivityService] Failed to record impressions:', err));
        }
      } catch (error) {
        console.error('[ActivityService] Error getting sponsored activities:', error);
        // Continue with regular activities if sponsored fails
      }
    }

    return {
      activities: finalActivities,
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit)
      },
      // Include metadata about sponsored activities
      sponsored: sponsoredMode === 'top' && offset === 0 ? {
        count: sponsoredActivities.length,
        ids: sponsoredActivities.map(a => a.id)
      } : undefined,
      // Include where clause and filters for aggregation service
      whereClause: finalWhere,
      globalFilters: {
        hideClosedActivities,
        hideFullActivities,
        hideClosedOrFull,
        userLat,
        userLon,
        radiusKm,
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