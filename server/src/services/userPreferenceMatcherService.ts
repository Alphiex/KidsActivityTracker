import { Activity, User } from '../../generated/prisma';
import { prisma } from '../lib/prisma';

/**
 * User notification preferences as stored in the User.preferences JSON field
 */
export interface NotificationPreferences {
  enabled: boolean;
  newActivities: boolean;
  favoriteCapacity: boolean;
  capacityThreshold: number;
  priceDrops: boolean;
  weeklyDigest: boolean;
  dailyDigest?: boolean;
  spotsAvailable?: boolean;
  reminders?: boolean;
  quietHoursStart?: string; // "22:00"
  quietHoursEnd?: string; // "07:00"
}

/**
 * User filter preferences for matching activities
 */
export interface FilterPreferences {
  locationIds?: string[];
  ageRanges?: { min: number; max: number }[];
  ageRange?: { min?: number; max?: number };
  priceRange?: { min: number; max: number };
  daysOfWeek?: string[];
  preferredActivityTypes?: string[];
  preferredSubtypes?: string[];
  distanceFilterEnabled?: boolean;
  distanceRadiusKm?: number;
  savedAddress?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Full user preferences structure
 */
export interface UserPreferences {
  notifications?: NotificationPreferences;
  locationIds?: string[];
  ageRanges?: { min: number; max: number }[];
  ageRange?: { min?: number; max?: number };
  priceRange?: { min: number; max: number };
  daysOfWeek?: string[];
  preferredActivityTypes?: string[];
  preferredSubtypes?: string[];
  distanceFilterEnabled?: boolean;
  distanceRadiusKm?: number;
  savedAddress?: {
    address: string;
    latitude: number;
    longitude: number;
  };
}

/**
 * Service for matching users with activities based on their preferences
 */
export class UserPreferenceMatcherService {
  /**
   * Get all users who have email notifications enabled for a specific type
   */
  async getUsersWithNotificationType(
    notificationType: 'newActivities' | 'favoriteCapacity' | 'priceDrops' | 'weeklyDigest' | 'dailyDigest' | 'spotsAvailable'
  ): Promise<User[]> {
    const users = await prisma.user.findMany({
      where: {
        isVerified: true,
        email: { not: '' }
      }
    });

    return users.filter(user => {
      const prefs = user.preferences as UserPreferences | null;
      if (!prefs?.notifications?.enabled) return false;
      return prefs.notifications[notificationType] === true;
    });
  }

  /**
   * Get users who should be notified about a specific activity
   * Based on their filter preferences (location, age, price, activity type, etc.)
   */
  async getUsersForActivity(activity: Activity & { location?: { id: string; city: string } | null }): Promise<User[]> {
    // Get all users with newActivities notifications enabled
    const users = await this.getUsersWithNotificationType('newActivities');

    return users.filter(user => {
      const prefs = user.preferences as UserPreferences | null;
      if (!prefs) return false;
      return this.matchesUserPreferences(activity, prefs);
    });
  }

  /**
   * Get activities matching a user's preferences that were added since a given date
   */
  async getMatchingActivities(userId: string, since?: Date): Promise<Activity[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) return [];

    const prefs = user.preferences as UserPreferences | null;
    if (!prefs) {
      // No preferences set, return all new activities
      return prisma.activity.findMany({
        where: {
          isActive: true,
          createdAt: since ? { gte: since } : undefined
        },
        include: {
          provider: true,
          location: true
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
    }

    // Build query based on preferences
    const where: any = {
      isActive: true,
      createdAt: since ? { gte: since } : undefined
    };

    // Location filter
    if (prefs.locationIds && prefs.locationIds.length > 0) {
      where.locationId = { in: prefs.locationIds };
    }

    // Activity type filter
    if (prefs.preferredActivityTypes && prefs.preferredActivityTypes.length > 0) {
      where.activityType = {
        code: { in: prefs.preferredActivityTypes }
      };
    }

    // Subtype filter
    if (prefs.preferredSubtypes && prefs.preferredSubtypes.length > 0) {
      where.activitySubtype = {
        code: { in: prefs.preferredSubtypes }
      };
    }

    // Price range filter
    if (prefs.priceRange) {
      where.cost = {
        gte: prefs.priceRange.min,
        lte: prefs.priceRange.max
      };
    }

    const activities = await prisma.activity.findMany({
      where,
      include: {
        provider: true,
        location: true,
        activityType: true,
        activitySubtype: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    // Additional filtering that can't be done in Prisma
    return activities.filter(activity => this.matchesUserPreferences(activity, prefs));
  }

  /**
   * Check if an activity matches a user's preferences
   */
  matchesUserPreferences(
    activity: Activity & { location?: { id: string; city: string } | null },
    preferences: UserPreferences
  ): boolean {
    // Check age range
    if (preferences.ageRanges && preferences.ageRanges.length > 0) {
      const activityMinAge = activity.ageMin ?? 0;
      const activityMaxAge = activity.ageMax ?? 99;

      const ageMatches = preferences.ageRanges.some(range => {
        // Check if age ranges overlap
        return activityMinAge <= range.max && activityMaxAge >= range.min;
      });

      if (!ageMatches) return false;
    }

    // Check single age range (legacy)
    if (preferences.ageRange) {
      const activityMinAge = activity.ageMin ?? 0;
      const activityMaxAge = activity.ageMax ?? 99;
      const prefMinAge = preferences.ageRange.min ?? 0;
      const prefMaxAge = preferences.ageRange.max ?? 99;

      // Check if age ranges overlap
      if (activityMinAge > prefMaxAge || activityMaxAge < prefMinAge) {
        return false;
      }
    }

    // Check price range
    if (preferences.priceRange) {
      const activityCost = activity.cost ?? 0;
      if (activityCost < preferences.priceRange.min || activityCost > preferences.priceRange.max) {
        return false;
      }
    }

    // Check days of week
    if (preferences.daysOfWeek && preferences.daysOfWeek.length > 0 && preferences.daysOfWeek.length < 7) {
      const activityDays = activity.dayOfWeek || [];
      const hasMatchingDay = activityDays.some(day => preferences.daysOfWeek!.includes(day));
      if (!hasMatchingDay && activityDays.length > 0) {
        return false;
      }
    }

    // Check location IDs
    if (preferences.locationIds && preferences.locationIds.length > 0) {
      if (!activity.locationId || !preferences.locationIds.includes(activity.locationId)) {
        return false;
      }
    }

    // All checks passed
    return true;
  }

  /**
   * Get user's notification preferences
   */
  async getUserNotificationPreferences(userId: string): Promise<NotificationPreferences | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) return null;

    const prefs = user.preferences as UserPreferences | null;
    return prefs?.notifications || null;
  }

  /**
   * Update user's notification preferences
   */
  async updateUserNotificationPreferences(
    userId: string,
    notificationPrefs: Partial<NotificationPreferences>
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const currentPrefs = (user.preferences as UserPreferences) || {};
    const currentNotifications = currentPrefs.notifications || {
      enabled: false,
      newActivities: false,
      favoriteCapacity: false,
      capacityThreshold: 3,
      priceDrops: false,
      weeklyDigest: false
    };

    const updatedPrefs: UserPreferences = {
      ...currentPrefs,
      notifications: {
        ...currentNotifications,
        ...notificationPrefs
      }
    };

    await prisma.user.update({
      where: { id: userId },
      data: { preferences: updatedPrefs as any }
    });
  }

  /**
   * Get users who have favorited a specific activity and have capacity alerts enabled
   */
  async getUsersWithFavoriteCapacityAlerts(activityId: string): Promise<User[]> {
    const favorites = await prisma.favorite.findMany({
      where: {
        activityId,
        notifyOnChange: true
      },
      include: { user: true }
    });

    return favorites
      .filter(fav => {
        const prefs = fav.user.preferences as UserPreferences | null;
        return prefs?.notifications?.enabled && prefs?.notifications?.favoriteCapacity;
      })
      .map(fav => fav.user);
  }

  /**
   * Get the capacity threshold for a user
   */
  getCapacityThreshold(user: User): number {
    const prefs = user.preferences as UserPreferences | null;
    return prefs?.notifications?.capacityThreshold ?? 3;
  }

  /**
   * Check if user should receive price drop alerts
   */
  userWantsPriceDropAlerts(user: User): boolean {
    const prefs = user.preferences as UserPreferences | null;
    return prefs?.notifications?.enabled === true && prefs?.notifications?.priceDrops === true;
  }

  /**
   * Check if user is within quiet hours (should not receive notifications)
   */
  isInQuietHours(user: User): boolean {
    const prefs = user.preferences as UserPreferences | null;
    if (!prefs?.notifications?.quietHoursStart || !prefs?.notifications?.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const start = prefs.notifications.quietHoursStart;
    const end = prefs.notifications.quietHoursEnd;

    // Handle overnight quiet hours (e.g., 22:00 to 07:00)
    if (start > end) {
      return currentTime >= start || currentTime <= end;
    }

    return currentTime >= start && currentTime <= end;
  }
}

export const userPreferenceMatcherService = new UserPreferenceMatcherService();
