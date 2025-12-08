import { PrismaClient, Child, Prisma } from '../../generated/prisma';
import { calculateAge } from '../utils/dateUtils';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export interface CreateChildInput {
  userId: string;
  name: string;
  dateOfBirth: Date;
  gender?: string;
  avatarUrl?: string;
  interests?: string[];
  notes?: string;
}

export interface UpdateChildInput {
  name?: string;
  dateOfBirth?: Date;
  gender?: string;
  avatarUrl?: string;
  interests?: string[];
  notes?: string;
  isActive?: boolean;
}

export interface ChildWithAge extends Child {
  age: number;
  ageInMonths: number;
}

export class ChildrenService {
  /**
   * Create a new child profile
   */
  async createChild(data: CreateChildInput): Promise<Child> {
    return await prisma.child.create({
      data: {
        userId: data.userId,
        name: data.name,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        avatarUrl: data.avatarUrl,
        interests: data.interests || [],
        notes: data.notes,
      }
    });
  }

  /**
   * Get all children for a user
   */
  async getChildrenByUserId(userId: string, includeInactive = false): Promise<ChildWithAge[]> {
    const children = await prisma.child.findMany({
      where: {
        userId,
        ...(includeInactive ? {} : { isActive: true })
      },
      orderBy: {
        dateOfBirth: 'asc'
      }
    });

    return children.map(child => ({
      ...child,
      age: calculateAge(child.dateOfBirth),
      ageInMonths: calculateAge(child.dateOfBirth, true)
    }));
  }

  /**
   * Get a single child by ID (with ownership check)
   */
  async getChildById(childId: string, userId: string): Promise<ChildWithAge | null> {
    const child = await prisma.child.findFirst({
      where: {
        id: childId,
        userId
      }
    });

    if (!child) return null;

    return {
      ...child,
      age: calculateAge(child.dateOfBirth),
      ageInMonths: calculateAge(child.dateOfBirth, true)
    };
  }

  /**
   * Update a child profile
   */
  async updateChild(childId: string, userId: string, data: UpdateChildInput): Promise<Child | null> {
    // Verify ownership
    const child = await prisma.child.findFirst({
      where: { id: childId, userId }
    });

    if (!child) return null;

    return await prisma.child.update({
      where: { id: childId },
      data
    });
  }

  /**
   * Soft delete a child profile
   */
  async deleteChild(childId: string, userId: string): Promise<boolean> {
    // Verify ownership
    const child = await prisma.child.findFirst({
      where: { id: childId, userId }
    });

    if (!child) return false;

    await prisma.child.update({
      where: { id: childId },
      data: { isActive: false }
    });

    return true;
  }

  /**
   * Permanently delete a child profile
   */
  async permanentlyDeleteChild(childId: string, userId: string): Promise<boolean> {
    // Verify ownership
    const child = await prisma.child.findFirst({
      where: { id: childId, userId }
    });

    if (!child) return false;

    // This will cascade delete all related records (activities, shares, etc.)
    await prisma.child.delete({
      where: { id: childId }
    });

    return true;
  }

  /**
   * Get children with their activity counts
   */
  async getChildrenWithActivityStats(userId: string): Promise<any[]> {
    const children = await prisma.child.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        childActivities: {
          select: {
            status: true
          }
        }
      }
    });

    return children.map(child => {
      const stats = {
        planned: 0,
        in_progress: 0,
        completed: 0
      };

      child.childActivities.forEach(activity => {
        const status = activity.status as keyof typeof stats;
        if (status in stats) {
          stats[status]++;
        }
      });

      const { childActivities, ...childData } = child;

      return {
        ...childData,
        age: calculateAge(child.dateOfBirth),
        ageInMonths: calculateAge(child.dateOfBirth, true),
        activityStats: stats
      };
    });
  }

  /**
   * Check if a user owns a child
   */
  async verifyChildOwnership(childId: string, userId: string): Promise<boolean> {
    const child = await prisma.child.findFirst({
      where: {
        id: childId,
        userId
      }
    });

    return !!child;
  }

  /**
   * Batch verify ownership of multiple children (prevents N+1 queries)
   * Returns object mapping childId to ownership status
   */
  async verifyMultipleChildOwnership(
    childIds: string[],
    userId: string
  ): Promise<Record<string, boolean>> {
    if (childIds.length === 0) {
      return {};
    }

    // Single query to get all owned children
    const ownedChildren = await prisma.child.findMany({
      where: {
        id: { in: childIds },
        userId
      },
      select: { id: true }
    });

    const ownedSet = new Set(ownedChildren.map(c => c.id));

    // Build result object
    const result: Record<string, boolean> = {};
    for (const childId of childIds) {
      result[childId] = ownedSet.has(childId);
    }

    return result;
  }

  /**
   * Batch verify ownership and return only valid (owned) child IDs
   */
  async filterOwnedChildIds(childIds: string[], userId: string): Promise<string[]> {
    if (childIds.length === 0) {
      return [];
    }

    const ownedChildren = await prisma.child.findMany({
      where: {
        id: { in: childIds },
        userId
      },
      select: { id: true }
    });

    return ownedChildren.map(c => c.id);
  }

  /**
   * Get children by age range
   */
  async getChildrenByAgeRange(userId: string, minAge: number, maxAge: number): Promise<ChildWithAge[]> {
    const children = await prisma.child.findMany({
      where: {
        userId,
        isActive: true
      }
    });

    return children
      .map(child => ({
        ...child,
        age: calculateAge(child.dateOfBirth),
        ageInMonths: calculateAge(child.dateOfBirth, true)
      }))
      .filter(child => child.age >= minAge && child.age <= maxAge);
  }

  /**
   * Search children by name or interests
   */
  async searchChildren(userId: string, query: string): Promise<ChildWithAge[]> {
    const children = await prisma.child.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { interests: { hasSome: [query] } },
          { notes: { contains: query, mode: 'insensitive' } }
        ]
      }
    });

    return children.map(child => ({
      ...child,
      age: calculateAge(child.dateOfBirth),
      ageInMonths: calculateAge(child.dateOfBirth, true)
    }));
  }

  /**
   * Update child interests
   */
  async updateChildInterests(childId: string, userId: string, interests: string[]): Promise<Child | null> {
    // Verify ownership
    const child = await prisma.child.findFirst({
      where: { id: childId, userId }
    });

    if (!child) return null;

    return await prisma.child.update({
      where: { id: childId },
      data: { interests }
    });
  }

  /**
   * Get shared children (children shared with the user)
   */
  async getSharedChildren(userId: string): Promise<any[]> {
    const shares = await prisma.activityShare.findMany({
      where: {
        sharedWithUserId: userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        profiles: {
          include: {
            child: true
          }
        },
        sharingUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    const sharedChildren: any[] = [];

    shares.forEach(share => {
      share.profiles.forEach(profile => {
        sharedChildren.push({
          ...profile.child,
          age: calculateAge(profile.child.dateOfBirth),
          ageInMonths: calculateAge(profile.child.dateOfBirth, true),
          sharedBy: share.sharingUser,
          shareId: share.id,
          permissions: {
            canViewInterested: profile.canViewInterested,
            canViewRegistered: profile.canViewRegistered,
            canViewCompleted: profile.canViewCompleted,
            canViewNotes: profile.canViewNotes
          }
        });
      });
    });

    return sharedChildren;
  }

  /**
   * Bulk create children
   */
  async bulkCreateChildren(userId: string, children: Omit<CreateChildInput, 'userId'>[]): Promise<Child[]> {
    const data = children.map(child => ({
      ...child,
      userId,
      interests: child.interests || [],
    }));

    return await prisma.$transaction(
      data.map(childData =>
        prisma.child.create({ data: childData })
      )
    );
  }

  /**
   * Add an activity to a child's calendar
   */
  async addActivityToChild(
    childId: string,
    activityId: string,
    userId: string,
    status: string = 'planned',
    scheduledDate?: Date,
    startTime?: string,
    endTime?: string,
    notes?: string
  ) {
    // Verify child ownership
    const child = await prisma.child.findFirst({
      where: { id: childId, userId }
    });

    if (!child) {
      throw new Error('Child not found or access denied');
    }

    // Verify activity exists
    const activity = await prisma.activity.findUnique({
      where: { id: activityId }
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    // Check if already assigned
    const existing = await prisma.childActivity.findUnique({
      where: {
        childId_activityId: {
          childId,
          activityId
        }
      }
    });

    if (existing) {
      throw new Error('Activity already assigned to this child');
    }

    // Create the child activity
    return await prisma.childActivity.create({
      data: {
        childId,
        activityId,
        status,
        scheduledDate,
        startTime,
        endTime,
        notes
      },
      include: {
        activity: {
          include: {
            location: true,
            sessions: true,
            activityType: true, // Include activity type for image display
            activitySubtype: true // Include activity subtype for image display
          }
        },
        child: true
      }
    });
  }

  /**
   * Get activities assigned to a child
   */
  async getChildActivities(childId: string, userId: string, status?: string) {
    // Verify child ownership or shared access
    const child = await prisma.child.findFirst({
      where: {
        OR: [
          { id: childId, userId }, // User owns the child
          {
            id: childId,
            user: {
              myShares: {
                some: {
                  sharedWithUserId: userId,
                  isActive: true,
                  profiles: {
                    some: {
                      childId
                    }
                  }
                }
              }
            }
          }
        ]
      }
    });

    if (!child) {
      throw new Error('Child not found or access denied');
    }

    const where: any = { childId };
    if (status) {
      where.status = status;
    }

    return await prisma.childActivity.findMany({
      where,
      include: {
        activity: {
          include: {
            location: true,
            sessions: true, // Include sessions for recurring activities
            activityType: true, // Include activity type for image display
            activitySubtype: true // Include activity subtype for image display
          }
        }
      },
      orderBy: [
        { scheduledDate: 'asc' },
        { createdAt: 'desc' }
      ]
    });
  }

  /**
   * Get all activities for all children of a user (for calendar view)
   */
  async getAllChildActivitiesForUser(userId: string, startDate?: Date, endDate?: Date) {
    const where: any = {
      child: {
        userId
      }
    };

    if (startDate || endDate) {
      where.scheduledDate = {};
      if (startDate) where.scheduledDate.gte = startDate;
      if (endDate) where.scheduledDate.lte = endDate;
    }

    return await prisma.childActivity.findMany({
      where,
      include: {
        activity: {
          include: {
            location: true,
            sessions: true, // Include sessions for recurring activities
            activityType: true, // Include activity type for image display
            activitySubtype: true // Include activity subtype for image display
          }
        },
        child: true
      },
      orderBy: [
        { scheduledDate: 'asc' },
        { createdAt: 'desc' }
      ]
    });
  }

  /**
   * Update child activity status
   */
  async updateChildActivityStatus(
    childActivityId: string,
    userId: string,
    status: string,
    notes?: string
  ) {
    // Verify ownership through child
    const childActivity = await prisma.childActivity.findUnique({
      where: { id: childActivityId },
      include: { child: true }
    });

    if (!childActivity || childActivity.child.userId !== userId) {
      throw new Error('Activity not found or access denied');
    }

    const updateData: any = { status };
    if (notes !== undefined) updateData.notes = notes;

    // Update timestamps based on status
    if (status === 'completed' && !childActivity.completedAt) {
      updateData.completedAt = new Date();
    }

    return await prisma.childActivity.update({
      where: { id: childActivityId },
      data: updateData,
      include: {
        activity: true,
        child: true
      }
    });
  }

  /**
   * Remove activity from child's calendar
   */
  async removeActivityFromChild(childActivityId: string, userId: string) {
    // Verify ownership through child
    const childActivity = await prisma.childActivity.findUnique({
      where: { id: childActivityId },
      include: { child: true }
    });

    if (!childActivity || childActivity.child.userId !== userId) {
      throw new Error('Activity not found or access denied');
    }

    await prisma.childActivity.delete({
      where: { id: childActivityId }
    });

    return true;
  }

  /**
   * Check if activity is assigned to any of user's children
   */
  async isActivityAssignedToAnyChild(activityId: string, userId: string) {
    const count = await prisma.childActivity.count({
      where: {
        activityId,
        child: {
          userId
        }
      }
    });

    return count > 0;
  }
}

export const childrenService = new ChildrenService();