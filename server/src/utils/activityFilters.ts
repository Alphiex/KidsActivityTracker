import { Prisma } from '../../generated/prisma';
import { getBoundingBox } from './distanceUtils';

export interface GlobalActivityFilters {
  hideClosedActivities?: boolean;
  hideFullActivities?: boolean;
  hideClosedOrFull?: boolean; // Combined filter to hide activities that are closed OR full
  // Distance filtering
  userLat?: number;
  userLon?: number;
  radiusKm?: number;
  // Time slot filtering
  timeSlots?: {
    morning?: boolean;   // 06:00-11:59
    afternoon?: boolean; // 12:00-16:59
    evening?: boolean;   // 17:00-20:59
  };
  // Day of week filtering
  daysOfWeek?: string[];
}

/**
 * Build a Prisma where clause for activities with global filters
 * @param baseWhere - Base where conditions
 * @param filters - Global filters to apply
 * @returns Prisma where clause with filters applied
 */
export function buildActivityWhereClause(
  baseWhere: Prisma.ActivityWhereInput = {},
  filters: GlobalActivityFilters = {}
): Prisma.ActivityWhereInput {
  console.log('🔧 [activityFilters] buildActivityWhereClause called with:', {
    baseWhere: JSON.stringify(baseWhere, null, 2),
    filters
  });
  
  const where: Prisma.ActivityWhereInput = { ...baseWhere };
  const andConditions: Prisma.ActivityWhereInput[] = [];
  
  // Always filter for active activities unless explicitly set otherwise
  // Don't override if isUpdated is already set (isUpdated is the new way to filter active activities)
  if (where.isActive === undefined && where.isUpdated === undefined) {
    where.isActive = true;
  }

  // Kids-only filter: Only show activities appropriate for ages 0-18
  // Exclude adult-only activities (where ageMin > 18)
  andConditions.push({
    OR: [
      { ageMin: { lte: 18 } },
      { ageMin: null }
    ]
  });

  // Apply combined hideClosedOrFull filter if present
  console.log('🔧 [buildActivityWhereClause] Applying filters:', {
    hideClosedOrFull: filters.hideClosedOrFull,
    hideClosedActivities: filters.hideClosedActivities,
    hideFullActivities: filters.hideFullActivities
  });

  if (filters.hideClosedOrFull) {
    console.log('🔧 [buildActivityWhereClause] Applying hideClosedOrFull filter');
    // Exclude activities that are either closed OR have zero spots
    // This is an OR condition - hide if EITHER condition is true:
    // - registrationStatus is 'Closed' OR
    // - spotsAvailable is 0
    // We show activities where BOTH:
    // - registrationStatus is NOT 'Closed' (or null)
    // - spotsAvailable is NOT 0 (or null)
    andConditions.push({
      AND: [
        {
          OR: [
            { registrationStatus: { not: 'Closed' } },
            { registrationStatus: null }
          ]
        },
        {
          OR: [
            { spotsAvailable: { gt: 0 } },
            { spotsAvailable: null }
          ]
        }
      ]
    });
  } else {
    // Apply individual filters if hideClosedOrFull is not set
    // Hide closed activities (based on registration status)
    if (filters.hideClosedActivities) {
      // Exclude activities with "Closed" registration status
      andConditions.push({
        NOT: { registrationStatus: 'Closed' }
      });
    }

    // Hide full activities (no spots available)
    if (filters.hideFullActivities) {
      // Include activities where spots are greater than 0 or null (unlimited)
      andConditions.push({
        OR: [
          { spotsAvailable: { gt: 0 } },
          { spotsAvailable: null }
        ]
      });
    }
  }

  // Time slot filtering
  // Activities have startTime field in format like "9:30 am", "2:00 pm", etc.
  // We filter based on hour ranges:
  // - Morning: 6:00-11:59 (6am-12pm)
  // - Afternoon: 12:00-16:59 (12pm-5pm)
  // - Evening: 17:00-20:59 (5pm-9pm)
  if (filters.timeSlots) {
    const { morning, afternoon, evening } = filters.timeSlots;

    // If all slots are true or all are false, no filtering needed
    const enabledSlots = [morning, afternoon, evening].filter(Boolean);
    if (enabledSlots.length > 0 && enabledSlots.length < 3) {
      // Build time range filter using raw SQL for hour extraction
      // This works with time strings like "9:30 am" by comparing string patterns
      const timeConditions: Prisma.ActivityWhereInput[] = [];

      if (morning) {
        // Morning: 6am-12pm (startTime contains "6:", "7:", ..., "11:" with "am" OR "12:00" etc)
        timeConditions.push({
          OR: [
            { startTime: { contains: ' am' } }, // Any AM time
            { startTime: { startsWith: '12:' } } // 12:xx (noon hour)
          ]
        });
      }

      if (afternoon) {
        // Afternoon: 12pm-5pm
        timeConditions.push({
          OR: [
            { startTime: { startsWith: '12:' } },
            { startTime: { startsWith: '1:' } },
            { startTime: { startsWith: '2:' } },
            { startTime: { startsWith: '3:' } },
            { startTime: { startsWith: '4:' } },
          ]
        });
      }

      if (evening) {
        // Evening: 5pm-9pm
        timeConditions.push({
          OR: [
            { startTime: { startsWith: '5:' } },
            { startTime: { startsWith: '6:' } },
            { startTime: { startsWith: '7:' } },
            { startTime: { startsWith: '8:' } },
          ]
        });
      }

      if (timeConditions.length > 0) {
        andConditions.push({ OR: timeConditions });
      }
    }
  }

  // Day of week filtering
  // Activities have daysOfWeek as an array field
  if (filters.daysOfWeek && filters.daysOfWeek.length > 0 && filters.daysOfWeek.length < 7) {
    // Filter for activities that run on any of the selected days
    andConditions.push({
      daysOfWeek: {
        hasSome: filters.daysOfWeek
      }
    });
  }

  // Distance filtering - apply bounding box pre-filter
  if (filters.userLat != null && filters.userLon != null && filters.radiusKm != null) {
    const boundingBox = getBoundingBox(filters.userLat, filters.userLon, filters.radiusKm);
    console.log('🔧 [buildActivityWhereClause] Applying distance filter:', {
      userLat: filters.userLat,
      userLon: filters.userLon,
      radiusKm: filters.radiusKm,
      boundingBox
    });

    // Add bounding box filter - activities must have coordinates and be within the box
    andConditions.push({
      latitude: { not: null },
      longitude: { not: null }
    });
    andConditions.push({
      latitude: {
        gte: boundingBox.minLat,
        lte: boundingBox.maxLat
      }
    });
    andConditions.push({
      longitude: {
        gte: boundingBox.minLon,
        lte: boundingBox.maxLon
      }
    });
  }

  // Apply AND conditions if any
  if (andConditions.length > 0) {
    if (where.AND) {
      // If there's already an AND condition, merge them
      where.AND = Array.isArray(where.AND) 
        ? [...where.AND, ...andConditions]
        : [where.AND, ...andConditions];
    } else {
      where.AND = andConditions;
    }
  }
  
  return where;
}

/**
 * Extract global filters from request query parameters
 */
export function extractGlobalFilters(query: any): GlobalActivityFilters {
  // Parse distance parameters
  const userLat = query.userLat ? parseFloat(query.userLat) : undefined;
  const userLon = query.userLon ? parseFloat(query.userLon) : undefined;
  const radiusKm = query.radiusKm ? parseFloat(query.radiusKm) : undefined;

  // Parse time slots
  let timeSlots: GlobalActivityFilters['timeSlots'] | undefined;
  if (query.timeMorning !== undefined || query.timeAfternoon !== undefined || query.timeEvening !== undefined) {
    timeSlots = {
      morning: query.timeMorning === 'true' || query.timeMorning === true,
      afternoon: query.timeAfternoon === 'true' || query.timeAfternoon === true,
      evening: query.timeEvening === 'true' || query.timeEvening === true,
    };
  }

  // Parse days of week
  let daysOfWeek: string[] | undefined;
  if (query.daysOfWeek) {
    if (Array.isArray(query.daysOfWeek)) {
      daysOfWeek = query.daysOfWeek;
    } else if (typeof query.daysOfWeek === 'string') {
      daysOfWeek = query.daysOfWeek.split(',').map((d: string) => d.trim());
    }
  }

  const filters: GlobalActivityFilters = {
    hideClosedActivities: query.hideClosedActivities === 'true' || query.hideClosedActivities === true,
    hideFullActivities: query.hideFullActivities === 'true' || query.hideFullActivities === true,
    hideClosedOrFull: query.hideClosedOrFull === 'true' || query.hideClosedOrFull === true,
    // Only include distance params if all three are valid numbers
    ...(userLat != null && !isNaN(userLat) &&
        userLon != null && !isNaN(userLon) &&
        radiusKm != null && !isNaN(radiusKm) && radiusKm > 0
      ? { userLat, userLon, radiusKm }
      : {}),
    // Include time slots if any are specified
    ...(timeSlots ? { timeSlots } : {}),
    // Include days of week if specified
    ...(daysOfWeek && daysOfWeek.length > 0 ? { daysOfWeek } : {}),
  };

  console.log('🔧 [extractGlobalFilters] Input query:', query);
  console.log('🔧 [extractGlobalFilters] Extracted filters:', filters);

  return filters;
}