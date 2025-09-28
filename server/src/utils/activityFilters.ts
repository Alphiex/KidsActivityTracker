import { Prisma } from '../../generated/prisma';

export interface GlobalActivityFilters {
  hideClosedActivities?: boolean;
  hideFullActivities?: boolean;
  hideClosedOrFull?: boolean; // Combined filter to hide activities that are closed OR full
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
  const filters = {
    hideClosedActivities: query.hideClosedActivities === 'true' || query.hideClosedActivities === true,
    hideFullActivities: query.hideFullActivities === 'true' || query.hideFullActivities === true,
    hideClosedOrFull: query.hideClosedOrFull === 'true' || query.hideClosedOrFull === true
  };

  console.log('🔧 [extractGlobalFilters] Input query:', query);
  console.log('🔧 [extractGlobalFilters] Extracted filters:', filters);

  return filters;
}