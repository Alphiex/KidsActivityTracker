import apiClient from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Child as StoreChild } from '../store/slices/childrenSlice';
import { safeMap, safeParseDate, safeString, safeNumber, isValidObject, safeFirst } from '../utils/safeAccessors';

export type Child = StoreChild;
import { Activity } from '../types';

interface LocationDetails {
  formattedAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

interface ChildFormData {
  name: string;
  dateOfBirth: string;
  location?: string;
  locationDetails?: LocationDetails;
  interests?: string[];
  avatar?: string;
  avatarId?: number;
  colorId?: number;
  allergies?: string[];
  medicalInfo?: string;
}

interface ChildActivitiesResponse {
  activities: Activity[];
  recommendations: Activity[];
}

export interface ChildActivity {
  id: string;
  childId: string;
  activityId: string;
  status: 'planned' | 'in_progress' | 'completed';
  addedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  notes?: string;
  scheduledDate?: Date;
  startTime?: string;
  endTime?: string;
  recurring?: boolean;
  recurrencePattern?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  recurrenceEnd?: Date;
  activity?: Activity; // Include full activity details from API
}

export interface SharedChild {
  id: string;
  childId: string;
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  sharedWithEmail: string;
  permissions: 'view' | 'edit';
  acceptedAt?: Date;
  createdAt: Date;
}

const STORAGE_KEYS = {
  CHILD_ACTIVITIES: '@kids_tracker/child_activities',
  SHARED_CHILDREN: '@kids_tracker/shared_children',
};

class ChildrenService {
  private static instance: ChildrenService;
  private childActivities: ChildActivity[] = [];
  private sharedChildren: SharedChild[] = [];
  private initialized = false;

  private constructor() {
    this.loadLocalData();
  }

  static getInstance(): ChildrenService {
    if (!ChildrenService.instance) {
      ChildrenService.instance = new ChildrenService();
    }
    return ChildrenService.instance;
  }

  private async loadLocalData(): Promise<void> {
    try {
      const [activitiesData, sharedData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.CHILD_ACTIVITIES),
        AsyncStorage.getItem(STORAGE_KEYS.SHARED_CHILDREN),
      ]);

      if (activitiesData) {
        this.childActivities = JSON.parse(activitiesData).map((activity: any) => ({
          ...activity,
          addedAt: new Date(activity.addedAt),
          startedAt: activity.startedAt ? new Date(activity.startedAt) : undefined,
          completedAt: activity.completedAt ? new Date(activity.completedAt) : undefined,
        }));
      }

      if (sharedData) {
        this.sharedChildren = JSON.parse(sharedData).map((shared: any) => ({
          ...shared,
          createdAt: new Date(shared.createdAt),
          acceptedAt: shared.acceptedAt ? new Date(shared.acceptedAt) : undefined,
        }));
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Error loading local data:', error);
      this.initialized = true;
    }
  }

  private async saveLocalData(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.CHILD_ACTIVITIES, JSON.stringify(this.childActivities)),
        AsyncStorage.setItem(STORAGE_KEYS.SHARED_CHILDREN, JSON.stringify(this.sharedChildren)),
      ]);
    } catch (error) {
      console.error('Error saving local data:', error);
    }
  }

  async getChildren(): Promise<Child[]> {
    try {
      const response = await apiClient.get<{ success: boolean; children: Child[] }>('/api/children');
      return Array.isArray(response?.children) ? response.children : [];
    } catch (error) {
      console.error('Error fetching children:', error);
      throw error;
    }
  }

  async getChild(id: string): Promise<Child | null> {
    try {
      const response = await apiClient.get<{ success: boolean; child: Child }>(`/api/children/${id}`);
      return response?.child ?? null;
    } catch (error) {
      console.error('Error fetching child:', error);
      throw error;
    }
  }

  async createChild(childData: ChildFormData): Promise<Child | null> {
    try {
      console.log('Creating child with data:', JSON.stringify(childData, null, 2));
      const response = await apiClient.post<{ success: boolean; child: Child }>('/api/children', childData);
      console.log('Create child response:', JSON.stringify(response, null, 2));
      return response?.child ?? null;
    } catch (error: any) {
      console.error('Error creating child:', error);
      console.error('Error details:', {
        message: error?.message,
        responseData: JSON.stringify(error?.response?.data),
        status: error?.response?.status,
      });
      throw error;
    }
  }

  async updateChild(id: string, childData: Partial<ChildFormData>): Promise<Child> {
    try {
      const response = await apiClient.patch<{ success: boolean; child: Child }>(`/api/children/${id}`, childData);
      return response.child;
    } catch (error) {
      console.error('Error updating child:', error);
      throw error;
    }
  }

  async deleteChild(id: string): Promise<void> {
    try {
      await apiClient.delete(`/api/children/${id}`);
    } catch (error) {
      console.error('Error deleting child:', error);
      throw error;
    }
  }

  async uploadAvatar(childId: string, imageUri: string): Promise<{ avatarUrl: string }> {
    try {
      const formData = new FormData();
      formData.append('avatar', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'avatar.jpg',
      } as any);

      const response = await apiClient.post<{ avatarUrl: string }>(
        `/children/${childId}/avatar`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  }

  async getChildActivities(childId: string): Promise<ChildActivitiesResponse> {
    try {
      const response = await apiClient.get<ChildActivitiesResponse>(
        `/children/${childId}/activities`
      );
      return response;
    } catch (error) {
      console.error('Error fetching child activities:', error);
      throw error;
    }
  }

  async getAgeAppropriateActivities(childId: string): Promise<Activity[]> {
    try {
      const response = await apiClient.get<Activity[]>(
        `/children/${childId}/recommendations`
      );
      return response;
    } catch (error) {
      console.error('Error fetching age-appropriate activities:', error);
      throw error;
    }
  }

  // Helper method to calculate age from date of birth
  calculateAge(dateOfBirth: string | undefined | null): number {
    if (!dateOfBirth || typeof dateOfBirth !== 'string') {
      return 0;
    }

    try {
      const today = new Date();
      // Parse date as local date, not UTC
      // Handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS.SSSZ" formats
      const datePart = dateOfBirth.split('T')[0];
      const parts = datePart.split('-');

      // Validate we have 3 parts (year, month, day)
      if (parts.length !== 3) {
        return 0;
      }

      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);

      // Validate parsed values
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        return 0;
      }

      const birthDate = new Date(year, month - 1, day);

      // Validate the date is valid
      if (isNaN(birthDate.getTime())) {
        return 0;
      }

      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      return Math.max(0, age); // Ensure non-negative age
    } catch {
      return 0;
    }
  }

  // Helper method to get age group label
  getAgeGroup(age: number): string {
    if (age < 2) return 'Infant';
    if (age < 4) return 'Toddler';
    if (age < 6) return 'Preschool';
    if (age < 9) return 'Early Elementary';
    if (age < 12) return 'Late Elementary';
    if (age < 14) return 'Middle School';
    if (age < 18) return 'High School';
    return 'Young Adult';
  }

  // Child Activity Management
  async addActivityToChild(
    childId: string,
    activityId: string,
    status: ChildActivity['status'] = 'planned',
    scheduledDate?: Date,
    startTime?: string,
    endTime?: string
  ): Promise<ChildActivity> {
    try {
      const response = await apiClient.post<{ success: boolean; childActivity: any }>(
        `/api/children/${childId}/activities`,
        {
          activityId,
          status,
          scheduledDate: scheduledDate?.toISOString(),
          startTime,
          endTime,
        }
      );

      // Validate response has childActivity
      const ca = response?.childActivity;
      if (!ca || !isValidObject(ca)) {
        throw new Error('Invalid response: missing childActivity');
      }

      const childActivity: ChildActivity = {
        id: safeString(ca.id, `${childId}-${activityId}-${Date.now()}`),
        childId: safeString(ca.childId, childId),
        activityId: safeString(ca.activityId, activityId),
        status: (ca.status as ChildActivity['status']) || status,
        addedAt: safeParseDate(ca.createdAt as string | Date | null) || new Date(),
        startedAt: safeParseDate(ca.registeredAt as string | Date | null) || undefined,
        completedAt: safeParseDate(ca.completedAt as string | Date | null) || undefined,
        scheduledDate: safeParseDate(ca.scheduledDate as string | Date | null) || scheduledDate,
        startTime: (ca.startTime as string | undefined) ?? startTime,
        endTime: (ca.endTime as string | undefined) ?? endTime,
        notes: ca.notes as string | undefined,
        activity: ca.activity as Activity | undefined, // Include full activity object from API
      };

      // Update local cache
      await this.waitForInit();
      this.childActivities.push(childActivity);
      await this.saveLocalData();

      return childActivity;
    } catch (error) {
      console.error('Error adding activity to child:', error);
      throw error;
    }
  }

  async updateActivityStatus(
    childActivityId: string,
    status: ChildActivity['status'],
    notes?: string
  ): Promise<ChildActivity | null> {
    try {
      // Find the activity to get childId
      await this.waitForInit();
      const activity = this.childActivities.find(ca => ca.id === childActivityId);
      if (!activity) return null;

      const response = await apiClient.patch<{ success: boolean; childActivity: any }>(
        `/api/children/${activity.childId}/activities/${childActivityId}`,
        {
          status,
          notes,
        }
      );

      const updated: ChildActivity = {
        id: response.childActivity.id,
        childId: response.childActivity.childId,
        activityId: response.childActivity.activityId,
        status: response.childActivity.status,
        addedAt: new Date(response.childActivity.createdAt),
        startedAt: response.childActivity.registeredAt ? new Date(response.childActivity.registeredAt) : undefined,
        completedAt: response.childActivity.completedAt ? new Date(response.childActivity.completedAt) : undefined,
        scheduledDate: response.childActivity.scheduledDate ? new Date(response.childActivity.scheduledDate) : undefined,
        startTime: response.childActivity.startTime,
        endTime: response.childActivity.endTime,
        notes: response.childActivity.notes,
      };

      // Update local cache
      const index = this.childActivities.findIndex(ca => ca.id === childActivityId);
      if (index !== -1) {
        this.childActivities[index] = updated;
        await this.saveLocalData();
      }

      return updated;
    } catch (error) {
      console.error('Error updating activity status:', error);
      throw error;
    }
  }

  async getChildActivitiesList(childId: string, status?: ChildActivity['status']): Promise<ChildActivity[]> {
    try {
      const response = await apiClient.get<{ success: boolean; activities: any[] }>(
        `/api/children/${childId}/activities${status ? `?status=${status}` : ''}`
      );

      console.log('=== API RESPONSE ===');
      console.log('Response:', JSON.stringify(response, null, 2));
      console.log('Activities count:', response?.activities?.length || 0);
      const firstActivity = safeFirst(response?.activities);
      if (firstActivity) {
        console.log('First activity:', JSON.stringify(firstActivity, null, 2));
      }

      const activities: ChildActivity[] = safeMap(response?.activities, (ca: any) => ({
        id: safeString(ca?.id, ''),
        childId: safeString(ca?.childId, childId),
        activityId: safeString(ca?.activityId, ''),
        status: ca?.status || 'planned',
        addedAt: safeParseDate(ca?.createdAt) || new Date(),
        startedAt: safeParseDate(ca?.registeredAt) || undefined,
        completedAt: safeParseDate(ca?.completedAt) || undefined,
        scheduledDate: safeParseDate(ca?.scheduledDate) || undefined,
        startTime: ca?.startTime,
        endTime: ca?.endTime,
        notes: ca?.notes,
        activity: ca?.activity, // Include full activity object from API
      }));

      // Update local cache
      await this.waitForInit();
      this.childActivities = [
        ...this.childActivities.filter(ca => ca.childId !== childId),
        ...activities
      ];
      await this.saveLocalData();

      return activities;
    } catch (error) {
      console.error('Error fetching child activities:', error);
      // Fallback to local cache
      await this.waitForInit();
      let activities = this.childActivities.filter(ca => ca.childId === childId);
      if (status) {
        activities = activities.filter(ca => ca.status === status);
      }
      return activities.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
    }
  }

  async getAllChildActivities(status?: ChildActivity['status']): Promise<ChildActivity[]> {
    await this.waitForInit();
    
    let activities = [...this.childActivities];
    
    if (status) {
      activities = activities.filter(ca => ca.status === status);
    }

    return activities.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
  }

  async isActivityAssignedToChild(childId: string, activityId: string): Promise<boolean> {
    await this.waitForInit();

    return this.childActivities.some(
      ca => ca.childId === childId && ca.activityId === activityId
    );
  }

  async isActivityAssignedToAnyChild(activityId: string): Promise<boolean> {
    try {
      const response = await apiClient.get<{ success: boolean; isAssigned: boolean }>(
        `/api/children/activities/${activityId}/assigned`
      );
      return response.isAssigned;
    } catch (error) {
      console.error('Error checking if activity is assigned:', error);
      // Fallback to local cache
      await this.waitForInit();
      return this.childActivities.some(ca => ca.activityId === activityId);
    }
  }

  async getChildStatistics(childId: string): Promise<{
    totalActivities: number;
    planned: number;
    inProgress: number;
    completed: number;
  }> {
    await this.waitForInit();
    
    const activities = this.childActivities.filter(ca => ca.childId === childId);
    
    return {
      totalActivities: activities.length,
      planned: activities.filter(ca => ca.status === 'planned').length,
      inProgress: activities.filter(ca => ca.status === 'in_progress').length,
      completed: activities.filter(ca => ca.status === 'completed').length,
    };
  }

  private async waitForInit(): Promise<void> {
    while (!this.initialized) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  // Sharing Methods
  async shareChildWithUser(childId: string, email: string, permission: 'view' | 'full'): Promise<void> {
    try {
      const response = await apiClient.post<any>('/api/children/share', {
        childId,
        email,
        permission,
      });
      return response.data;
    } catch (error) {
      console.error('Error sharing child:', error);
      throw error;
    }
  }

  async getSharedUsers(childId: string): Promise<any[]> {
    try {
      const response = await apiClient.get<any>(`/api/children/${childId}/shared`);
      return response.data;
    } catch (error) {
      console.error('Error fetching shared users:', error);
      // Return mock data for development
      return [];
    }
  }

  async revokeChildAccess(childId: string, userId: string): Promise<void> {
    try {
      const response = await apiClient.delete<any>(`/api/children/${childId}/shared/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error revoking access:', error);
      throw error;
    }
  }

  async removeActivityFromChild(childId: string, scheduleId: string): Promise<void> {
    try {
      await apiClient.delete(`/api/children/${childId}/activities/${scheduleId}`);
      // Update local cache
      this.childActivities = this.childActivities.filter(
        ca => !(ca.childId === childId && ca.id === scheduleId)
      );
    } catch (error) {
      console.error('Error removing activity from child:', error);
      // For now, just remove from local cache even if API fails
      this.childActivities = this.childActivities.filter(
        ca => !(ca.childId === childId && ca.id === scheduleId)
      );
    }
  }

  async updateChildActivity(
    activityId: string,
    updates: {
      scheduledDate?: string;
      startTime?: string;
      endTime?: string;
      notes?: string;
      status?: 'planned' | 'in_progress' | 'completed';
    }
  ): Promise<ChildActivity> {
    await this.waitForInit();

    try {
      // Find the activity to get the childId
      const activity = this.childActivities.find(ca => ca.id === activityId);
      if (!activity) {
        throw new Error('Activity not found');
      }

      const response = await apiClient.put<{ success: boolean; activity: any }>(
        `/api/children/${activity.childId}/activities/${activityId}`,
        updates
      );

      if (response.success && response.activity) {
        // Update local cache
        const index = this.childActivities.findIndex(ca => ca.id === activityId);
        if (index >= 0) {
          this.childActivities[index] = {
            ...this.childActivities[index],
            ...updates,
            scheduledDate: updates.scheduledDate ? new Date(updates.scheduledDate) : this.childActivities[index].scheduledDate,
          };
          await this.saveLocalData();
        }
        return this.childActivities[index];
      }

      throw new Error('Failed to update activity');
    } catch (error) {
      console.error('Error updating child activity:', error);
      // Update local cache anyway for offline support
      const index = this.childActivities.findIndex(ca => ca.id === activityId);
      if (index >= 0) {
        this.childActivities[index] = {
          ...this.childActivities[index],
          ...updates,
          scheduledDate: updates.scheduledDate ? new Date(updates.scheduledDate) : this.childActivities[index].scheduledDate,
        };
        await this.saveLocalData();
        return this.childActivities[index];
      }
      throw error;
    }
  }

  async getMyChildren(): Promise<Child[]> {
    return this.getChildren();
  }

  async getSharedChildren(): Promise<SharedChild[]> {
    try {
      const response = await apiClient.get<any>('/api/children/shared-with-me');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching shared children:', error);
      return [];
    }
  }

  // Calendar-specific methods
  async getScheduledActivities(
    startDate: Date,
    endDate: Date,
    childIds?: string[]
  ): Promise<ChildActivity[]> {
    await this.waitForInit();

    try {
      // Fetch from API with date range filter
      const params = new URLSearchParams();
      params.append('startDate', startDate.toISOString());
      params.append('endDate', endDate.toISOString());

      const response = await apiClient.get<{ success: boolean; activities: any[] }>(`/api/children/activities/all?${params.toString()}`);

      if (response?.success && Array.isArray(response.activities)) {
        const activities: ChildActivity[] = safeMap(response.activities, (ca: any) => ({
          id: safeString(ca?.id, ''),
          childId: safeString(ca?.childId, ''),
          activityId: safeString(ca?.activityId, ''),
          status: ca?.status || 'planned',
          addedAt: safeParseDate(ca?.createdAt) || new Date(),
          startedAt: safeParseDate(ca?.registeredAt) || undefined,
          completedAt: safeParseDate(ca?.completedAt) || undefined,
          scheduledDate: safeParseDate(ca?.scheduledDate) || undefined,
          startTime: ca?.startTime,
          endTime: ca?.endTime,
          notes: ca?.notes,
          activity: ca?.activity, // Include full activity object from API
        }));

        // Filter by childIds if provided
        const filteredActivities = childIds && childIds.length > 0
          ? activities.filter(ca => childIds.includes(ca.childId))
          : activities;

        // Sort by scheduled date
        return filteredActivities.sort((a, b) => {
          const dateA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
          const dateB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
          return dateA - dateB;
        });
      }

      return [];
    } catch (error) {
      console.error('Error fetching scheduled activities from API:', error);

      // Fallback to local cache
      let activities = this.childActivities.filter(ca => {
        if (!ca.scheduledDate) return false;
        const activityDate = new Date(ca.scheduledDate);
        return activityDate >= startDate && activityDate <= endDate;
      });

      if (childIds && childIds.length > 0) {
        activities = activities.filter(ca => childIds.includes(ca.childId));
      }

      return activities.sort((a, b) => {
        const dateA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
        const dateB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
        return dateA - dateB;
      });
    }
  }

  async updateActivitySchedule(
    childActivityId: string,
    scheduledDate: Date,
    startTime?: string,
    endTime?: string,
    recurring?: boolean,
    recurrencePattern?: ChildActivity['recurrencePattern'],
    recurrenceEnd?: Date
  ): Promise<ChildActivity | null> {
    await this.waitForInit();

    const index = this.childActivities.findIndex(ca => ca.id === childActivityId);
    if (index === -1) return null;

    const activity = this.childActivities[index];
    activity.scheduledDate = scheduledDate;
    activity.startTime = startTime;
    activity.endTime = endTime;
    activity.recurring = recurring;
    activity.recurrencePattern = recurrencePattern;
    activity.recurrenceEnd = recurrenceEnd;

    await this.saveLocalData();
    return activity;
  }

  async getRecurringActivities(childId?: string): Promise<ChildActivity[]> {
    await this.waitForInit();

    let activities = this.childActivities.filter(ca => ca.recurring === true);

    if (childId) {
      activities = activities.filter(ca => ca.childId === childId);
    }

    return activities;
  }

  async generateRecurringInstances(
    activity: ChildActivity,
    startDate: Date,
    endDate: Date
  ): Promise<ChildActivity[]> {
    if (!activity.recurring || !activity.scheduledDate || !activity.recurrencePattern) {
      return [];
    }

    const instances: ChildActivity[] = [];
    const baseDate = new Date(activity.scheduledDate);
    let currentDate = new Date(baseDate);
    const recurrenceEndDate = activity.recurrenceEnd ? new Date(activity.recurrenceEnd) : endDate;
    const actualEndDate = recurrenceEndDate < endDate ? recurrenceEndDate : endDate;

    while (currentDate <= actualEndDate) {
      if (currentDate >= startDate) {
        instances.push({
          ...activity,
          id: `${activity.id}_${currentDate.getTime()}`,
          scheduledDate: new Date(currentDate),
        });
      }

      // Move to next occurrence
      switch (activity.recurrencePattern) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'biweekly':
          currentDate.setDate(currentDate.getDate() + 14);
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
      }
    }

    return instances;
  }

  /**
   * Get scheduled activities for shared children (children shared with the user by other parents)
   * This fetches activities from the /api/shared-activities/calendar endpoint
   */
  async getSharedChildrenActivities(
    startDate: Date,
    endDate: Date,
    childIds?: string[]
  ): Promise<{ childId: string; childName: string; sharedBy?: string; activities: ChildActivity[] }[]> {
    try {
      const params = new URLSearchParams();
      params.append('startDate', startDate.toISOString());
      params.append('endDate', endDate.toISOString());
      if (childIds && childIds.length > 0) {
        params.append('childIds', childIds.join(','));
      }

      const response = await apiClient.get<{
        success: boolean;
        calendar: Record<string, any[]>;
        children: { id: string; name: string; avatarUrl?: string }[];
      }>(`/api/shared-activities/calendar?${params.toString()}`);

      if (!response.success) {
        console.warn('[getSharedChildrenActivities] API returned unsuccessful response');
        return [];
      }

      // Group activities by child
      const childActivitiesMap = new Map<string, ChildActivity[]>();
      const childNamesMap = new Map<string, string>();

      // Initialize with children info
      for (const child of response.children || []) {
        childActivitiesMap.set(child.id, []);
        childNamesMap.set(child.id, child.name);
      }

      // Process calendar data (grouped by date)
      for (const [dateKey, activities] of Object.entries(response.calendar || {})) {
        if (dateKey === 'unscheduled') continue;

        for (const item of activities) {
          const childId = item.childId;
          if (!childActivitiesMap.has(childId)) {
            childActivitiesMap.set(childId, []);
            childNamesMap.set(childId, item.childName || 'Unknown Child');
          }

          // Convert to ChildActivity format
          const childActivity: ChildActivity = {
            id: item.childActivity?.id || `shared-${childId}-${item.activity.id}`,
            childId: childId,
            activityId: item.activity.id,
            status: item.childActivity?.status || 'planned',
            addedAt: new Date(),
            scheduledDate: item.activity.dateStart ? new Date(item.activity.dateStart) : undefined,
            startTime: item.activity.schedule?.startTime,
            endTime: item.activity.schedule?.endTime,
            notes: item.childActivity?.notes,
            activity: {
              id: item.activity.id,
              name: item.activity.name,
              category: item.activity.category,
              description: item.activity.description,
              location: item.activity.location,
              dateRange: item.activity.dateStart && item.activity.dateEnd ? {
                start: item.activity.dateStart,
                end: item.activity.dateEnd,
              } : undefined,
              sessions: item.activity.schedule ? [{
                dayOfWeek: item.activity.schedule.dayOfWeek,
                startTime: item.activity.schedule.startTime,
                endTime: item.activity.schedule.endTime,
              }] : undefined,
              cost: item.activity.cost,
            } as any,
          };

          childActivitiesMap.get(childId)?.push(childActivity);
        }
      }

      // Convert to array format
      const result = Array.from(childActivitiesMap.entries()).map(([childId, activities]) => ({
        childId,
        childName: childNamesMap.get(childId) || 'Unknown Child',
        activities,
      }));

      console.log('[getSharedChildrenActivities] Fetched activities for', result.length, 'shared children');
      return result;
    } catch (error: any) {
      // 404 is expected if user has no shared children
      if (error?.response?.status !== 404) {
        console.error('[getSharedChildrenActivities] Error:', error);
      }
      return [];
    }
  }
}

export default ChildrenService.getInstance();