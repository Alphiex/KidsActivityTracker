import apiClient from './apiClient';
import { Child } from '../store/slices/childrenSlice';
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

class ChildrenService {
  private static instance: ChildrenService;

  private constructor() {}

  static getInstance(): ChildrenService {
    if (!ChildrenService.instance) {
      ChildrenService.instance = new ChildrenService();
    }
    return ChildrenService.instance;
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
}

export default ChildrenService.getInstance();