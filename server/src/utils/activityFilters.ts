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
  if (filters.hideClosedOrFull) {
    // Exclude activities that are either closed OR full
    andConditions.push({
      AND: [
        { NOT: { registrationStatus: 'Closed' } },
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
  return {
    hideClosedActivities: query.hideClosedActivities === 'true' || query.hideClosedActivities === true,
    hideFullActivities: query.hideFullActivities === 'true' || query.hideFullActivities === true,
    hideClosedOrFull: query.hideClosedOrFull === 'true' || query.hideClosedOrFull === true
  };
}