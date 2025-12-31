import apiClient from './apiClient';

export interface NotificationPreferences {
  enabled: boolean;
  newActivities: boolean;
  dailyDigest: boolean;
  favoriteCapacity: boolean;
  capacityThreshold: number;
  priceDrops: boolean;
  weeklyDigest: boolean;
  spotsAvailable: boolean;
  reminders?: boolean;
  quietHoursStart?: string; // "22:00"
  quietHoursEnd?: string; // "07:00"
}

export interface WaitlistEntry {
  id: string;
  activityId: string;
  activity: {
    id: string;
    name: string;
    provider?: string;
    location?: string;
    spotsAvailable?: number;
    totalSpots?: number;
    cost?: number;
    dateStart?: string;
    dateEnd?: string;
    startTime?: string;
    endTime?: string;
    registrationUrl?: string;
    directRegistrationUrl?: string;
  };
  joinedAt: string;
  notifiedAt?: string;
}

export interface NotificationHistoryItem {
  id: string;
  type: string;
  activityCount: number;
  sentAt: string;
  status: string;
}

class NotificationService {
  private static instance: NotificationService;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Get notification preferences from server
   */
  async getPreferences(): Promise<NotificationPreferences> {
    try {
      const response: any = await apiClient.get('/notifications/preferences');
      return response.preferences;
    } catch (error) {
      console.error('[NotificationService] Failed to get preferences:', error);
      // Return default preferences if server is unavailable
      return {
        enabled: false,
        newActivities: false,
        dailyDigest: false,
        favoriteCapacity: false,
        capacityThreshold: 3,
        priceDrops: false,
        weeklyDigest: false,
        spotsAvailable: false,
      };
    }
  }

  /**
   * Update notification preferences on server
   */
  async updatePreferences(preferences: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    try {
      const response: any = await apiClient.put('/notifications/preferences', preferences);
      return response.preferences;
    } catch (error) {
      console.error('[NotificationService] Failed to update preferences:', error);
      throw error;
    }
  }

  /**
   * Get notification history
   */
  async getHistory(limit: number = 20, offset: number = 0): Promise<{
    notifications: NotificationHistoryItem[];
    hasMore: boolean;
  }> {
    try {
      const response: any = await apiClient.get(`/notifications/history?limit=${limit}&offset=${offset}`);
      return {
        notifications: response.notifications,
        hasMore: response.pagination.hasMore,
      };
    } catch (error) {
      console.error('[NotificationService] Failed to get history:', error);
      return { notifications: [], hasMore: false };
    }
  }

  /**
   * Send a test notification email
   */
  async sendTestNotification(): Promise<{ success: boolean; message: string }> {
    try {
      const response: any = await apiClient.post('/notifications/test');
      return {
        success: response.success,
        message: response.message,
      };
    } catch (error: any) {
      console.error('[NotificationService] Failed to send test:', error);
      const message = error.response?.data?.error || 'Failed to send test notification';
      return { success: false, message };
    }
  }

  /**
   * Get user's waitlist entries
   */
  async getWaitlist(): Promise<WaitlistEntry[]> {
    try {
      const response: any = await apiClient.get('/notifications/waitlist');
      return response.waitlist;
    } catch (error) {
      console.error('[NotificationService] Failed to get waitlist:', error);
      return [];
    }
  }

  /**
   * Join waitlist for an activity
   */
  async joinWaitlist(activityId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response: any = await apiClient.post(`/notifications/waitlist/${activityId}`);
      return {
        success: response.success,
        message: response.message,
      };
    } catch (error: any) {
      console.error('[NotificationService] Failed to join waitlist:', error);
      const message = error.response?.data?.error || 'Failed to join waitlist';
      return { success: false, message };
    }
  }

  /**
   * Leave waitlist for an activity
   */
  async leaveWaitlist(activityId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response: any = await apiClient.delete(`/notifications/waitlist/${activityId}`);
      return {
        success: response.success,
        message: response.message,
      };
    } catch (error: any) {
      console.error('[NotificationService] Failed to leave waitlist:', error);
      const message = error.response?.data?.error || 'Failed to leave waitlist';
      return { success: false, message };
    }
  }

  /**
   * Check if user is on waitlist for an activity
   */
  async isOnWaitlist(activityId: string): Promise<boolean> {
    try {
      const waitlist = await this.getWaitlist();
      return waitlist.some(entry => entry.activityId === activityId);
    } catch (error) {
      return false;
    }
  }

  /**
   * Unsubscribe from all notifications (quick method)
   */
  async unsubscribeAll(): Promise<{ success: boolean; message?: string }> {
    try {
      const response: any = await apiClient.post('/notifications/unsubscribe-all');
      return {
        success: response.success,
        message: response.message,
      };
    } catch (error: any) {
      console.error('[NotificationService] Failed to unsubscribe:', error);
      const message = error.response?.data?.error || 'Failed to unsubscribe';
      return { success: false, message };
    }
  }
}

export default NotificationService;
