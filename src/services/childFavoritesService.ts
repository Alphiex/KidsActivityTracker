/**
 * Child-centric favorites service
 * Manages favorites on a per-child basis using the server API
 * Each child has their own list of favorite activities
 */
import apiClient from './apiClient';

// Types
export interface ChildFavorite {
  id: string;
  childId: string;
  childName?: string;
  activityId: string;
  notifyOnChange: boolean;
  createdAt: string;
  activity: {
    id: string;
    name: string;
    category: string;
    provider?: string;
    location?: string;
    locationCity?: string;
    spotsAvailable?: number;
    totalSpots?: number;
    cost: number;
    dateStart?: string;
    dateEnd?: string;
    startTime?: string;
    endTime?: string;
    dayOfWeek?: string[];
    ageMin?: number;
    ageMax?: number;
    registrationStatus?: string;
    registrationUrl?: string;
    directRegistrationUrl?: string;
    activityType?: string;
    isActive: boolean;
  };
}

export interface ChildWaitlistEntry {
  id: string;
  childId: string;
  childName?: string;
  activityId: string;
  joinedAt: string;
  notifiedAt?: string;
  activity: {
    id: string;
    name: string;
    category: string;
    provider?: string;
    location?: string;
    spotsAvailable?: number;
    totalSpots?: number;
    cost: number;
    dateStart?: string;
    dateEnd?: string;
    startTime?: string;
    endTime?: string;
    registrationUrl?: string;
    directRegistrationUrl?: string;
  };
}

export interface ChildNotificationPreferences {
  childId: string;
  enabled: boolean;
  spotsAvailable: boolean;
  favoriteCapacity: boolean;
  capacityThreshold: number;
  priceDrops: boolean;
  newActivities: boolean;
  dailyDigest: boolean;
  weeklyDigest: boolean;
  pushEnabled: boolean;
  pushSpotsAvailable: boolean;
  pushCapacityAlerts: boolean;
  pushPriceDrops: boolean;
}

export interface ActivityChildStatus {
  childId: string;
  childName: string;
  isFavorited: boolean;
  isOnWaitlist: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  error?: string;
  favorites?: T[];
  waitlist?: T[];
  status?: T[];
  preferences?: T;
  favorite?: T;
  waitlistEntry?: T;
  isFavorited?: boolean;
  isOnWaitlist?: boolean;
  migrated?: number;
  skipped?: number;
  total?: number;
  message?: string;
}

class ChildFavoritesService {
  // ============= FAVORITES =============

  /**
   * Get all favorites for a specific child
   */
  async getChildFavorites(childId: string): Promise<ChildFavorite[]> {
    try {
      const response = await apiClient.get<ApiResponse<ChildFavorite>>(
        `/api/v1/children/${childId}/favorites`
      );
      return response.favorites || [];
    } catch (error: any) {
      console.error('[ChildFavoritesService] Error getting favorites:', error);
      throw new Error(error?.response?.data?.error || 'Failed to get favorites');
    }
  }

  /**
   * Get favorites for multiple children
   */
  async getFavoritesForChildren(childIds: string[]): Promise<ChildFavorite[]> {
    if (childIds.length === 0) return [];

    try {
      const response = await apiClient.get<ApiResponse<ChildFavorite>>(
        `/api/v1/children/favorites/multi?childIds=${childIds.join(',')}`
      );
      return response.favorites || [];
    } catch (error: any) {
      console.error('[ChildFavoritesService] Error getting favorites for children:', error);
      throw new Error(error?.response?.data?.error || 'Failed to get favorites');
    }
  }

  /**
   * Add activity to child's favorites
   */
  async addFavorite(childId: string, activityId: string, notifyOnChange: boolean = true): Promise<void> {
    try {
      await apiClient.post(
        `/api/v1/children/${childId}/favorites/${activityId}`,
        { notifyOnChange }
      );
    } catch (error: any) {
      console.error('[ChildFavoritesService] Error adding favorite:', error);
      throw new Error(error?.response?.data?.error || 'Failed to add favorite');
    }
  }

  /**
   * Remove activity from child's favorites
   */
  async removeFavorite(childId: string, activityId: string): Promise<void> {
    try {
      await apiClient.delete(`/api/v1/children/${childId}/favorites/${activityId}`);
    } catch (error: any) {
      console.error('[ChildFavoritesService] Error removing favorite:', error);
      throw new Error(error?.response?.data?.error || 'Failed to remove favorite');
    }
  }

  /**
   * Toggle favorite for a child
   */
  async toggleFavorite(childId: string, activityId: string, currentlyFavorited: boolean): Promise<boolean> {
    if (currentlyFavorited) {
      await this.removeFavorite(childId, activityId);
      return false;
    } else {
      await this.addFavorite(childId, activityId);
      return true;
    }
  }

  /**
   * Check if activity is favorited for a specific child
   */
  async isFavorited(childId: string, activityId: string): Promise<boolean> {
    try {
      const response = await apiClient.get<ApiResponse<boolean>>(
        `/api/v1/children/${childId}/favorites/${activityId}/status`
      );
      return response.isFavorited || false;
    } catch (error: any) {
      console.error('[ChildFavoritesService] Error checking favorite status:', error);
      return false;
    }
  }

  /**
   * Get favorite status for an activity across multiple children
   */
  async getFavoriteStatusForChildren(
    activityId: string,
    childIds: string[]
  ): Promise<Array<{ childId: string; childName: string; isFavorited: boolean }>> {
    if (childIds.length === 0) return [];

    try {
      const response = await apiClient.get<ApiResponse<{ childId: string; childName: string; isFavorited: boolean }>>(
        `/api/v1/children/favorites/status/${activityId}?childIds=${childIds.join(',')}`
      );
      return response.status || [];
    } catch (error: any) {
      console.error('[ChildFavoritesService] Error getting favorite status:', error);
      return [];
    }
  }

  /**
   * Update notification preference for a favorite
   */
  async updateFavoriteNotification(childId: string, activityId: string, notifyOnChange: boolean): Promise<void> {
    try {
      await apiClient.patch(
        `/api/v1/children/${childId}/favorites/${activityId}/notify`,
        { notifyOnChange }
      );
    } catch (error: any) {
      console.error('[ChildFavoritesService] Error updating notification:', error);
      throw new Error(error?.response?.data?.error || 'Failed to update notification preference');
    }
  }

  // ============= WAITLIST =============

  /**
   * Get all waitlist entries for a specific child
   */
  async getChildWaitlist(childId: string): Promise<ChildWaitlistEntry[]> {
    try {
      const response = await apiClient.get<ApiResponse<ChildWaitlistEntry>>(
        `/api/v1/children/${childId}/waitlist`
      );
      return response.waitlist || [];
    } catch (error: any) {
      console.error('[ChildFavoritesService] Error getting waitlist:', error);
      throw new Error(error?.response?.data?.error || 'Failed to get waitlist');
    }
  }

  /**
   * Get waitlist entries for multiple children
   */
  async getWaitlistForChildren(childIds: string[]): Promise<ChildWaitlistEntry[]> {
    if (childIds.length === 0) return [];

    try {
      const response = await apiClient.get<ApiResponse<ChildWaitlistEntry>>(
        `/api/v1/children/waitlist/multi?childIds=${childIds.join(',')}`
      );
      return response.waitlist || [];
    } catch (error: any) {
      console.error('[ChildFavoritesService] Error getting waitlist for children:', error);
      throw new Error(error?.response?.data?.error || 'Failed to get waitlist');
    }
  }

  /**
   * Add child to waitlist for an activity
   */
  async joinWaitlist(childId: string, activityId: string): Promise<void> {
    try {
      await apiClient.post(`/api/v1/children/${childId}/waitlist/${activityId}`);
    } catch (error: any) {
      console.error('[ChildFavoritesService] Error joining waitlist:', error);
      throw new Error(error?.response?.data?.error || 'Failed to join waitlist');
    }
  }

  /**
   * Remove child from waitlist
   */
  async leaveWaitlist(childId: string, activityId: string): Promise<void> {
    try {
      await apiClient.delete(`/api/v1/children/${childId}/waitlist/${activityId}`);
    } catch (error: any) {
      console.error('[ChildFavoritesService] Error leaving waitlist:', error);
      throw new Error(error?.response?.data?.error || 'Failed to leave waitlist');
    }
  }

  /**
   * Check if child is on waitlist for an activity
   */
  async isOnWaitlist(childId: string, activityId: string): Promise<boolean> {
    try {
      const response = await apiClient.get<ApiResponse<boolean>>(
        `/api/v1/children/${childId}/waitlist/${activityId}/status`
      );
      return response.isOnWaitlist || false;
    } catch (error: any) {
      console.error('[ChildFavoritesService] Error checking waitlist status:', error);
      return false;
    }
  }

  /**
   * Get waitlist status for an activity across multiple children
   */
  async getWaitlistStatusForChildren(
    activityId: string,
    childIds: string[]
  ): Promise<Array<{ childId: string; childName: string; isOnWaitlist: boolean }>> {
    if (childIds.length === 0) return [];

    try {
      const response = await apiClient.get<ApiResponse<{ childId: string; childName: string; isOnWaitlist: boolean }>>(
        `/api/v1/children/waitlist/status/${activityId}?childIds=${childIds.join(',')}`
      );
      return response.status || [];
    } catch (error: any) {
      console.error('[ChildFavoritesService] Error getting waitlist status:', error);
      return [];
    }
  }

  // ============= COMBINED STATUS =============

  /**
   * Get combined activity status (favorite + waitlist) for multiple children
   */
  async getActivityStatusForChildren(activityId: string, childIds: string[]): Promise<ActivityChildStatus[]> {
    if (childIds.length === 0) return [];

    try {
      const response = await apiClient.get<ApiResponse<ActivityChildStatus>>(
        `/api/v1/children/activity-status/${activityId}?childIds=${childIds.join(',')}`
      );
      return response.status || [];
    } catch (error: any) {
      console.error('[ChildFavoritesService] Error getting activity status:', error);
      return [];
    }
  }

  // ============= NOTIFICATION PREFERENCES =============

  /**
   * Get notification preferences for a child
   */
  async getChildNotificationPreferences(childId: string): Promise<ChildNotificationPreferences> {
    try {
      const response = await apiClient.get<ApiResponse<ChildNotificationPreferences>>(
        `/api/v1/children/${childId}/notifications`
      );
      return response.preferences || {
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
        pushPriceDrops: true,
      };
    } catch (error: any) {
      console.error('[ChildFavoritesService] Error getting notification preferences:', error);
      throw new Error(error?.response?.data?.error || 'Failed to get notification preferences');
    }
  }

  /**
   * Update notification preferences for a child
   */
  async updateChildNotificationPreferences(
    childId: string,
    updates: Partial<Omit<ChildNotificationPreferences, 'childId'>>
  ): Promise<ChildNotificationPreferences> {
    try {
      const response = await apiClient.put<ApiResponse<ChildNotificationPreferences>>(
        `/api/v1/children/${childId}/notifications`,
        updates
      );
      return response.preferences!;
    } catch (error: any) {
      console.error('[ChildFavoritesService] Error updating notification preferences:', error);
      throw new Error(error?.response?.data?.error || 'Failed to update notification preferences');
    }
  }

  // ============= MIGRATION =============

  /**
   * Migrate user-level favorites to a specific child
   */
  async migrateUserFavoritesToChild(childId: string): Promise<{ migrated: number; skipped: number; total: number }> {
    try {
      const response = await apiClient.post<ApiResponse<never>>(
        `/api/v1/children/${childId}/favorites/migrate`
      );
      return {
        migrated: response.migrated || 0,
        skipped: response.skipped || 0,
        total: response.total || 0,
      };
    } catch (error: any) {
      console.error('[ChildFavoritesService] Error migrating favorites:', error);
      throw new Error(error?.response?.data?.error || 'Failed to migrate favorites');
    }
  }

  // ============= HELPERS =============

  /**
   * Group favorites by child for display
   */
  groupFavoritesByChild(favorites: ChildFavorite[]): Map<string, ChildFavorite[]> {
    const grouped = new Map<string, ChildFavorite[]>();

    for (const fav of favorites) {
      const existing = grouped.get(fav.childId) || [];
      existing.push(fav);
      grouped.set(fav.childId, existing);
    }

    return grouped;
  }

  /**
   * Group favorites by activity (to see which children favorited same activity)
   */
  groupFavoritesByActivity(favorites: ChildFavorite[]): Map<string, ChildFavorite[]> {
    const grouped = new Map<string, ChildFavorite[]>();

    for (const fav of favorites) {
      const existing = grouped.get(fav.activityId) || [];
      existing.push(fav);
      grouped.set(fav.activityId, existing);
    }

    return grouped;
  }

  /**
   * Check if any selected children have favorited an activity
   * (Used for UI to show favorite state when multiple children selected)
   */
  isAnyChildFavorited(activityId: string, favoritesByChild: Map<string, ChildFavorite[]>): boolean {
    for (const favorites of favoritesByChild.values()) {
      if (favorites.some(f => f.activityId === activityId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get child IDs who have favorited a specific activity
   */
  getChildrenWhoFavorited(activityId: string, favorites: ChildFavorite[]): string[] {
    return favorites
      .filter(f => f.activityId === activityId)
      .map(f => f.childId);
  }
}

export const childFavoritesService = new ChildFavoritesService();
export default childFavoritesService;
