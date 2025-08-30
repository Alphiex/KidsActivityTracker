import { PrismaClient, ChildActivity, Activity, Prisma } from '../../generated/prisma';
import { calculateAge, getAgeAppropriateRange, getCalendarDateRange } from '../utils/dateUtils';
import { childrenService } from './childrenService';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export type ActivityStatus = 'interested' | 'registered' | 'completed' | 'cancelled';

export interface LinkActivityInput {
  childId: string;
  activityId: string;
  status: ActivityStatus;
  notes?: string;
}

export interface UpdateActivityStatusInput {
  status: ActivityStatus;
  notes?: string;
  rating?: number;
}

export interface ActivityHistoryFilters {
  childId?: string;
  status?: ActivityStatus;
  startDate?: Date;
  endDate?: Date;
  category?: string;
  minRating?: number;
}

export interface CalendarEvent {
  id: string;
  childId: string;
  childName: string;
  activityId: string;
  activityName: string;
  status: ActivityStatus;
  startDate: Date | null;
  endDate: Date | null;
  location: string | null;
  category: string;
}

export class ChildActivityService {
  /**
   * Link an activity to a child
   */
  async linkActivity(userId: string, input: LinkActivityInput): Promise<ChildActivity> {
    // Verify child ownership
    const isOwner = await childrenService.verifyChildOwnership(input.childId, userId);
    if (!isOwner) {
      throw new Error('Unauthorized: You do not own this child profile');
    }

    // Check if activity exists
    const activity = await prisma.activity.findUnique({
      where: { id: input.activityId }
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    // Create or update the link
    const existingLink = await prisma.childActivity.findUnique({
      where: {
        childId_activityId: {
          childId: input.childId,
          activityId: input.activityId
        }
      }
    });

    const now = new Date();
    const data: Prisma.ChildActivityUpdateInput = {
      status: input.status,
      notes: input.notes,
      ...(input.status === 'registered' && !existingLink?.registeredAt && { registeredAt: now }),
      ...(input.status === 'completed' && { completedAt: now })
    };

    if (existingLink) {
      return await prisma.childActivity.update({
        where: { id: existingLink.id },
        data
      });
    }

    return await prisma.childActivity.create({
      data: {
        childId: input.childId,
        activityId: input.activityId,
        status: input.status,
        notes: input.notes,
        ...(input.status === 'registered' && { registeredAt: now }),
        ...(input.status === 'completed' && { completedAt: now }),
      }
    });
  }

  /**
   * Update activity status for a child
   */
  async updateActivityStatus(
    userId: string,
    childId: string,
    activityId: string,
    input: UpdateActivityStatusInput
  ): Promise<ChildActivity> {
    // Verify child ownership
    const isOwner = await childrenService.verifyChildOwnership(childId, userId);
    if (!isOwner) {
      throw new Error('Unauthorized: You do not own this child profile');
    }

    const childActivity = await prisma.childActivity.findUnique({
      where: {
        childId_activityId: { childId, activityId }
      }
    });

    if (!childActivity) {
      throw new Error('Activity link not found');
    }

    const now = new Date();
    const data: Prisma.ChildActivityUpdateInput = {
      status: input.status,
      notes: input.notes,
      rating: input.rating,
      ...(input.status === 'registered' && !childActivity.registeredAt && { registeredAt: now }),
      ...(input.status === 'completed' && { completedAt: now })
    };

    return await prisma.childActivity.update({
      where: { id: childActivity.id },
      data
    });
  }

  /**
   * Remove activity link
   */
  async unlinkActivity(userId: string, childId: string, activityId: string): Promise<boolean> {
    // Verify child ownership
    const isOwner = await childrenService.verifyChildOwnership(childId, userId);
    if (!isOwner) {
      throw new Error('Unauthorized: You do not own this child profile');
    }

    try {
      await prisma.childActivity.delete({
        where: {
          childId_activityId: { childId, activityId }
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get activity history for a child or all children
   */
  async getActivityHistory(userId: string, filters: ActivityHistoryFilters = {}): Promise<any[]> {
    // If specific child, verify ownership
    if (filters.childId) {
      const isOwner = await childrenService.verifyChildOwnership(filters.childId, userId);
      if (!isOwner) {
        throw new Error('Unauthorized: You do not own this child profile');
      }
    }

    const whereClause: Prisma.ChildActivityWhereInput = {
      child: {
        userId,
        isActive: true
      },
      ...(filters.childId && { childId: filters.childId }),
      ...(filters.status && { status: filters.status }),
      ...(filters.minRating && { rating: { gte: filters.minRating } }),
      ...(filters.category && {
        activity: { category: filters.category }
      })
    };

    if (filters.startDate || filters.endDate) {
      whereClause.OR = [
        {
          activity: {
            dateStart: {
              ...(filters.startDate && { gte: filters.startDate }),
              ...(filters.endDate && { lte: filters.endDate })
            }
          }
        },
        {
          registeredAt: {
            ...(filters.startDate && { gte: filters.startDate }),
            ...(filters.endDate && { lte: filters.endDate })
          }
        },
        {
          completedAt: {
            ...(filters.startDate && { gte: filters.startDate }),
            ...(filters.endDate && { lte: filters.endDate })
          }
        }
      ];
    }

    const activities = await prisma.childActivity.findMany({
      where: whereClause,
      include: {
        child: true,
        activity: {
          include: {
            location: true,
            provider: true
          }
        }
      },
      orderBy: [
        { completedAt: 'desc' },
        { registeredAt: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return activities.map(item => ({
      ...item,
      childAge: calculateAge(item.child.dateOfBirth)
    }));
  }

  /**
   * Get age-appropriate activity recommendations
   */
  async getAgeAppropriateActivities(userId: string, childId: string): Promise<Activity[]> {
    // Verify child ownership and get child data
    const child = await childrenService.getChildById(childId, userId);
    if (!child) {
      throw new Error('Child not found or unauthorized');
    }

    const { minAge, maxAge } = getAgeAppropriateRange(child.age);

    // Get already linked activities to exclude
    const linkedActivities = await prisma.childActivity.findMany({
      where: { childId },
      select: { activityId: true }
    });
    const linkedActivityIds = linkedActivities.map(la => la.activityId);

    // Find activities matching age range and interests
    const activities = await prisma.activity.findMany({
      where: {
        isActive: true,
        id: { notIn: linkedActivityIds },
        OR: [
          {
            AND: [
              { ageMin: { lte: child.age } },
              { ageMax: { gte: child.age } }
            ]
          },
          {
            AND: [
              { ageMin: { lte: maxAge } },
              { ageMax: { gte: minAge } }
            ]
          }
        ],
        ...(child.interests.length > 0 && {
          OR: [
            { category: { in: child.interests } },
            { subcategory: { in: child.interests } }
          ]
        })
      },
      include: {
        location: true,
        provider: true
      },
      orderBy: [
        { dateStart: 'asc' },
        { cost: 'asc' }
      ],
      take: 50
    });

    return activities;
  }

  /**
   * Get favorite activities for a child
   */
  async getChildFavorites(userId: string, childId: string): Promise<any[]> {
    // Verify child ownership
    const isOwner = await childrenService.verifyChildOwnership(childId, userId);
    if (!isOwner) {
      throw new Error('Unauthorized: You do not own this child profile');
    }

    const activities = await prisma.childActivity.findMany({
      where: {
        childId,
        OR: [
          { status: 'registered' },
          { status: 'completed', rating: { gte: 4 } }
        ]
      },
      include: {
        activity: {
          include: {
            location: true,
            provider: true
          }
        }
      },
      orderBy: [
        { rating: 'desc' },
        { completedAt: 'desc' }
      ]
    });

    return activities;
  }

  /**
   * Get calendar data for child activities
   */
  async getCalendarData(
    userId: string,
    view: 'week' | 'month' | 'year',
    date: Date,
    childIds?: string[]
  ): Promise<CalendarEvent[]> {
    // If specific children, verify ownership
    if (childIds && childIds.length > 0) {
      for (const childId of childIds) {
        const isOwner = await childrenService.verifyChildOwnership(childId, userId);
        if (!isOwner) {
          throw new Error(`Unauthorized: You do not own child profile ${childId}`);
        }
      }
    }

    const { start, end } = getCalendarDateRange(view, date);

    const activities = await prisma.childActivity.findMany({
      where: {
        child: {
          userId,
          isActive: true,
          ...(childIds && childIds.length > 0 && { id: { in: childIds } })
        },
        status: { in: ['registered', 'completed'] },
        activity: {
          OR: [
            {
              dateStart: {
                gte: start,
                lte: end
              }
            },
            {
              dateEnd: {
                gte: start,
                lte: end
              }
            },
            {
              AND: [
                { dateStart: { lte: start } },
                { dateEnd: { gte: end } }
              ]
            }
          ]
        }
      },
      include: {
        child: true,
        activity: {
          include: {
            location: true
          }
        }
      }
    });

    return activities.map(item => ({
      id: item.id,
      childId: item.child.id,
      childName: item.child.name,
      activityId: item.activity.id,
      activityName: item.activity.name,
      status: item.status as ActivityStatus,
      startDate: item.activity.dateStart,
      endDate: item.activity.dateEnd,
      location: item.activity.location?.name || item.activity.locationName,
      category: item.activity.category
    }));
  }

  /**
   * Get activity statistics for children
   */
  async getActivityStats(userId: string, childIds?: string[]): Promise<any> {
    const children = childIds && childIds.length > 0
      ? childIds
      : (await childrenService.getChildrenByUserId(userId)).map(c => c.id);

    // Verify ownership of all children
    for (const childId of children) {
      const isOwner = await childrenService.verifyChildOwnership(childId, userId);
      if (!isOwner) {
        throw new Error(`Unauthorized: You do not own child profile ${childId}`);
      }
    }

    const stats = await prisma.childActivity.groupBy({
      by: ['childId', 'status'],
      where: {
        childId: { in: children }
      },
      _count: true
    });

    const categoryStats = await prisma.childActivity.groupBy({
      by: ['childId'],
      where: {
        childId: { in: children }
      },
      _count: true
    });

    // Get rating stats for completed activities
    const ratingStats = await prisma.childActivity.aggregate({
      where: {
        childId: { in: children },
        status: 'completed',
        rating: { not: null }
      },
      _avg: { rating: true },
      _count: { rating: true }
    });

    return {
      byStatus: stats,
      totalActivities: categoryStats,
      averageRating: ratingStats._avg.rating || 0,
      totalRated: ratingStats._count.rating
    };
  }

  /**
   * Bulk link activities to a child
   */
  async bulkLinkActivities(
    userId: string,
    childId: string,
    activityIds: string[],
    status: ActivityStatus = 'interested'
  ): Promise<number> {
    // Verify child ownership
    const isOwner = await childrenService.verifyChildOwnership(childId, userId);
    if (!isOwner) {
      throw new Error('Unauthorized: You do not own this child profile');
    }

    // Filter out already linked activities
    const existingLinks = await prisma.childActivity.findMany({
      where: {
        childId,
        activityId: { in: activityIds }
      },
      select: { activityId: true }
    });

    const existingActivityIds = new Set(existingLinks.map(link => link.activityId));
    const newActivityIds = activityIds.filter(id => !existingActivityIds.has(id));

    if (newActivityIds.length === 0) {
      return 0;
    }

    const now = new Date();
    const data = newActivityIds.map(activityId => ({
      childId,
      activityId,
      status,
      ...(status === 'registered' && { registeredAt: now }),
    }));

    const result = await prisma.childActivity.createMany({
      data,
      skipDuplicates: true
    });

    return result.count;
  }

  /**
   * Get upcoming activities for notification
   */
  async getUpcomingActivities(userId: string, days = 7): Promise<any[]> {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const activities = await prisma.childActivity.findMany({
      where: {
        child: {
          userId,
          isActive: true
        },
        status: 'registered',
        activity: {
          dateStart: {
            gte: new Date(),
            lte: endDate
          },
          isActive: true
        }
      },
      include: {
        child: true,
        activity: {
          include: {
            location: true,
            provider: true
          }
        }
      },
      orderBy: {
        activity: {
          dateStart: 'asc'
        }
      }
    });

    return activities;
  }
}

export const childActivityService = new ChildActivityService();