import { Child, Prisma } from '../../generated/prisma';
import { prisma } from '../lib/prisma';
import { calculateAge } from '../utils/dateUtils';
import { v4 as uuidv4 } from 'uuid';

export interface CreateChildInput {
  userId: string;
  name: string;
  dateOfBirth?: Date;  // Optional - child may not have DOB set initially
  gender?: string;
  avatarUrl?: string;
  avatarId?: number;
  colorId?: number;
  interests?: string[];
  notes?: string;
  location?: string;
  locationDetails?: any;
}

export interface UpdateChildInput {
  name?: string;
  dateOfBirth?: Date;
  gender?: string;
  avatarUrl?: string;
  avatarId?: number;
  colorId?: number;
  interests?: string[];
  notes?: string;
  isActive?: boolean;
  location?: string;
  locationDetails?: any;
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
        avatarId: data.avatarId,
        colorId: data.colorId,
        interests: data.interests || [],
        notes: data.notes,
        location: data.location,
        locationDetails: data.locationDetails,
      }
    });
  }

  /**
   * Get all children for a user (includes preferences with location data)
   * Auto-creates default preferences for children that don't have them,
   * inheriting location from user's profile preferences
   */
  async getChildrenByUserId(userId: string, includeInactive = false): Promise<ChildWithAge[]> {
    const children = await prisma.child.findMany({
      where: {
        userId,
        ...(includeInactive ? {} : { isActive: true })
      },
      include: {
        preferences: true // Include preferences for location data (savedAddress)
      },
      orderBy: {
        dateOfBirth: 'asc'
      }
    });

    // Get user's preferences once (for inheriting location if needed)
    // Check if any child needs preferences created OR needs location backfilled
    let userPrefs: any = null;
    const needsUserPrefs = children.some(c =>
      !c.preferences || !c.preferences.savedAddress
    );
    if (needsUserPrefs) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { preferences: true }
      });
      userPrefs = (user?.preferences as any) || {};
    }

    // Auto-create preferences for children that don't have them
    // Also backfill location for existing preferences that don't have it
    const childrenWithPrefs = await Promise.all(
      children.map(async (child) => {
        let preferences = child.preferences;
        if (!preferences) {
          // Build preference data inheriting from user preferences
          const prefsData: any = { childId: child.id };

          // Inherit location from user's preferences if available
          if (userPrefs?.savedAddress) {
            prefsData.savedAddress = userPrefs.savedAddress;
            prefsData.locationSource = userPrefs.locationSource || 'saved_address';
            prefsData.distanceFilterEnabled = userPrefs.distanceFilterEnabled ?? true;
            if (userPrefs.distanceRadiusKm) {
              prefsData.distanceRadiusKm = userPrefs.distanceRadiusKm;
            }
            console.log(`[ChildrenService] Inheriting location from user prefs for child ${child.id}`);
          }

          // Inherit activity type preferences if available
          if (userPrefs?.preferredActivityTypes?.length > 0) {
            prefsData.preferredActivityTypes = userPrefs.preferredActivityTypes;
          }

          preferences = await prisma.childPreferences.create({
            data: prefsData
          });
          console.log(`[ChildrenService] Auto-created preferences for child ${child.id}`);
        } else if (!preferences.savedAddress && userPrefs?.savedAddress) {
          // Backfill location for existing preferences that don't have it
          preferences = await prisma.childPreferences.update({
            where: { id: preferences.id },
            data: {
              savedAddress: userPrefs.savedAddress,
              locationSource: userPrefs.locationSource || 'saved_address',
              distanceFilterEnabled: userPrefs.distanceFilterEnabled ?? true,
              distanceRadiusKm: userPrefs.distanceRadiusKm || 25
            }
          });
          console.log(`[ChildrenService] Backfilled location for child ${child.id}`);
        }
        return {
          ...child,
          preferences,
          age: calculateAge(child.dateOfBirth),
          ageInMonths: calculateAge(child.dateOfBirth, true)
        };
      })
    );

    return childrenWithPrefs;
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
   * Create a custom event for a child
   * Creates a custom Activity and links it to the child via ChildActivity
   */
  async createCustomEvent(
    childId: string,
    userId: string,
    eventData: {
      title: string;
      description?: string;
      scheduledDate: Date;
      startTime?: string;
      endTime?: string;
      location?: string;
      locationData?: {
        latitude?: number;
        longitude?: number;
        formattedAddress?: string;
      };
      recurring?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
      recurrenceEndDate?: Date;
    }
  ) {
    // Verify child ownership
    const child = await prisma.child.findFirst({
      where: { id: childId, userId }
    });

    if (!child) {
      throw new Error('Child not found or access denied');
    }

    // Create a custom activity
    const customActivity = await prisma.activity.create({
      data: {
        name: eventData.title,
        description: eventData.description || '',
        providerId: 'custom',
        externalId: `custom-${userId}-${Date.now()}`,
        category: 'Custom Event',
        isCustomEvent: true,
        createdByUserId: userId,
        dateStart: eventData.scheduledDate,
        dateEnd: eventData.scheduledDate,
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        isActive: true,
      }
    });

    // Generate dates for recurring events
    const eventDates: Date[] = [eventData.scheduledDate];

    if (eventData.recurring && eventData.recurrenceEndDate) {
      let currentDate = new Date(eventData.scheduledDate);
      const endDate = new Date(eventData.recurrenceEndDate);

      while (currentDate < endDate) {
        switch (eventData.recurring) {
          case 'daily':
            currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
            break;
          case 'weekly':
            currentDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
          case 'biweekly':
            currentDate = new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000);
            break;
          case 'monthly':
            currentDate = new Date(currentDate);
            currentDate.setMonth(currentDate.getMonth() + 1);
            break;
        }

        if (currentDate <= endDate) {
          eventDates.push(new Date(currentDate));
        }
      }
    }

    // Create ChildActivity entries for each date
    const childActivities = await Promise.all(
      eventDates.map((date, index) =>
        prisma.childActivity.create({
          data: {
            childId,
            activityId: customActivity.id,
            status: 'planned',
            scheduledDate: date,
            startTime: eventData.startTime,
            endTime: eventData.endTime,
            notes: eventData.description,
            recurring: eventData.recurring ? true : false,
            recurrencePattern: eventData.recurring,
            recurrenceEnd: eventData.recurrenceEndDate,
          },
          include: {
            activity: true,
            child: true
          }
        })
      )
    );

    return {
      activity: customActivity,
      childActivities,
      eventsCreated: childActivities.length
    };
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

    // Build date filter that considers both scheduledDate AND activity's date range
    // This ensures activities show up if ANY of their dates fall within the requested range
    if (startDate || endDate) {
      where.OR = [
        // Include if scheduledDate falls within range
        {
          scheduledDate: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate })
          }
        },
        // Include if activity's date range overlaps with the requested range
        // (regardless of scheduledDate - activity might be registered early but runs later)
        {
          activity: {
            AND: [
              ...(startDate ? [{ dateEnd: { gte: startDate } }] : []),
              ...(endDate ? [{ dateStart: { lte: endDate } }] : [])
            ]
          }
        }
      ];
    }

    return await prisma.childActivity.findMany({
      where,
      include: {
        activity: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            subcategory: true,
            schedule: true,
            dates: true,
            dateStart: true,
            dateEnd: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            ageMin: true,
            ageMax: true,
            cost: true,
            spotsAvailable: true,
            totalSpots: true,
            locationName: true,
            registrationUrl: true,
            registrationStatus: true,
            rawData: true, // Include rawData for session dates
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

  // ============= Skill Progression Tracking =============

  /**
   * Get all skill progress for a child
   */
  async getChildSkillProgress(childId: string, userId: string) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    return await prisma.childSkillProgress.findMany({
      where: { childId },
      orderBy: [
        { activitiesCompleted: 'desc' },
        { updatedAt: 'desc' }
      ]
    });
  }

  /**
   * Get specific skill progress by category
   */
  async getChildSkillByCategory(childId: string, skillCategory: string, userId: string) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    return await prisma.childSkillProgress.findUnique({
      where: {
        childId_skillCategory: { childId, skillCategory }
      }
    });
  }

  /**
   * Update or create skill progress
   */
  async updateChildSkillProgress(
    childId: string,
    userId: string,
    data: {
      skillCategory: string;
      currentLevel?: string;
      activityName?: string;
      hoursToAdd?: number;
      notes?: string;
      achievement?: string;
    }
  ) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    const existing = await prisma.childSkillProgress.findUnique({
      where: {
        childId_skillCategory: { childId, skillCategory: data.skillCategory }
      }
    });

    if (existing) {
      // Update existing
      const updateData: any = {
        updatedAt: new Date()
      };

      if (data.currentLevel) updateData.currentLevel = data.currentLevel;
      if (data.notes) updateData.notes = data.notes;
      if (data.hoursToAdd) updateData.totalHours = existing.totalHours + data.hoursToAdd;
      if (data.activityName) {
        updateData.lastActivityName = data.activityName;
        updateData.lastActivityDate = new Date();
        updateData.activitiesCompleted = existing.activitiesCompleted + 1;
      }
      if (data.achievement) {
        updateData.achievements = [...existing.achievements, data.achievement];
      }

      return await prisma.childSkillProgress.update({
        where: { id: existing.id },
        data: updateData
      });
    } else {
      // Create new
      return await prisma.childSkillProgress.create({
        data: {
          childId,
          skillCategory: data.skillCategory,
          currentLevel: data.currentLevel || 'beginner',
          totalHours: data.hoursToAdd || 0,
          lastActivityName: data.activityName,
          lastActivityDate: data.activityName ? new Date() : null,
          activitiesCompleted: data.activityName ? 1 : 0,
          notes: data.notes,
          achievements: data.achievement ? [data.achievement] : []
        }
      });
    }
  }

  /**
   * Log activity completion and update skill progress
   */
  async logActivityCompletion(
    childId: string,
    userId: string,
    data: {
      activityId?: string;
      activityName: string;
      skillCategory: string;
      hoursSpent: number;
      levelUp?: boolean;
      notes?: string;
    }
  ) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    const existing = await prisma.childSkillProgress.findUnique({
      where: {
        childId_skillCategory: { childId, skillCategory: data.skillCategory }
      }
    });

    // Determine new level if level up requested
    const getLevelUp = (currentLevel: string) => {
      const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
      const currentIndex = levels.indexOf(currentLevel);
      if (currentIndex < levels.length - 1) {
        return levels[currentIndex + 1];
      }
      return currentLevel;
    };

    if (existing) {
      const updateData: any = {
        activitiesCompleted: existing.activitiesCompleted + 1,
        totalHours: existing.totalHours + data.hoursSpent,
        lastActivityName: data.activityName,
        lastActivityDate: new Date(),
        updatedAt: new Date()
      };

      if (data.levelUp) {
        updateData.currentLevel = getLevelUp(existing.currentLevel);
        updateData.achievements = [...existing.achievements, `Leveled up to ${updateData.currentLevel}!`];
      }

      if (data.notes) {
        updateData.notes = data.notes;
      }

      return await prisma.childSkillProgress.update({
        where: { id: existing.id },
        data: updateData
      });
    } else {
      // Create new skill progress
      return await prisma.childSkillProgress.create({
        data: {
          childId,
          skillCategory: data.skillCategory,
          currentLevel: data.levelUp ? 'intermediate' : 'beginner',
          totalHours: data.hoursSpent,
          lastActivityName: data.activityName,
          lastActivityDate: new Date(),
          activitiesCompleted: 1,
          notes: data.notes,
          achievements: data.levelUp ? ['Started learning!', 'Leveled up to intermediate!'] : ['Started learning!']
        }
      });
    }
  }

  /**
   * Delete skill progress
   */
  async deleteChildSkillProgress(childId: string, skillCategory: string, userId: string) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    await prisma.childSkillProgress.delete({
      where: {
        childId_skillCategory: { childId, skillCategory }
      }
    });

    return true;
  }

  // ============= Child Preferences Management =============

  /**
   * Get child preferences (creates default if not exists)
   */
  async getChildPreferences(childId: string, userId: string) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    // Get existing preferences or create default
    let preferences = await prisma.childPreferences.findUnique({
      where: { childId }
    });

    if (!preferences) {
      // Create default preferences for this child
      preferences = await prisma.childPreferences.create({
        data: { childId }
      });
    }

    return preferences;
  }

  /**
   * Update child preferences
   */
  async updateChildPreferences(childId: string, userId: string, data: any) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    // Upsert preferences (create if not exists, update if exists)
    return await prisma.childPreferences.upsert({
      where: { childId },
      create: {
        childId,
        ...data
      },
      update: data
    });
  }

  /**
   * Copy preferences from one child to another
   */
  async copyChildPreferences(sourceChildId: string, targetChildId: string, userId: string) {
    // Verify both children belong to user
    const children = await prisma.child.findMany({
      where: {
        id: { in: [sourceChildId, targetChildId] },
        userId
      }
    });

    if (children.length !== 2) {
      throw new Error('Source or target child not found');
    }

    // Get source preferences
    const sourcePrefs = await prisma.childPreferences.findUnique({
      where: { childId: sourceChildId }
    });

    if (!sourcePrefs) {
      throw new Error('Source child has no preferences to copy');
    }

    // Copy to target (excluding id, childId, createdAt, updatedAt)
    const { id, childId, createdAt, updatedAt, ...prefsData } = sourcePrefs;

    return await prisma.childPreferences.upsert({
      where: { childId: targetChildId },
      create: {
        childId: targetChildId,
        ...prefsData
      },
      update: prefsData
    });
  }

  /**
   * Initialize child preferences from user's current preferences
   * Used during migration from user-level to child-level preferences
   */
  async initializeChildPreferencesFromUser(childId: string, userId: string) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    // Check if preferences already exist
    const existingPrefs = await prisma.childPreferences.findUnique({
      where: { childId }
    });

    if (existingPrefs) {
      return existingPrefs; // Don't overwrite existing preferences
    }

    // Get user's preferences from their profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true }
    });

    const userPrefs = (user?.preferences as any) || {};

    // Map user preferences to child preferences format
    const childPrefsData: any = {
      childId,
    };

    // Location preferences
    if (userPrefs.locationSource) childPrefsData.locationSource = userPrefs.locationSource;
    if (userPrefs.savedAddress) childPrefsData.savedAddress = userPrefs.savedAddress;
    if (userPrefs.distanceRadiusKm) childPrefsData.distanceRadiusKm = userPrefs.distanceRadiusKm;
    if (userPrefs.distanceFilterEnabled !== undefined) childPrefsData.distanceFilterEnabled = userPrefs.distanceFilterEnabled;

    // Activity type preferences
    if (userPrefs.preferredActivityTypes) childPrefsData.preferredActivityTypes = userPrefs.preferredActivityTypes;
    if (userPrefs.preferredSubtypes) childPrefsData.preferredSubtypes = userPrefs.preferredSubtypes;
    if (userPrefs.excludedCategories) childPrefsData.excludedCategories = userPrefs.excludedCategories;

    // Schedule preferences - only copy if they have actual values (not empty)
    // Empty arrays/objects should use schema defaults (all days, all times = "anytime")
    if (userPrefs.daysOfWeek && userPrefs.daysOfWeek.length > 0) {
      childPrefsData.daysOfWeek = userPrefs.daysOfWeek;
    }
    if (userPrefs.timePreferences && Object.keys(userPrefs.timePreferences).length > 0) {
      childPrefsData.timePreferences = userPrefs.timePreferences;
    }

    // Budget preferences
    if (userPrefs.priceRange?.min !== undefined) childPrefsData.priceRangeMin = userPrefs.priceRange.min;
    if (userPrefs.priceRange?.max !== undefined) childPrefsData.priceRangeMax = userPrefs.priceRange.max;
    if (userPrefs.maxBudgetFriendlyAmount) childPrefsData.maxBudgetFriendlyAmount = userPrefs.maxBudgetFriendlyAmount;

    // Environment preference
    if (userPrefs.environmentFilter) childPrefsData.environmentFilter = userPrefs.environmentFilter;

    return await prisma.childPreferences.create({
      data: childPrefsData
    });
  }

  /**
   * Initialize preferences for all children of a user
   * Used during bulk migration
   */
  async initializeAllChildrenPreferences(userId: string) {
    // Get all children for user
    const children = await prisma.child.findMany({
      where: { userId, isActive: true },
      select: { id: true }
    });

    let initialized = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const child of children) {
      try {
        // Check if preferences already exist
        const existing = await prisma.childPreferences.findUnique({
          where: { childId: child.id }
        });

        if (existing) {
          skipped++;
          continue;
        }

        await this.initializeChildPreferencesFromUser(child.id, userId);
        initialized++;
      } catch (error: any) {
        errors.push(`Child ${child.id}: ${error.message}`);
      }
    }

    return {
      total: children.length,
      initialized,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Get children with their preferences
   */
  async getChildrenWithPreferences(userId: string): Promise<any[]> {
    const children = await prisma.child.findMany({
      where: { userId, isActive: true },
      include: {
        preferences: true
      },
      orderBy: { dateOfBirth: 'asc' }
    });

    return children.map(child => ({
      ...child,
      age: calculateAge(child.dateOfBirth),
      ageInMonths: calculateAge(child.dateOfBirth, true)
    }));
  }
}

export const childrenService = new ChildrenService();