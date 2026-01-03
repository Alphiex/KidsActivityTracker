import apiClient from './apiClient';
import { Activity } from '../types/activity';
import { Child } from '../store/slices/childrenSlice';

export type ActivityStatus = 'planned' | 'in_progress' | 'completed';

export interface ChildActivity {
  id: string;
  childId: string;
  activityId: string;
  status: ActivityStatus;
  notes?: string;
  rating?: number;
  registeredAt?: Date;
  completedAt?: Date;
  createdAt: string;
  updatedAt: string;
  activity?: Activity;
  child?: Child;
}

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

class ChildActivityService {
  private static instance: ChildActivityService;

  static getInstance(): ChildActivityService {
    if (!this.instance) {
      this.instance = new ChildActivityService();
    }
    return this.instance;
  }

  /**
   * Link an activity to a child
   */
  async linkActivity(input: LinkActivityInput): Promise<ChildActivity> {
    try {
      // apiClient already returns response.data, so response IS the data
      const response = await apiClient.post<any>('/api/v1/child-activities/link', input);
      // API returns { success: true, childActivity }
      const childActivity = response?.childActivity || response;

      // Ensure we have a valid response with required fields
      if (!childActivity || !childActivity.childId) {
        console.warn('[ChildActivityService] API returned unexpected format:', response, 'using fallback');
        return {
          id: `temp-${input.childId}-${input.activityId}-${Date.now()}`,
          childId: input.childId,
          activityId: input.activityId,
          status: input.status,
          notes: input.notes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      return childActivity;
    } catch (error) {
      console.error('Error linking activity:', error);
      throw error;
    }
  }

  /**
   * Update activity status for a child
   */
  async updateActivityStatus(
    childId: string,
    activityId: string,
    input: UpdateActivityStatusInput
  ): Promise<ChildActivity> {
    try {
      // apiClient already returns response.data
      const response = await apiClient.put<any>(
        `/api/v1/child-activities/${childId}/activities/${activityId}`,
        input
      );
      // API returns { success: true, childActivity }
      return response?.childActivity || response;
    } catch (error) {
      console.error('Error updating activity status:', error);
      throw error;
    }
  }

  /**
   * Remove activity link
   */
  async unlinkActivity(childId: string, activityId: string): Promise<void> {
    try {
      await apiClient.delete(`/api/v1/child-activities/${childId}/activities/${activityId}`);
    } catch (error) {
      console.error('Error unlinking activity:', error);
      throw error;
    }
  }

  /**
   * Get activities for a specific child
   */
  async getChildActivities(childId: string): Promise<ChildActivity[]> {
    try {
      // apiClient already returns response.data
      const response = await apiClient.get<any>(`/api/v1/child-activities/${childId}/activities`);
      // API returns { success: true, activities: [...] }
      const activities = response?.activities || response || [];
      if (!Array.isArray(activities)) {
        console.warn('[ChildActivityService] getChildActivities returned non-array:', response);
        return [];
      }
      return activities;
    } catch (error) {
      console.error('Error fetching child activities:', error);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  }

  /**
   * Get children registered for a specific activity
   */
  async getActivityChildren(activityId: string): Promise<string[]> {
    try {
      // For now, we'll get all activities and filter on the client side
      // apiClient already returns response.data
      const response = await apiClient.get<any>('/api/v1/child-activities/history');
      const activities = (response?.activities || []) as ChildActivity[];

      // Extract unique child IDs for this activity
      const childIds = activities
        .filter(ca => ca.activityId === activityId)
        .map(ca => ca.childId);

      return [...new Set(childIds)];
    } catch (error) {
      console.error('Error fetching activity children:', error);
      return [];
    }
  }

  /**
   * Get activity history with filters
   */
  async getActivityHistory(filters: ActivityHistoryFilters = {}): Promise<ChildActivity[]> {
    try {
      const params = new URLSearchParams();

      if (filters.childId) params.append('childId', filters.childId);
      if (filters.status) params.append('status', filters.status);
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString());
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString());
      if (filters.category) params.append('category', filters.category);
      if (filters.minRating) params.append('minRating', filters.minRating.toString());

      // apiClient already returns response.data
      const response = await apiClient.get<any>(`/api/v1/child-activities/history?${params.toString()}`);
      const activities = response?.activities || response || [];
      if (!Array.isArray(activities)) {
        console.warn('[ChildActivityService] getActivityHistory returned non-array:', response);
        return [];
      }
      return activities;
    } catch (error) {
      console.error('Error fetching activity history:', error);
      return [];
    }
  }

  /**
   * Get age-appropriate activity recommendations for a child
   */
  async getRecommendedActivities(childId: string): Promise<Activity[]> {
    try {
      // apiClient already returns response.data
      const response = await apiClient.get<any>(`/api/v1/child-activities/${childId}/recommendations`);
      return response?.activities || [];
    } catch (error) {
      console.error('Error fetching recommended activities:', error);
      return [];
    }
  }

  /**
   * Get favorite activities for a child
   */
  async getChildFavorites(childId: string): Promise<ChildActivity[]> {
    try {
      // apiClient already returns response.data
      const response = await apiClient.get<any>(`/api/v1/child-activities/${childId}/favorites`);
      return response?.favorites || [];
    } catch (error) {
      console.error('Error fetching child favorites:', error);
      return [];
    }
  }

  /**
   * Get calendar data for child activities
   */
  async getCalendarData(
    view: 'week' | 'month' | 'year',
    date: Date,
    childIds?: string[]
  ): Promise<CalendarEvent[]> {
    try {
      const params = new URLSearchParams();
      params.append('view', view);
      params.append('date', date.toISOString());
      if (childIds && childIds.length > 0) {
        params.append('childIds', childIds.join(','));
      }

      // apiClient already returns response.data
      const response = await apiClient.get<any>(`/api/v1/child-activities/calendar?${params.toString()}`);
      return response?.events || [];
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      return [];
    }
  }

  /**
   * Get activity statistics for children
   */
  async getActivityStats(childIds?: string[]): Promise<any> {
    try {
      const params = childIds && childIds.length > 0
        ? `?childIds=${childIds.join(',')}`
        : '';

      // apiClient already returns response.data
      const response = await apiClient.get<any>(`/api/v1/child-activities/stats${params}`);
      return response?.stats || {};
    } catch (error) {
      console.error('Error fetching activity stats:', error);
      return {};
    }
  }

  /**
   * Bulk link activities to a child
   */
  async bulkLinkActivities(
    childId: string,
    activityIds: string[],
    status: ActivityStatus = 'planned'
  ): Promise<number> {
    try {
      // apiClient already returns response.data
      const response = await apiClient.post<any>('/api/v1/child-activities/bulk-link', {
        childId,
        activityIds,
        status,
      });
      return response?.linkedCount || response?.count || 0;
    } catch (error) {
      console.error('Error bulk linking activities:', error);
      return 0;
    }
  }

  /**
   * Get upcoming activities for notification
   */
  async getUpcomingActivities(days = 7): Promise<ChildActivity[]> {
    try {
      // apiClient already returns response.data
      const response = await apiClient.get<any>(`/api/v1/child-activities/upcoming?days=${days}`);
      return response?.activities || [];
    } catch (error) {
      console.error('Error fetching upcoming activities:', error);
      return [];
    }
  }
}

export default ChildActivityService.getInstance();