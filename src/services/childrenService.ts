import apiClient from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Child as StoreChild } from '../store/slices/childrenSlice';

export type Child = StoreChild;
import { Activity } from '../types';

interface ChildFormData {
  name: string;
  dateOfBirth: string;
  interests?: string[];
  avatar?: string;
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
      const response = await apiClient.get<Child[]>('/children');
      return response;
    } catch (error) {
      console.error('Error fetching children:', error);
      throw error;
    }
  }

  async getChild(id: string): Promise<Child> {
    try {
      const response = await apiClient.get<Child>(`/children/${id}`);
      return response;
    } catch (error) {
      console.error('Error fetching child:', error);
      throw error;
    }
  }

  async createChild(childData: ChildFormData): Promise<Child> {
    try {
      const response = await apiClient.post<Child>('/children', childData);
      return response;
    } catch (error) {
      console.error('Error creating child:', error);
      throw error;
    }
  }

  async updateChild(id: string, childData: Partial<ChildFormData>): Promise<Child> {
    try {
      const response = await apiClient.patch<Child>(`/children/${id}`, childData);
      return response;
    } catch (error) {
      console.error('Error updating child:', error);
      throw error;
    }
  }

  async deleteChild(id: string): Promise<void> {
    try {
      await apiClient.delete(`/children/${id}`);
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
  calculateAge(dateOfBirth: string): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
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
    await this.waitForInit();

    const newActivity: ChildActivity = {
      id: `ca_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      childId,
      activityId,
      status,
      addedAt: new Date(),
      startedAt: status === 'in_progress' ? new Date() : undefined,
      completedAt: status === 'completed' ? new Date() : undefined,
      scheduledDate,
      startTime,
      endTime,
    };

    this.childActivities.push(newActivity);
    await this.saveLocalData();
    return newActivity;
  }

  async updateActivityStatus(
    childActivityId: string, 
    status: ChildActivity['status'],
    notes?: string
  ): Promise<ChildActivity | null> {
    await this.waitForInit();
    
    const index = this.childActivities.findIndex(ca => ca.id === childActivityId);
    if (index === -1) return null;

    const activity = this.childActivities[index];
    activity.status = status;
    
    if (notes !== undefined) {
      activity.notes = notes;
    }

    // Update timestamps based on status
    if (status === 'in_progress' && !activity.startedAt) {
      activity.startedAt = new Date();
    } else if (status === 'completed' && !activity.completedAt) {
      activity.completedAt = new Date();
    }

    await this.saveLocalData();
    return activity;
  }

  async removeActivityFromChild(childActivityId: string): Promise<boolean> {
    await this.waitForInit();
    
    const index = this.childActivities.findIndex(ca => ca.id === childActivityId);
    if (index === -1) return false;

    this.childActivities.splice(index, 1);
    await this.saveLocalData();
    return true;
  }

  async getChildActivitiesList(childId: string, status?: ChildActivity['status']): Promise<ChildActivity[]> {
    await this.waitForInit();
    
    let activities = this.childActivities.filter(ca => ca.childId === childId);
    
    if (status) {
      activities = activities.filter(ca => ca.status === status);
    }

    return activities.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());
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
      const response = await apiClient.post('/children/share', {
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
      const response = await apiClient.get(`/children/${childId}/shared`);
      return response.data;
    } catch (error) {
      console.error('Error fetching shared users:', error);
      // Return mock data for development
      return [];
    }
  }

  async revokeChildAccess(childId: string, userId: string): Promise<void> {
    try {
      const response = await apiClient.delete(`/children/${childId}/shared/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error revoking access:', error);
      throw error;
    }
  }

  async getMyChildren(): Promise<Child[]> {
    return this.getChildren();
  }

  async getSharedChildren(): Promise<SharedChild[]> {
    try {
      const response = await apiClient.get('/children/shared-with-me');
      return response.data;
    } catch (error) {
      console.error('Error fetching shared children:', error);
      // Return mock data for development
      const mockData: SharedChild[] = [
        {
          id: 'sc1',
          childId: 'c1',
          ownerId: 'u1',
          ownerEmail: 'parent@example.com',
          ownerName: 'Parent Name',
          sharedWithEmail: 'me@example.com',
          permissions: 'view',
          acceptedAt: new Date(),
          createdAt: new Date(),
        },
      ];
      return mockData;
    }
  }

  // Calendar-specific methods
  async getScheduledActivities(
    startDate: Date,
    endDate: Date,
    childIds?: string[]
  ): Promise<ChildActivity[]> {
    await this.waitForInit();

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
}

export default ChildrenService.getInstance();