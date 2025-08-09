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
  includeInactive?: boolean;
}

export class EnhancedActivityService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Define the full activity selection including all enhanced fields
  private getActivitySelect() {
    return {
      id: true,
      providerId: true,
      externalId: true,
      name: true,
      category: true,
      subcategory: true,
      description: true,
      schedule: true,
      dateStart: true,
      dateEnd: true,
      registrationDate: true,
      ageMin: true,
      ageMax: true,
      cost: true,
      spotsAvailable: true,
      totalSpots: true,
      locationId: true,
      locationName: true,
      registrationUrl: true,
      courseId: true,
      isActive: true,
      lastSeenAt: true,
      rawData: true,
      createdAt: true,
      updatedAt: true,
      dayOfWeek: true,
      // Enhanced detail fields
      registrationStatus: true,
      registrationButtonText: true,
      detailUrl: true,
      fullDescription: true,
      instructor: true,
      prerequisites: true,
      whatToBring: true,
      fullAddress: true,
      latitude: true,
      longitude: true,
      directRegistrationUrl: true,
      contactInfo: true,
      // Relations
      provider: true,
      location: true,
      _count: {
        select: { favorites: true }
      }
    };
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
      isActive: includeInactive ? undefined : true
    };

    // Text search
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { fullDescription: { contains: search, mode: 'insensitive' } },
        { locationName: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { subcategory: { contains: search, mode: 'insensitive' } },
        { instructor: { contains: search, mode: 'insensitive' } }
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
      where.OR = [
        { locationName: { contains: location, mode: 'insensitive' } },
        { fullAddress: { contains: location, mode: 'insensitive' } }
      ];
    }

    // Provider filter
    if (providerId) {
      where.providerId = providerId;
    }

    // Execute query with full selection
    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        select: this.getActivitySelect(),
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

  async getActivityById(id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      select: this.getActivitySelect()
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    return activity;
  }

  async getUpcomingActivities(params: { 
    daysAhead?: number; 
    limit?: number; 
    offset?: number;
  } = {}) {
    const { daysAhead = 7, limit = 50, offset = 0 } = params;
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysAhead);

    return this.searchActivities({
      startDate: new Date(),
      endDate,
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
      _count: {
        _all: true
      },
      orderBy: {
        _count: {
          _all: 'desc'
        }
      }
    });

    return categories.map(cat => ({
      category: cat.category,
      count: cat._count._all
    }));
  }

  async getActivityStatusCounts() {
    const [open, waitlist, closed] = await Promise.all([
      this.prisma.activity.count({
        where: { 
          isActive: true,
          registrationStatus: 'Open'
        }
      }),
      this.prisma.activity.count({
        where: { 
          isActive: true,
          registrationStatus: 'WaitList'
        }
      }),
      this.prisma.activity.count({
        where: { 
          isActive: true,
          registrationStatus: 'Closed'
        }
      })
    ]);

    return {
      open,
      waitlist,
      closed,
      total: open + waitlist + closed
    };
  }

  async toggleFavorite(activityId: string, userId: string) {
    const existing = await this.prisma.favorite.findUnique({
      where: {
        userId_activityId: {
          userId,
          activityId
        }
      }
    });

    if (existing) {
      await this.prisma.favorite.delete({
        where: { id: existing.id }
      });
      return { added: false };
    } else {
      await this.prisma.favorite.create({
        data: {
          userId,
          activityId
        }
      });
      return { added: true };
    }
  }

  async getUserFavorites(userId: string, params: SearchParams = {}) {
    const where: Prisma.ActivityWhereInput = {
      ...this.buildWhereClause(params),
      favorites: {
        some: {
          userId
        }
      }
    };

    const [activities, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        select: this.getActivitySelect(),
        orderBy: { [params.sortBy || 'dateStart']: params.sortOrder || 'asc' },
        take: params.limit || 50,
        skip: params.offset || 0
      }),
      this.prisma.activity.count({ where })
    ]);

    return {
      activities,
      pagination: {
        total,
        limit: params.limit || 50,
        offset: params.offset || 0,
        pages: Math.ceil(total / (params.limit || 50))
      }
    };
  }

  private buildWhereClause(params: SearchParams): Prisma.ActivityWhereInput {
    // Extract the where clause building logic from searchActivities
    // This is a helper method to avoid duplication
    const where: Prisma.ActivityWhereInput = {
      isActive: params.includeInactive ? undefined : true
    };

    // ... (copy the where clause building logic from searchActivities)
    
    return where;
  }
}