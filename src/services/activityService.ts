import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { Activity, Filter } from '../types';
import { API_CONFIG } from '../config/api';
import { PaginatedResponse, ActivitySearchParams } from '../types/api';

class ActivityService {
  private static instance: ActivityService;
  private api: AxiosInstance;

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

    // Add request/response interceptors for debugging and auth
    this.api.interceptors.request.use(
      async (config) => {
        // Add auth token from secure storage
        try {
          const token = await AsyncStorage.getItem('@auth_access_token');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error('Error getting auth token:', error);
        }
        
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

    // Authentication is handled by authService and Redux store
  }

  static getInstance(): ActivityService {
    if (!ActivityService.instance) {
      ActivityService.instance = new ActivityService();
    }
    return ActivityService.instance;
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

      // Convert filter to API params - match backend parameter names
      if (filters.ageRange) {
        params.ageMin = filters.ageRange.min;
        params.ageMax = filters.ageRange.max;
      }
      if (filters.maxCost !== undefined) {
        params.costMax = filters.maxCost;
      }
      if (filters.activityTypes && filters.activityTypes.length > 0) {
        params.category = filters.activityTypes[0]; // Backend expects single category
      }
      if (filters.categories) {
        params.category = filters.categories;
      }
      if (filters.locations && filters.locations.length > 0) {
        params.location = filters.locations[0]; // Backend expects single location
      }
      if (filters.search) {
        params.search = filters.search; // Backend expects 'search' not 'q'
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
        location: activity.location || 'Unknown',
        // Include all enhanced fields
        registrationStatus: activity.registrationStatus,
        registrationButtonText: activity.registrationButtonText,
        detailUrl: activity.detailUrl,
        fullDescription: activity.fullDescription,
        instructor: activity.instructor,
        prerequisites: activity.prerequisites,
        whatToBring: activity.whatToBring,
        fullAddress: activity.fullAddress,
        latitude: activity.latitude,
        longitude: activity.longitude,
        directRegistrationUrl: activity.directRegistrationUrl,
        contactInfo: activity.contactInfo,
        totalSpots: activity.totalSpots
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
   * Search activities with pagination support
   */
  async searchActivitiesPaginated(params: ActivitySearchParams): Promise<PaginatedResponse<Activity>> {
    try {
      const isConnected = await this.checkConnectivity();
      if (!isConnected) {
        return {
          items: [],
          total: 0,
          limit: params.limit || 50,
          offset: params.offset || 0,
          hasMore: false,
          pages: 0
        };
      }

      console.log('Searching activities with pagination:', params);
      
      const response = await this.api.get(API_CONFIG.ENDPOINTS.ACTIVITIES, { params });
      
      if (response.data && response.data.success) {
        const activities = response.data.activities.map((activity: any) => ({
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
          location: activity.location || 'Unknown',
          // Include all enhanced fields
          registrationStatus: activity.registrationStatus,
          registrationButtonText: activity.registrationButtonText,
          detailUrl: activity.detailUrl,
          fullDescription: activity.fullDescription,
          instructor: activity.instructor,
          prerequisites: activity.prerequisites,
          whatToBring: activity.whatToBring,
          fullAddress: activity.fullAddress,
          latitude: activity.latitude,
          longitude: activity.longitude,
          directRegistrationUrl: activity.directRegistrationUrl,
          contactInfo: activity.contactInfo,
          totalSpots: activity.totalSpots
        }));
        
        return {
          items: activities,
          total: response.data.total || activities.length,
          limit: response.data.pagination?.limit || params.limit || 50,
          offset: response.data.pagination?.offset || params.offset || 0,
          hasMore: response.data.hasMore || false,
          pages: response.data.pagination?.pages || 1
        };
      }
      
      throw new Error('Invalid response format');
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
          isFavorite: activity._count?.favorites > 0 || false
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
    try {
      // Use the correct backend endpoint /api/favorites
      const response = await this.api.get(API_CONFIG.ENDPOINTS.FAVORITES);

      if (response.data.success && response.data.favorites) {
        return response.data.favorites.map((fav: any) => ({
          ...fav.activity,
          activityType: [fav.activity.category || 'Other'],
          dateRange: fav.activity.dateStart && fav.activity.dateEnd ? {
            start: new Date(fav.activity.dateStart),
            end: new Date(fav.activity.dateEnd),
          } : null,
          ageRange: {
            min: fav.activity.ageMin || 0,
            max: fav.activity.ageMax || 18
          },
          scrapedAt: new Date(fav.activity.updatedAt || fav.activity.createdAt || Date.now()),
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
    try {
      // Backend expects only activityId in body, uses authenticated user context
      await this.api.post(API_CONFIG.ENDPOINTS.FAVORITES, {
        activityId
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
    try {
      // Backend expects /api/favorites/:activityId format
      await this.api.delete(`${API_CONFIG.ENDPOINTS.FAVORITES}/${activityId}`);
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
    // Since recommendations endpoint doesn't exist yet, return popular activities
    // TODO: Implement proper recommendations when backend endpoint is available
    try {
      const response = await this.searchActivities({ 
        limit,
        sortBy: 'registeredCount',
        sortOrder: 'desc'
      });
      
      return response.map((activity: any) => ({
        ...activity,
        isRecommended: true
      }));
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