import { PrismaClient, Activity, Prisma } from '../../generated/prisma';

interface SearchParams {
  search?: string;
  category?: string;
  ageMin?: number;
  ageMax?: number;
  costMin?: number;
  costMax?: number;
  startDate?: Date;
  endDate?: Date;
  dayOfWeek?: string[];
  location?: string;
  providerId?: string;
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
      ageMin,
      ageMax,
      costMin,
      costMax,
      startDate,
      endDate,
      dayOfWeek,
      location,
      providerId,
      limit = 50,
      offset = 0,
      sortBy = 'dateStart',
      sortOrder = 'asc',
      includeInactive = false
    } = params;

    // Build where clause
    const where: Prisma.ActivityWhereInput = {
      // Always filter out inactive activities unless explicitly requested
      isActive: includeInactive ? undefined : true
    };

    // Text search
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { locationName: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { subcategory: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Category filter
    if (category) {
      where.category = category;
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

    // Location filter
    if (location) {
      where.locationName = { contains: location, mode: 'insensitive' };
    }

    // Provider filter
    if (providerId) {
      where.providerId = providerId;
    }

    // Execute query
    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        include: {
          provider: true,
          location: true,
          _count: {
            select: { favorites: true }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset
      }),
      this.prisma.activity.count({ where })
    ]);

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