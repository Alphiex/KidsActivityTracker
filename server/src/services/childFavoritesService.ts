import { prisma } from '../lib/prisma';

/**
 * Service for managing child-centric favorites, waitlist entries, and notification preferences
 * Each child has their own favorites and waitlist entries, separate from other children
 */
class ChildFavoritesService {
  // ============= FAVORITES =============

  /**
   * Get all favorites for a specific child
   */
  async getChildFavorites(childId: string, userId: string) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId, isActive: true }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    const favorites = await prisma.childFavorite.findMany({
      where: { childId },
      include: {
        activity: {
          include: {
            provider: true,
            location: true,
            activityType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return favorites.map(fav => ({
      id: fav.id,
      childId: fav.childId,
      activityId: fav.activityId,
      notifyOnChange: fav.notifyOnChange,
      createdAt: fav.createdAt,
      activity: {
        id: fav.activity.id,
        name: fav.activity.name,
        category: fav.activity.category,
        provider: fav.activity.provider?.name,
        location: fav.activity.location?.name,
        locationCity: fav.activity.location?.city,
        spotsAvailable: fav.activity.spotsAvailable,
        totalSpots: fav.activity.totalSpots,
        cost: fav.activity.cost,
        dateStart: fav.activity.dateStart,
        dateEnd: fav.activity.dateEnd,
        startTime: fav.activity.startTime,
        endTime: fav.activity.endTime,
        dayOfWeek: fav.activity.dayOfWeek,
        ageMin: fav.activity.ageMin,
        ageMax: fav.activity.ageMax,
        registrationStatus: fav.activity.registrationStatus,
        registrationUrl: fav.activity.registrationUrl,
        directRegistrationUrl: fav.activity.directRegistrationUrl,
        activityType: fav.activity.activityType?.name,
        isActive: fav.activity.isActive
      }
    }));
  }

  /**
   * Get favorites for multiple children (for OR/AND mode filtering)
   */
  async getFavoritesForChildren(childIds: string[], userId: string) {
    // Verify all children belong to user
    const children = await prisma.child.findMany({
      where: { id: { in: childIds }, userId, isActive: true }
    });

    if (children.length !== childIds.length) {
      throw new Error('One or more children not found');
    }

    const favorites = await prisma.childFavorite.findMany({
      where: { childId: { in: childIds } },
      include: {
        child: { select: { id: true, name: true } },
        activity: {
          include: {
            provider: true,
            location: true,
            activityType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return favorites.map(fav => ({
      id: fav.id,
      childId: fav.childId,
      childName: fav.child.name,
      activityId: fav.activityId,
      notifyOnChange: fav.notifyOnChange,
      createdAt: fav.createdAt,
      activity: {
        id: fav.activity.id,
        name: fav.activity.name,
        category: fav.activity.category,
        provider: fav.activity.provider?.name,
        location: fav.activity.location?.name,
        locationCity: fav.activity.location?.city,
        spotsAvailable: fav.activity.spotsAvailable,
        totalSpots: fav.activity.totalSpots,
        cost: fav.activity.cost,
        dateStart: fav.activity.dateStart,
        dateEnd: fav.activity.dateEnd,
        startTime: fav.activity.startTime,
        endTime: fav.activity.endTime,
        dayOfWeek: fav.activity.dayOfWeek,
        ageMin: fav.activity.ageMin,
        ageMax: fav.activity.ageMax,
        registrationStatus: fav.activity.registrationStatus,
        registrationUrl: fav.activity.registrationUrl,
        directRegistrationUrl: fav.activity.directRegistrationUrl,
        activityType: fav.activity.activityType?.name,
        isActive: fav.activity.isActive
      }
    }));
  }

  /**
   * Add activity to child's favorites
   */
  async addFavorite(childId: string, activityId: string, userId: string, notifyOnChange: boolean = true) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId, isActive: true }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    // Verify activity exists
    const activity = await prisma.activity.findUnique({
      where: { id: activityId }
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    // Check if already favorited
    const existing = await prisma.childFavorite.findUnique({
      where: {
        childId_activityId: { childId, activityId }
      }
    });

    if (existing) {
      throw new Error('Activity already in favorites');
    }

    const favorite = await prisma.childFavorite.create({
      data: {
        childId,
        activityId,
        notifyOnChange
      },
      include: {
        activity: {
          include: {
            provider: true,
            location: true
          }
        }
      }
    });

    return {
      id: favorite.id,
      childId: favorite.childId,
      activityId: favorite.activityId,
      notifyOnChange: favorite.notifyOnChange,
      createdAt: favorite.createdAt,
      activityName: favorite.activity.name
    };
  }

  /**
   * Remove activity from child's favorites
   */
  async removeFavorite(childId: string, activityId: string, userId: string) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId, isActive: true }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    const result = await prisma.childFavorite.deleteMany({
      where: { childId, activityId }
    });

    if (result.count === 0) {
      throw new Error('Favorite not found');
    }

    return { success: true };
  }

  /**
   * Check if activity is favorited for a specific child
   */
  async isFavorited(childId: string, activityId: string, userId: string): Promise<boolean> {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId, isActive: true }
    });

    if (!child) {
      return false;
    }

    const favorite = await prisma.childFavorite.findUnique({
      where: {
        childId_activityId: { childId, activityId }
      }
    });

    return !!favorite;
  }

  /**
   * Get favorite status for an activity across multiple children
   */
  async getFavoriteStatusForChildren(activityId: string, childIds: string[], userId: string) {
    // Verify all children belong to user
    const children = await prisma.child.findMany({
      where: { id: { in: childIds }, userId, isActive: true },
      select: { id: true, name: true }
    });

    const favorites = await prisma.childFavorite.findMany({
      where: {
        activityId,
        childId: { in: childIds }
      },
      select: { childId: true }
    });

    const favoritedChildIds = new Set(favorites.map(f => f.childId));

    return children.map(child => ({
      childId: child.id,
      childName: child.name,
      isFavorited: favoritedChildIds.has(child.id)
    }));
  }

  /**
   * Update notification preference for a favorite
   */
  async updateFavoriteNotification(childId: string, activityId: string, userId: string, notifyOnChange: boolean) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId, isActive: true }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    const favorite = await prisma.childFavorite.update({
      where: {
        childId_activityId: { childId, activityId }
      },
      data: { notifyOnChange }
    });

    return favorite;
  }

  // ============= WAITLIST =============

  /**
   * Get all waitlist entries for a specific child
   */
  async getChildWaitlist(childId: string, userId: string) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId, isActive: true }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    const entries = await prisma.childWaitlistEntry.findMany({
      where: { childId },
      include: {
        activity: {
          include: {
            provider: true,
            location: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return entries.map(entry => ({
      id: entry.id,
      childId: entry.childId,
      activityId: entry.activityId,
      joinedAt: entry.createdAt,
      notifiedAt: entry.notifiedAt,
      activity: {
        id: entry.activity.id,
        name: entry.activity.name,
        category: entry.activity.category,
        provider: entry.activity.provider?.name,
        location: entry.activity.location?.name,
        spotsAvailable: entry.activity.spotsAvailable,
        totalSpots: entry.activity.totalSpots,
        cost: entry.activity.cost,
        dateStart: entry.activity.dateStart,
        dateEnd: entry.activity.dateEnd,
        startTime: entry.activity.startTime,
        endTime: entry.activity.endTime,
        registrationUrl: entry.activity.registrationUrl,
        directRegistrationUrl: entry.activity.directRegistrationUrl
      }
    }));
  }

  /**
   * Get waitlist entries for multiple children
   */
  async getWaitlistForChildren(childIds: string[], userId: string) {
    // Verify all children belong to user
    const children = await prisma.child.findMany({
      where: { id: { in: childIds }, userId, isActive: true }
    });

    if (children.length !== childIds.length) {
      throw new Error('One or more children not found');
    }

    const entries = await prisma.childWaitlistEntry.findMany({
      where: { childId: { in: childIds } },
      include: {
        child: { select: { id: true, name: true } },
        activity: {
          include: {
            provider: true,
            location: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return entries.map(entry => ({
      id: entry.id,
      childId: entry.childId,
      childName: entry.child.name,
      activityId: entry.activityId,
      joinedAt: entry.createdAt,
      notifiedAt: entry.notifiedAt,
      activity: {
        id: entry.activity.id,
        name: entry.activity.name,
        category: entry.activity.category,
        provider: entry.activity.provider?.name,
        location: entry.activity.location?.name,
        spotsAvailable: entry.activity.spotsAvailable,
        totalSpots: entry.activity.totalSpots,
        cost: entry.activity.cost,
        dateStart: entry.activity.dateStart,
        dateEnd: entry.activity.dateEnd,
        startTime: entry.activity.startTime,
        endTime: entry.activity.endTime,
        registrationUrl: entry.activity.registrationUrl,
        directRegistrationUrl: entry.activity.directRegistrationUrl
      }
    }));
  }

  /**
   * Add child to waitlist for an activity
   */
  async joinWaitlist(childId: string, activityId: string, userId: string) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId, isActive: true }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    // Verify activity exists
    const activity = await prisma.activity.findUnique({
      where: { id: activityId }
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    // Check if already on waitlist
    const existing = await prisma.childWaitlistEntry.findUnique({
      where: {
        childId_activityId: { childId, activityId }
      }
    });

    if (existing) {
      throw new Error('Already on waitlist for this activity');
    }

    const entry = await prisma.childWaitlistEntry.create({
      data: {
        childId,
        activityId
      },
      include: {
        activity: true
      }
    });

    return {
      id: entry.id,
      childId: entry.childId,
      activityId: entry.activityId,
      joinedAt: entry.createdAt,
      activityName: entry.activity.name
    };
  }

  /**
   * Remove child from waitlist
   */
  async leaveWaitlist(childId: string, activityId: string, userId: string) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId, isActive: true }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    const result = await prisma.childWaitlistEntry.deleteMany({
      where: { childId, activityId }
    });

    if (result.count === 0) {
      throw new Error('Not on waitlist for this activity');
    }

    return { success: true };
  }

  /**
   * Check if child is on waitlist for an activity
   */
  async isOnWaitlist(childId: string, activityId: string, userId: string): Promise<boolean> {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId, isActive: true }
    });

    if (!child) {
      return false;
    }

    const entry = await prisma.childWaitlistEntry.findUnique({
      where: {
        childId_activityId: { childId, activityId }
      }
    });

    return !!entry;
  }

  /**
   * Get waitlist status for an activity across multiple children
   */
  async getWaitlistStatusForChildren(activityId: string, childIds: string[], userId: string) {
    // Verify all children belong to user
    const children = await prisma.child.findMany({
      where: { id: { in: childIds }, userId, isActive: true },
      select: { id: true, name: true }
    });

    const entries = await prisma.childWaitlistEntry.findMany({
      where: {
        activityId,
        childId: { in: childIds }
      },
      select: { childId: true }
    });

    const onWaitlistChildIds = new Set(entries.map(e => e.childId));

    return children.map(child => ({
      childId: child.id,
      childName: child.name,
      isOnWaitlist: onWaitlistChildIds.has(child.id)
    }));
  }

  // ============= WATCHING (ACTIVITY NOTIFICATIONS) =============

  /**
   * Get all watching entries for a specific child
   */
  async getChildWatching(childId: string, userId: string) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId, isActive: true }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    const entries = await prisma.childWatching.findMany({
      where: { childId },
      include: {
        activity: {
          include: {
            provider: true,
            location: true,
            activityType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return entries.map(entry => ({
      id: entry.id,
      childId: entry.childId,
      activityId: entry.activityId,
      createdAt: entry.createdAt,
      notifyAlmostFull: entry.notifyAlmostFull,
      notifyPriceChange: entry.notifyPriceChange,
      notifyNewSessions: entry.notifyNewSessions,
      activity: {
        id: entry.activity.id,
        name: entry.activity.name,
        category: entry.activity.category,
        provider: entry.activity.provider?.name,
        location: entry.activity.location?.name,
        locationCity: entry.activity.location?.city,
        spotsAvailable: entry.activity.spotsAvailable,
        totalSpots: entry.activity.totalSpots,
        cost: entry.activity.cost,
        dateStart: entry.activity.dateStart,
        dateEnd: entry.activity.dateEnd,
        startTime: entry.activity.startTime,
        endTime: entry.activity.endTime,
        dayOfWeek: entry.activity.dayOfWeek,
        ageMin: entry.activity.ageMin,
        ageMax: entry.activity.ageMax,
        registrationStatus: entry.activity.registrationStatus,
        registrationUrl: entry.activity.registrationUrl,
        directRegistrationUrl: entry.activity.directRegistrationUrl,
        activityType: entry.activity.activityType?.name,
        isActive: entry.activity.isActive
      }
    }));
  }

  /**
   * Get watching entries for multiple children
   */
  async getWatchingForChildren(childIds: string[], userId: string) {
    // Verify all children belong to user
    const children = await prisma.child.findMany({
      where: { id: { in: childIds }, userId, isActive: true }
    });

    if (children.length !== childIds.length) {
      throw new Error('One or more children not found');
    }

    const entries = await prisma.childWatching.findMany({
      where: { childId: { in: childIds } },
      include: {
        child: { select: { id: true, name: true, colorId: true } },
        activity: {
          include: {
            provider: true,
            location: true,
            activityType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return entries.map(entry => ({
      id: entry.id,
      childId: entry.childId,
      childName: entry.child.name,
      colorId: entry.child.colorId,
      activityId: entry.activityId,
      createdAt: entry.createdAt,
      notifyAlmostFull: entry.notifyAlmostFull,
      notifyPriceChange: entry.notifyPriceChange,
      notifyNewSessions: entry.notifyNewSessions,
      activity: {
        id: entry.activity.id,
        name: entry.activity.name,
        category: entry.activity.category,
        provider: entry.activity.provider?.name,
        location: entry.activity.location?.name,
        locationCity: entry.activity.location?.city,
        spotsAvailable: entry.activity.spotsAvailable,
        totalSpots: entry.activity.totalSpots,
        cost: entry.activity.cost,
        dateStart: entry.activity.dateStart,
        dateEnd: entry.activity.dateEnd,
        startTime: entry.activity.startTime,
        endTime: entry.activity.endTime,
        dayOfWeek: entry.activity.dayOfWeek,
        ageMin: entry.activity.ageMin,
        ageMax: entry.activity.ageMax,
        registrationStatus: entry.activity.registrationStatus,
        registrationUrl: entry.activity.registrationUrl,
        directRegistrationUrl: entry.activity.directRegistrationUrl,
        activityType: entry.activity.activityType?.name,
        isActive: entry.activity.isActive
      }
    }));
  }

  /**
   * Start watching an activity for a child
   */
  async addWatching(
    childId: string,
    activityId: string,
    userId: string,
    options?: {
      notifyAlmostFull?: boolean;
      notifyPriceChange?: boolean;
      notifyNewSessions?: boolean;
    }
  ) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId, isActive: true }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    // Verify activity exists
    const activity = await prisma.activity.findUnique({
      where: { id: activityId }
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    // Check if already watching
    const existing = await prisma.childWatching.findUnique({
      where: {
        childId_activityId: { childId, activityId }
      }
    });

    if (existing) {
      throw new Error('Already watching this activity');
    }

    const entry = await prisma.childWatching.create({
      data: {
        childId,
        activityId,
        notifyAlmostFull: options?.notifyAlmostFull ?? true,
        notifyPriceChange: options?.notifyPriceChange ?? true,
        notifyNewSessions: options?.notifyNewSessions ?? false
      },
      include: {
        activity: true
      }
    });

    return {
      id: entry.id,
      childId: entry.childId,
      activityId: entry.activityId,
      createdAt: entry.createdAt,
      notifyAlmostFull: entry.notifyAlmostFull,
      notifyPriceChange: entry.notifyPriceChange,
      notifyNewSessions: entry.notifyNewSessions,
      activityName: entry.activity.name
    };
  }

  /**
   * Stop watching an activity for a child
   */
  async removeWatching(childId: string, activityId: string, userId: string) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId, isActive: true }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    const result = await prisma.childWatching.deleteMany({
      where: { childId, activityId }
    });

    if (result.count === 0) {
      throw new Error('Not watching this activity');
    }

    return { success: true };
  }

  /**
   * Check if child is watching an activity
   */
  async isWatching(childId: string, activityId: string, userId: string): Promise<boolean> {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId, isActive: true }
    });

    if (!child) {
      return false;
    }

    const entry = await prisma.childWatching.findUnique({
      where: {
        childId_activityId: { childId, activityId }
      }
    });

    return !!entry;
  }

  /**
   * Get watching status for an activity across multiple children
   */
  async getWatchingStatusForChildren(activityId: string, childIds: string[], userId: string) {
    // Verify all children belong to user
    const children = await prisma.child.findMany({
      where: { id: { in: childIds }, userId, isActive: true },
      select: { id: true, name: true, colorId: true }
    });

    const entries = await prisma.childWatching.findMany({
      where: {
        activityId,
        childId: { in: childIds }
      },
      select: { childId: true }
    });

    const watchingChildIds = new Set(entries.map(e => e.childId));

    return children.map(child => ({
      childId: child.id,
      childName: child.name,
      colorId: child.colorId,
      isWatching: watchingChildIds.has(child.id)
    }));
  }

  // ============= NOTIFICATION PREFERENCES =============

  /**
   * Get notification preferences for a child
   */
  async getChildNotificationPreferences(childId: string, userId: string) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId, isActive: true }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    let prefs = await prisma.childNotificationPreferences.findUnique({
      where: { childId }
    });

    // Return default preferences if none exist
    if (!prefs) {
      return {
        childId,
        enabled: true,
        spotsAvailable: true,
        favoriteCapacity: true,
        capacityThreshold: 3,
        priceDrops: true,
        newActivities: true,
        dailyDigest: false,
        weeklyDigest: false,
        pushEnabled: false,
        pushSpotsAvailable: true,
        pushCapacityAlerts: true,
        pushPriceDrops: true
      };
    }

    return prefs;
  }

  /**
   * Update notification preferences for a child
   */
  async updateChildNotificationPreferences(
    childId: string,
    userId: string,
    updates: {
      enabled?: boolean;
      spotsAvailable?: boolean;
      favoriteCapacity?: boolean;
      capacityThreshold?: number;
      priceDrops?: boolean;
      newActivities?: boolean;
      dailyDigest?: boolean;
      weeklyDigest?: boolean;
      pushEnabled?: boolean;
      pushSpotsAvailable?: boolean;
      pushCapacityAlerts?: boolean;
      pushPriceDrops?: boolean;
    }
  ) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId, isActive: true }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    const prefs = await prisma.childNotificationPreferences.upsert({
      where: { childId },
      update: updates,
      create: {
        childId,
        ...updates
      }
    });

    return prefs;
  }

  // ============= BULK OPERATIONS =============

  /**
   * Migrate user-level favorites to child-level
   * (For users upgrading from old system)
   */
  async migrateUserFavoritesToChild(userId: string, childId: string) {
    // Verify child belongs to user
    const child = await prisma.child.findFirst({
      where: { id: childId, userId, isActive: true }
    });

    if (!child) {
      throw new Error('Child not found');
    }

    // Get user's old favorites
    const userFavorites = await prisma.favorite.findMany({
      where: { userId }
    });

    let migrated = 0;
    let skipped = 0;

    for (const fav of userFavorites) {
      try {
        // Check if already exists
        const existing = await prisma.childFavorite.findUnique({
          where: {
            childId_activityId: { childId, activityId: fav.activityId }
          }
        });

        if (!existing) {
          await prisma.childFavorite.create({
            data: {
              childId,
              activityId: fav.activityId,
              notifyOnChange: fav.notifyOnChange
            }
          });
          migrated++;
        } else {
          skipped++;
        }
      } catch (e) {
        skipped++;
      }
    }

    return { migrated, skipped, total: userFavorites.length };
  }

  /**
   * Get combined activity status (favorite + waitlist + watching) for an activity
   */
  async getActivityStatusForChildren(activityId: string, childIds: string[], userId: string) {
    const [favoriteStatus, waitlistStatus, watchingStatus] = await Promise.all([
      this.getFavoriteStatusForChildren(activityId, childIds, userId),
      this.getWaitlistStatusForChildren(activityId, childIds, userId),
      this.getWatchingStatusForChildren(activityId, childIds, userId)
    ]);

    // Merge results
    const statusMap = new Map<string, {
      childId: string;
      childName: string;
      colorId: number | null;
      isFavorited: boolean;
      isOnWaitlist: boolean;
      isWatching: boolean;
    }>();

    for (const fav of favoriteStatus) {
      statusMap.set(fav.childId, {
        childId: fav.childId,
        childName: fav.childName,
        colorId: null,
        isFavorited: fav.isFavorited,
        isOnWaitlist: false,
        isWatching: false
      });
    }

    for (const wl of waitlistStatus) {
      const existing = statusMap.get(wl.childId);
      if (existing) {
        existing.isOnWaitlist = wl.isOnWaitlist;
      } else {
        statusMap.set(wl.childId, {
          childId: wl.childId,
          childName: wl.childName,
          colorId: null,
          isFavorited: false,
          isOnWaitlist: wl.isOnWaitlist,
          isWatching: false
        });
      }
    }

    for (const watch of watchingStatus) {
      const existing = statusMap.get(watch.childId);
      if (existing) {
        existing.isWatching = watch.isWatching;
        existing.colorId = watch.colorId;
      } else {
        statusMap.set(watch.childId, {
          childId: watch.childId,
          childName: watch.childName,
          colorId: watch.colorId,
          isFavorited: false,
          isOnWaitlist: false,
          isWatching: watch.isWatching
        });
      }
    }

    return Array.from(statusMap.values());
  }
}

export const childFavoritesService = new ChildFavoritesService();
