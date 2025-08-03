import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { Activity, Filter } from '../types';
import { API_CONFIG } from '../config/api';

class ActivityService {
  private static instance: ActivityService;
  private api: AxiosInstance;
  private userId: string | null = null;

  private constructor() {
    // Log the API configuration
    console.log('=== ActivityService Configuration ===');
    console.log('API Base URL:', API_CONFIG.BASE_URL);
    console.log('Platform:', Platform.OS);
    console.log('Dev Mode:', __DEV__);
    console.log('=================================');
    
    this.api = axios.create({
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'KidsActivityTracker/1.0',
      },
      // Force JSON parsing
      responseType: 'json',
      // Add additional axios config for better compatibility
      validateStatus: (status) => status < 500,
      transformResponse: [(data) => {
        // Handle cases where data might already be parsed
        if (typeof data === 'string') {
          try {
            return JSON.parse(data);
          } catch (e) {
            console.error('Failed to parse JSON response:', e);
            throw new Error('Invalid JSON response from server');
          }
        }
        return data;
      }],
    });

    // Configure retry logic
    axiosRetry(this.api, {
      retries: 3,
      retryDelay: (retryCount) => {
        return retryCount * 1000; // time interval between retries
      },
      retryCondition: (error) => {
        // Retry on network errors or 5xx errors
        const shouldRetry = axiosRetry.isNetworkOrIdempotentRequestError(error) || 
               (error.response?.status ?? 0) >= 500;
        if (__DEV__ && shouldRetry) {
          console.log(`Retrying request... (attempt ${error.config?.['axios-retry']?.retryCount || 0})`);
        }
        return shouldRetry;
      },
    });

    // Add request/response interceptors for debugging
    this.api.interceptors.request.use(
      (config) => {
        // Only log in development
        if (__DEV__) {
          console.log('API Request:', config.method?.toUpperCase(), config.url);
        }
        return config;
      },
      (error) => {
        if (__DEV__) {
          console.error('API Request Error:', error);
        }
        return Promise.reject(error);
      }
    );

    this.api.interceptors.response.use(
      (response) => {
        if (__DEV__) {
          console.log('API Response:', response.status, response.config.url);
        }
        // Ensure data is properly formatted
        if (response.data && typeof response.data === 'object') {
          return response;
        }
        // If data is a string, try to parse it
        if (typeof response.data === 'string') {
          try {
            response.data = JSON.parse(response.data);
          } catch (e) {
            console.error('Failed to parse response data');
          }
        }
        return response;
      },
      (error) => {
        if (__DEV__) {
          console.error('API Response Error:', error.message);
          console.error('Error code:', error.code);
          console.error('Error config:', error.config?.url);
          if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
          }
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
        
        try {
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
        } catch (error) {
          // If user creation fails, generate a local ID
          console.log('Using local user ID due to API error');
          userId = `local_${Date.now()}`;
          await AsyncStorage.setItem('userId', userId);
          await AsyncStorage.setItem('userEmail', userEmail);
        }
      }

      this.userId = userId;
    } catch (error) {
      console.error('Error initializing user:', error);
      // Set a default local user ID if all else fails
      this.userId = 'local_default';
    }
  }

  /**
   * Get current user ID
   */
  getUserId(): string | null {
    return this.userId;
  }

  /**
   * Check network connectivity
   */
  private async checkConnectivity(): Promise<boolean> {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      console.error('No internet connection detected');
      return false;
    }
    return true;
  }

  /**
   * Search activities with filters
   */
  async searchActivities(filters: Filter = {}): Promise<Activity[]> {
    try {
      // Check network connectivity first
      const isConnected = await this.checkConnectivity();
      if (!isConnected) {
        console.error('No network connection available');
        return [];
      }

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
        params.category = filters.activityTypes.join(',');
      }
      if (filters.categories) {
        params.category = filters.categories;
      }
      if (filters.locations && filters.locations.length > 0) {
        params.locations = filters.locations.join(',');
      }
      if (filters.search) {
        params.q = filters.search;
      }
      
      // Add limit to reduce response size initially
      params.limit = 50;

      console.log('Searching activities with params:', params);

      const response = await this.api.get(API_CONFIG.ENDPOINTS.ACTIVITIES, { params });

      // Handle various response formats
      let activities = [];
      
      if (response.data) {
        if (response.data.success && response.data.activities) {
          activities = response.data.activities;
        } else if (Array.isArray(response.data)) {
          activities = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          activities = response.data.data;
        }
      }
      
      console.log(`Found ${activities.length} activities`);
      
      // Convert data format for app compatibility
      return activities.map((activity: any) => ({
        ...activity,
        activityType: [activity.category || 'Other'],
        dateRange: activity.dateStart && activity.dateEnd ? {
          start: new Date(activity.dateStart),
          end: new Date(activity.dateEnd),
        } : null,
        ageRange: {
          min: activity.ageMin || 0,
          max: activity.ageMax || 18
        },
        scrapedAt: new Date(activity.updatedAt || activity.createdAt || Date.now()),
        provider: activity.provider?.name || 'NVRC',
        isFavorite: activity._count?.favorites > 0 || false,
        cost: activity.cost || 0,
        location: activity.location || 'Unknown'
      }));
    } catch (error: any) {
      console.error('Error searching activities:', error);
      
      // If network error, provide helpful message
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        console.error('Network connectivity issue detected. The iOS Simulator may have network issues.');
        console.error('API URL:', API_CONFIG.BASE_URL);
        // Return empty array instead of throwing to allow app to function
        return [];
      }
      
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