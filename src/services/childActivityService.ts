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
      const response = await apiClient.post<any>('/child-activities/link', input);
      return response.data;
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
      const response = await apiClient.put<any>(
        `/child-activities/${childId}/activities/${activityId}`,
        input
      );
      return response.data;
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
      await apiClient.delete(`/child-activities/${childId}/activities/${activityId}`);
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
      const response = await apiClient.get<any>(`/child-activities/${childId}/activities`);
      return response.data.activities;
    } catch (error) {
      console.error('Error fetching child activities:', error);
      throw error;
    }
  }

  /**
   * Get children registered for a specific activity
   */
  async getActivityChildren(activityId: string): Promise<string[]> {
    try {
      // For now, we'll get all activities and filter on the client side
      // In a production app, you'd want to add a specific endpoint for this
      const response = await apiClient.get<any>('/child-activities/history');
      const activities = response.data.activities as ChildActivity[];
      
      // Extract unique child IDs for this activity
      const childIds = activities
        .filter(ca => ca.activityId === activityId)
        .map(ca => ca.childId);
      
      return [...new Set(childIds)];
    } catch (error) {
      console.error('Error fetching activity children:', error);
      throw error;
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
      
      const response = await apiClient.get<any>(`/child-activities/history?${params.toString()}`);
      return response.data.activities;
    } catch (error) {
      console.error('Error fetching activity history:', error);
      throw error;
    }
  }

  /**
   * Get age-appropriate activity recommendations for a child
   */
  async getRecommendedActivities(childId: string): Promise<Activity[]> {
    try {
      const response = await apiClient.get<any>(`/child-activities/${childId}/recommendations`);
      return response.data.activities;
    } catch (error) {
      console.error('Error fetching recommended activities:', error);
      throw error;
    }
  }

  /**
   * Get favorite activities for a child
   */
  async getChildFavorites(childId: string): Promise<ChildActivity[]> {
    try {
      const response = await apiClient.get<any>(`/child-activities/${childId}/favorites`);
      return response.data.favorites;
    } catch (error) {
      console.error('Error fetching child favorites:', error);
      throw error;
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
      
      const response = await apiClient.get<any>(`/child-activities/calendar?${params.toString()}`);
      return response.data.events;
    } catch (error) {
      console.error('Error fetching calendar data:', error);
      throw error;
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
      
      const response = await apiClient.get<any>(`/child-activities/stats${params}`);
      return response.data.stats;
    } catch (error) {
      console.error('Error fetching activity stats:', error);
      throw error;
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
      const response = await apiClient.post<any>('/child-activities/bulk-link', {
        childId,
        activityIds,
        status,
      });
      return response.data.count;
    } catch (error) {
      console.error('Error bulk linking activities:', error);
      throw error;
    }
  }

  /**
   * Get upcoming activities for notification
   */
  async getUpcomingActivities(days = 7): Promise<ChildActivity[]> {
    try {
      const response = await apiClient.get<any>(`/child-activities/upcoming?days=${days}`);
      return response.data.activities;
    } catch (error) {
      console.error('Error fetching upcoming activities:', error);
      throw error;
    }
  }
}

export default ChildActivityService.getInstance();