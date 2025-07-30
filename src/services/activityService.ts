import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Activity, Filter } from '../types';
import { API_CONFIG } from '../config/api';

class ActivityService {
  private static instance: ActivityService;
  private api: AxiosInstance;
  private userId: string | null = null;

  private constructor() {
    this.api = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request/response interceptors for debugging
    this.api.interceptors.request.use(
      (config) => {
        console.log('API Request:', config.method?.toUpperCase(), config.url);
        return config;
      },
      (error) => {
        console.error('API Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.api.interceptors.response.use(
      (response) => {
        console.log('API Response:', response.status, response.config.url);
        return response;
      },
      (error) => {
        console.error('API Response Error:', error.message);
        if (error.response) {
          console.error('Response data:', error.response.data);
          console.error('Response status:', error.response.status);
        } else if (error.request) {
          console.error('No response received:', error.request._url);
        }
        return Promise.reject(error);
      }
    );

    // Initialize user
    this.initializeUser();
  }

  static getInstance(): ActivityService {
    if (!ActivityService.instance) {
      ActivityService.instance = new ActivityService();
    }
    return ActivityService.instance;
  }

  /**
   * Initialize or get user
   */
  private async initializeUser() {
    try {
      // Check if user exists in AsyncStorage
      let userId = await AsyncStorage.getItem('userId');
      let userEmail = await AsyncStorage.getItem('userEmail');

      if (!userId || !userEmail) {
        // Create a new user with a unique email
        userEmail = `user_${Date.now()}@app.local`;
        
        const response = await this.api.post(API_CONFIG.ENDPOINTS.USERS, {
          email: userEmail,
          name: 'App User',
          preferences: {
            ageRange: { min: 0, max: 18 },
            preferredCategories: [],
            maxCost: 1000
          }
        });

        userId = response.data.user.id;
        
        // Save to AsyncStorage
        await AsyncStorage.setItem('userId', userId);
        await AsyncStorage.setItem('userEmail', userEmail);
      }

      this.userId = userId;
    } catch (error) {
      console.error('Error initializing user:', error);
    }
  }

  /**
   * Get current user ID
   */
  getUserId(): string | null {
    return this.userId;
  }

  /**
   * Search activities with filters
   */
  async searchActivities(filters: Filter = {}): Promise<Activity[]> {
    try {
      const params: any = {};

      // Convert filter to API params
      if (filters.ageRange) {
        params.age_min = filters.ageRange.min;
        params.age_max = filters.ageRange.max;
      }
      if (filters.maxCost !== undefined) {
        params.cost_max = filters.maxCost;
      }
      if (filters.activityTypes && filters.activityTypes.length > 0) {
        params.categories = filters.activityTypes.join(',');
      }
      if (filters.locations && filters.locations.length > 0) {
        params.locations = filters.locations.join(',');
      }
      if (filters.search) {
        params.q = filters.search;
      }

      console.log('Searching activities with params:', params);

      const response = await this.api.get(API_CONFIG.ENDPOINTS.ACTIVITIES, { params });

      if (response.data.success && response.data.activities) {
        console.log(`Found ${response.data.activities.length} activities`);
        
        // Convert data format for app compatibility
        const activities = response.data.activities.map((activity: any) => ({
          ...activity,
          activityType: [activity.category],
          dateRange: activity.dateStart && activity.dateEnd ? {
            start: new Date(activity.dateStart),
            end: new Date(activity.dateEnd),
          } : null,
          ageRange: {
            min: activity.ageMin,
            max: activity.ageMax
          },
          scrapedAt: new Date(activity.updatedAt || activity.createdAt),
          provider: activity.provider?.name || 'NVRC',
          isFavorite: activity._count?.favorites > 0
        }));

        return activities;
      }

      return [];
    } catch (error: any) {
      console.error('Error searching activities:', error);
      throw new Error(error.response?.data?.message || 'Failed to search activities');
    }
  }

  /**
   * Get all activities (no filters)
   */
  async getAllActivities(): Promise<Activity[]> {
    return this.searchActivities({});
  }

  /**
   * Get activity details
   */
  async getActivityDetails(activityId: string): Promise<Activity | null> {
    try {
      const response = await this.api.get(`${API_CONFIG.ENDPOINTS.ACTIVITY_DETAILS}/${activityId}`);

      if (response.data.success && response.data.activity) {
        const activity = response.data.activity;
        
        return {
          ...activity,
          activityType: [activity.category],
          dateRange: activity.dateStart && activity.dateEnd ? {
            start: new Date(activity.dateStart),
            end: new Date(activity.dateEnd),
          } : null,
          ageRange: {
            min: activity.ageMin,
            max: activity.ageMax
          },
          scrapedAt: new Date(activity.updatedAt || activity.createdAt),
          provider: activity.provider?.name || 'NVRC',
          isFavorite: activity.favorites?.some((f: any) => f.userId === this.userId)
        };
      }

      return null;
    } catch (error: any) {
      console.error('Error fetching activity details:', error);
      return null;
    }
  }

  /**
   * Get user's favorite activities
   */
  async getFavorites(): Promise<Activity[]> {
    if (!this.userId) {
      console.warn('No user ID available');
      return [];
    }

    try {
      const response = await this.api.get(API_CONFIG.ENDPOINTS.USER_FAVORITES.replace(':userId', this.userId));

      if (response.data.success && response.data.favorites) {
        return response.data.favorites.map((fav: any) => ({
          ...fav.activity,
          activityType: [fav.activity.category],
          dateRange: fav.activity.dateStart && fav.activity.dateEnd ? {
            start: new Date(fav.activity.dateStart),
            end: new Date(fav.activity.dateEnd),
          } : null,
          ageRange: {
            min: fav.activity.ageMin,
            max: fav.activity.ageMax
          },
          scrapedAt: new Date(fav.activity.updatedAt || fav.activity.createdAt),
          provider: fav.activity.provider?.name || 'NVRC',
          isFavorite: true,
          favoriteNotes: fav.notes
        }));
      }

      return [];
    } catch (error: any) {
      console.error('Error fetching favorites:', error);
      return [];
    }
  }

  /**
   * Add activity to favorites
   */
  async addFavorite(activityId: string, notes?: string): Promise<boolean> {
    if (!this.userId) {
      console.error('No user ID available');
      return false;
    }

    try {
      await this.api.post(API_CONFIG.ENDPOINTS.FAVORITES, {
        userId: this.userId,
        activityId,
        notes
      });

      return true;
    } catch (error: any) {
      console.error('Error adding favorite:', error);
      return false;
    }
  }

  /**
   * Remove activity from favorites
   */
  async removeFavorite(activityId: string): Promise<boolean> {
    if (!this.userId) {
      console.error('No user ID available');
      return false;
    }

    try {
      await this.api.delete(`${API_CONFIG.ENDPOINTS.FAVORITES}/${this.userId}/${activityId}`);
      return true;
    } catch (error: any) {
      console.error('Error removing favorite:', error);
      return false;
    }
  }

  /**
   * Get recommended activities
   */
  async getRecommendations(limit: number = 10): Promise<Activity[]> {
    if (!this.userId) {
      // Return popular activities if no user
      return this.searchActivities({ limit });
    }

    try {
      const endpoint = API_CONFIG.ENDPOINTS.RECOMMENDATIONS
        .replace(':userId', this.userId);
      
      const response = await this.api.get(endpoint, {
        params: { limit }
      });

      if (response.data.success && response.data.recommendations) {
        return response.data.recommendations.map((activity: any) => ({
          ...activity,
          activityType: [activity.category],
          dateRange: activity.dateStart && activity.dateEnd ? {
            start: new Date(activity.dateStart),
            end: new Date(activity.dateEnd),
          } : null,
          ageRange: {
            min: activity.ageMin,
            max: activity.ageMax
          },
          scrapedAt: new Date(activity.updatedAt || activity.createdAt),
          provider: activity.provider?.name || 'NVRC',
          isRecommended: true
        }));
      }

      return [];
    } catch (error: any) {
      console.error('Error fetching recommendations:', error);
      return [];
    }
  }

  /**
   * Get reference data
   */
  async getCategories(): Promise<string[]> {
    try {
      const response = await this.api.get(API_CONFIG.ENDPOINTS.CATEGORIES);
      
      return response.data.success ? response.data.categories : [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  }

  async getLocations(): Promise<any[]> {
    try {
      const response = await this.api.get(API_CONFIG.ENDPOINTS.LOCATIONS);
      
      return response.data.success ? response.data.locations : [];
    } catch (error) {
      console.error('Error fetching locations:', error);
      return [];
    }
  }

  async getProviders(): Promise<any[]> {
    try {
      const response = await this.api.get(API_CONFIG.ENDPOINTS.PROVIDERS);
      
      return response.data.success ? response.data.providers : [];
    } catch (error) {
      console.error('Error fetching providers:', error);
      return [];
    }
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<any> {
    try {
      const response = await this.api.get(API_CONFIG.ENDPOINTS.ACTIVITY_STATS);
      
      return response.data.success ? response.data.stats : null;
    } catch (error) {
      console.error('Error fetching statistics:', error);
      return null;
    }
  }
}

export default ActivityService;