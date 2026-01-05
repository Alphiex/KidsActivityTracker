import { Prisma } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import { buildActivityWhereClause, GlobalActivityFilters } from '../utils/activityFilters';

/**
 * Aggregation types for dynamic filter options
 */
export interface AgeGroupAggregation {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface CostBracketAggregation {
  label: string;
  min: number;
  max: number;
  count: number;
}

export interface DayOfWeekAggregation {
  day: string;
  count: number;
}

export interface ActivityTypeAggregation {
  code: string;
  name: string;
  iconName: string;
  count: number;
}

export interface CityAggregation {
  city: string;
  province: string;
  count: number;
}

export interface EnvironmentAggregation {
  type: 'indoor' | 'outdoor';
  count: number;
}

export interface Aggregations {
  ageGroups: AgeGroupAggregation[];
  costBrackets: CostBracketAggregation[];
  daysOfWeek: DayOfWeekAggregation[];
  activityTypes: ActivityTypeAggregation[];
  cities: CityAggregation[];
  environments: EnvironmentAggregation[];
}

/**
 * Predefined age brackets for filtering
 */
const AGE_BRACKETS: Omit<AgeGroupAggregation, 'count'>[] = [
  { label: '0-3 years', min: 0, max: 3 },
  { label: '4-6 years', min: 4, max: 6 },
  { label: '7-9 years', min: 7, max: 9 },
  { label: '10-12 years', min: 10, max: 12 },
  { label: '13-15 years', min: 13, max: 15 },
  { label: '16-18 years', min: 16, max: 18 },
];

/**
 * Predefined cost brackets for filtering
 */
const COST_BRACKETS: Omit<CostBracketAggregation, 'count'>[] = [
  { label: 'Free', min: 0, max: 0 },
  { label: '$1-25', min: 1, max: 25 },
  { label: '$26-50', min: 26, max: 50 },
  { label: '$51-100', min: 51, max: 100 },
  { label: '$101-200', min: 101, max: 200 },
  { label: '$200+', min: 201, max: 999999 },
];

/**
 * Days of week for filtering
 */
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Map full day names to abbreviated format used in database
 */
const DAY_NAME_MAP: Record<string, string> = {
  'Monday': 'Mon',
  'Tuesday': 'Tue',
  'Wednesday': 'Wed',
  'Thursday': 'Thu',
  'Friday': 'Fri',
  'Saturday': 'Sat',
  'Sunday': 'Sun',
};

/**
 * Service for computing aggregations on activity search results
 */
export class AggregationService {
  /**
   * Get all aggregations for a given search context
   * @param baseWhere - The base Prisma where clause (before global filters)
   * @param globalFilters - Global filters to apply
   */
  async getAggregations(
    baseWhere: Prisma.ActivityWhereInput,
    globalFilters: GlobalActivityFilters = {}
  ): Promise<Aggregations> {
    // Build the final where clause with global filters
    const finalWhere = buildActivityWhereClause(baseWhere, globalFilters);

    console.log('[AggregationService] Computing aggregations for where:',
      JSON.stringify(finalWhere, null, 2).substring(0, 500));

    // Run all aggregation queries in parallel for performance
    const [
      ageGroups,
      costBrackets,
      daysOfWeek,
      activityTypes,
      cities,
      environments
    ] = await Promise.all([
      this.getAgeGroupAggregations(finalWhere),
      this.getCostBracketAggregations(finalWhere),
      this.getDayOfWeekAggregations(finalWhere),
      this.getActivityTypeAggregations(finalWhere),
      this.getCityAggregations(finalWhere),
      this.getEnvironmentAggregations(finalWhere),
    ]);

    return {
      ageGroups,
      costBrackets,
      daysOfWeek,
      activityTypes,
      cities,
      environments,
    };
  }

  /**
   * Count activities in each age bracket
   */
  private async getAgeGroupAggregations(
    baseWhere: Prisma.ActivityWhereInput
  ): Promise<AgeGroupAggregation[]> {
    const counts = await Promise.all(
      AGE_BRACKETS.map(async (bracket) => {
        // Activity overlaps with age bracket if:
        // activity.ageMin <= bracket.max AND activity.ageMax >= bracket.min
        const count = await prisma.activity.count({
          where: {
            ...baseWhere,
            AND: [
              ...(Array.isArray(baseWhere.AND) ? baseWhere.AND : baseWhere.AND ? [baseWhere.AND] : []),
              {
                OR: [
                  { ageMin: { lte: bracket.max } },
                  { ageMin: null }
                ]
              },
              {
                OR: [
                  { ageMax: { gte: bracket.min } },
                  { ageMax: null }
                ]
              }
            ]
          }
        });
        return { ...bracket, count };
      })
    );
    return counts;
  }

  /**
   * Count activities in each cost bracket
   */
  private async getCostBracketAggregations(
    baseWhere: Prisma.ActivityWhereInput
  ): Promise<CostBracketAggregation[]> {
    const counts = await Promise.all(
      COST_BRACKETS.map(async (bracket) => {
        let costWhere: Prisma.ActivityWhereInput;

        if (bracket.min === 0 && bracket.max === 0) {
          // Free: cost = 0 or cost = null
          costWhere = {
            OR: [
              { cost: 0 },
              { cost: null }
            ]
          };
        } else if (bracket.max === 999999) {
          // $200+: cost > 200
          costWhere = { cost: { gt: 200 } };
        } else {
          // Range: min <= cost <= max
          costWhere = {
            cost: {
              gte: bracket.min,
              lte: bracket.max
            }
          };
        }

        const count = await prisma.activity.count({
          where: {
            ...baseWhere,
            AND: [
              ...(Array.isArray(baseWhere.AND) ? baseWhere.AND : baseWhere.AND ? [baseWhere.AND] : []),
              costWhere
            ]
          }
        });
        return { ...bracket, count };
      })
    );
    return counts;
  }

  /**
   * Count activities for each day of week
   */
  private async getDayOfWeekAggregations(
    baseWhere: Prisma.ActivityWhereInput
  ): Promise<DayOfWeekAggregation[]> {
    const counts = await Promise.all(
      DAYS_OF_WEEK.map(async (day) => {
        const abbreviatedDay = DAY_NAME_MAP[day];
        const count = await prisma.activity.count({
          where: {
            ...baseWhere,
            AND: [
              ...(Array.isArray(baseWhere.AND) ? baseWhere.AND : baseWhere.AND ? [baseWhere.AND] : []),
              {
                OR: [
                  // Check Activity.dayOfWeek array
                  { dayOfWeek: { has: abbreviatedDay } },
                  // Also check sessions table
                  { sessions: { some: { dayOfWeek: abbreviatedDay } } }
                ]
              }
            ]
          }
        });
        return { day, count };
      })
    );
    return counts;
  }

  /**
   * Count activities for each activity type
   */
  private async getActivityTypeAggregations(
    baseWhere: Prisma.ActivityWhereInput
  ): Promise<ActivityTypeAggregation[]> {
    // Get all activity types with their counts
    const activityTypes = await prisma.activityType.findMany({
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        iconName: true,
      }
    });

    const counts = await Promise.all(
      activityTypes.map(async (type) => {
        const count = await prisma.activity.count({
          where: {
            ...baseWhere,
            activityTypeId: type.id,
          }
        });
        return {
          code: type.code,
          name: type.name,
          iconName: type.iconName || 'tag',
          count
        };
      })
    );

    // Filter out types with 0 count and sort by count descending
    return counts
      .filter(t => t.count > 0)
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Count activities for each city
   */
  private async getCityAggregations(
    baseWhere: Prisma.ActivityWhereInput
  ): Promise<CityAggregation[]> {
    // Use raw SQL for efficient grouping
    // First, get activities matching the where clause, then group by location city
    const activities = await prisma.activity.findMany({
      where: baseWhere,
      select: {
        location: {
          select: {
            city: true,
            province: true,
          }
        }
      }
    });

    // Group by city/province
    const cityMap = new Map<string, { city: string; province: string; count: number }>();

    for (const activity of activities) {
      const city = activity.location?.city;
      const province = activity.location?.province;

      if (city) {
        const key = `${city.toLowerCase()}|${(province || '').toLowerCase()}`;
        const existing = cityMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          cityMap.set(key, { city, province: province || '', count: 1 });
        }
      }
    }

    // Convert to array and sort by count
    return Array.from(cityMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 50); // Limit to top 50 cities
  }

  /**
   * Count activities by environment (indoor/outdoor)
   */
  private async getEnvironmentAggregations(
    baseWhere: Prisma.ActivityWhereInput
  ): Promise<EnvironmentAggregation[]> {
    const [indoorCount, outdoorCount] = await Promise.all([
      prisma.activity.count({
        where: {
          ...baseWhere,
          isIndoor: true,
        }
      }),
      prisma.activity.count({
        where: {
          ...baseWhere,
          isIndoor: false,
        }
      }),
    ]);

    return [
      { type: 'indoor', count: indoorCount },
      { type: 'outdoor', count: outdoorCount },
    ];
  }
}

// Export singleton instance
export const aggregationService = new AggregationService();
