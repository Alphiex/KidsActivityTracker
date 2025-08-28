import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { Activity, Filter } from '../types';
import { API_CONFIG } from '../config/api';
import { PaginatedResponse, ActivitySearchParams } from '../types/api';
import * as SecureStore from '../utils/secureStorage';

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
          const token = await SecureStore.getAccessToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (error) {
          console.error('Error getting auth token:', error);
        }
        
        // Only log in development
        if (__DEV__) {
          console.log('API Request:', config.method?.toUpperCase(), config.url);
          console.log('Has auth token:', !!config.headers.Authorization);
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
        params.age_min = filters.ageRange.min;
        params.age_max = filters.ageRange.max;
      }
      if (filters.maxCost !== undefined) {
        params.cost_max = filters.maxCost;
      }
      if (filters.activityTypes && filters.activityTypes.length > 0) {
        params.categories = filters.activityTypes.join(','); // Send as comma-separated list
      }
      if (filters.category) {
        params.category = filters.category; // For age-based categories
      }
      if (filters.categories) {
        params.categories = filters.categories; // Legacy support
      }
      if (filters.subcategory) {
        params.subcategory = filters.subcategory; // For activity type filtering
      }
      if (filters.activityType) {
        params.activityType = filters.activityType;
      }
      if (filters.activitySubtype) {
        params.activitySubtype = filters.activitySubtype;
      }
      if (filters.locations && filters.locations.length > 0) {
        params.location = filters.locations[0]; // Backend expects single location
      }
      if (filters.search) {
        params.search = filters.search; // Backend expects 'search' not 'q'
      }
      
      // Add closed activities filter if specified
      if (filters.hideClosedActivities === true) {
        params.exclude_closed = true;
      }
      
      // Add full activities filter if specified
      if (filters.hideFullActivities === true) {
        params.exclude_full = true;
      }
      
      // Add date filters for API-level filtering
      if (filters.createdAfter) {
        params.created_after = filters.createdAfter;
      }
      if (filters.updatedAfter) {
        params.updated_after = filters.updatedAfter;
      }
      if (filters.startDateAfter) {
        params.start_date_after = filters.startDateAfter;
      }
      if (filters.startDateBefore) {
        params.start_date_before = filters.startDateBefore;
      }
      
      // Add limit - use filter limit or default to 50
      params.limit = filters.limit || 50;

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
        totalSpots: activity.totalSpots,
        // New fields for sessions and prerequisites
        hasMultipleSessions: activity.hasMultipleSessions,
        sessionCount: activity.sessionCount,
        sessions: activity.sessions,
        hasPrerequisites: activity.hasPrerequisites
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

      // Convert parameters to match backend API
      const apiParams = { ...params };
      
      // Convert daysOfWeek array to comma-separated string for API
      if (params.daysOfWeek && Array.isArray(params.daysOfWeek)) {
        apiParams.days_of_week = params.daysOfWeek.join(',');
        delete apiParams.daysOfWeek;
      }
      
      // Convert date filters to match backend
      if (params.startDateAfter) {
        apiParams.start_date_after = params.startDateAfter;
        delete apiParams.startDateAfter;
      }
      
      if (params.startDateBefore) {
        apiParams.start_date_before = params.startDateBefore;
        delete apiParams.startDateBefore;
      }
      
      // Convert hide filters to exclude filters for backend
      if (params.hideClosedActivities) {
        apiParams.exclude_closed = true;
        delete apiParams.hideClosedActivities;
      }
      
      if (params.hideFullActivities) {
        apiParams.exclude_full = true;
        delete apiParams.hideFullActivities;
      }
      
      // Convert age range filter
      if (params.ageRange) {
        apiParams.age_min = params.ageRange.min;
        apiParams.age_max = params.ageRange.max;
        delete apiParams.ageRange;
      }
      
      // Convert cost filters
      if (params.costMin !== undefined) {
        apiParams.cost_min = params.costMin;
        delete apiParams.costMin;
      }
      
      if (params.costMax !== undefined) {
        apiParams.cost_max = params.costMax;
        delete apiParams.costMax;
      }
      
      // Convert maxCost (alternative parameter)
      if (params.maxCost !== undefined) {
        apiParams.cost_max = params.maxCost;
        delete apiParams.maxCost;
      }
      
      console.log('Searching activities with pagination:', apiParams);
      
      const response = await this.api.get(API_CONFIG.ENDPOINTS.ACTIVITIES, { params: apiParams });
      
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
          totalSpots: activity.totalSpots,
          // New fields for sessions and prerequisites
          hasMultipleSessions: activity.hasMultipleSessions,
          sessionCount: activity.sessionCount,
          sessions: activity.sessions,
          hasPrerequisites: activity.hasPrerequisites
        }));
        
        // The backend returns the total in pagination.total
        const total = response.data.pagination?.total || response.data.total || activities.length;
        const currentPage = response.data.pagination?.page || 1;
        const limit = response.data.pagination?.limit || params.limit || 50;
        const totalPages = response.data.pagination?.pages || Math.ceil(total / limit);
        
        return {
          items: activities,
          total: total,  // This is the FULL count regardless of pagination
          limit: limit,
          offset: params.offset || 0,
          hasMore: currentPage < totalPages,
          pages: totalPages
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
          isFavorite: activity._count?.favorites > 0 || false,
          // Include all enhanced fields
          hasMultipleSessions: activity.hasMultipleSessions,
          sessionCount: activity.sessionCount,
          sessions: activity.sessions,
          hasPrerequisites: activity.hasPrerequisites
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
  async getCategories(): Promise<any[]> {
    try {
      const response = await this.api.get(API_CONFIG.ENDPOINTS.CATEGORIES);
      
      // API returns data field, not categories
      return response.data.success ? response.data.data : [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  }

  async getActivityTypesWithCounts(): Promise<Array<{ code: string; name: string; activityCount: number }>> {
    try {
      const response = await this.api.get(API_CONFIG.ENDPOINTS.ACTIVITY_TYPES);
      
      if (response.data && response.data.success) {
        return response.data.data || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching activity types with counts:', error);
      return [];
    }
  }

  async getActivityTypeDetails(typeCode: string): Promise<any> {
    try {
      const response = await this.api.get(`/api/v1/reference/activity-types/${encodeURIComponent(typeCode)}`);
      return response.data.success ? response.data.data : null;
    } catch (error) {
      console.error('Error fetching activity type details:', error);
      return null;
    }
  }

  async getCities(): Promise<any[]> {
    try {
      const response = await this.api.get('/api/v1/cities');
      return response.data.success ? response.data.data : [];
    } catch (error) {
      console.error('Error fetching cities:', error);
      return [];
    }
  }

  async getCityLocations(city: string): Promise<any[]> {
    try {
      const response = await this.api.get(`/api/v1/cities/${encodeURIComponent(city)}/locations`);
      return response.data.success ? response.data.data.locations : [];
    } catch (error) {
      console.error('Error fetching city locations:', error);
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

  /**
   * Get activity type details with subtypes
   */
  async getActivityTypeDetails(activityTypeCode: string): Promise<any> {
    try {
      const response = await this.api.get(`${API_CONFIG.ENDPOINTS.ACTIVITY_TYPES}/${activityTypeCode}`);
      
      if (response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching activity type details:', error);
      throw error;
    }
  }

  /**
   * Get all activity types for preferences
   */
  async getActivityTypes(): Promise<string[]> {
    try {
      const response = await this.api.get('/api/v1/preferences/activity-types');
      
      if (response.data.success) {
        return response.data.activityTypes || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching activity types:', error);
      // Return a default list if the API fails
      return [
        'Swimming & Aquatics',
        'Team Sports',
        'Individual Sports',
        'Racquet Sports',
        'Martial Arts',
        'Dance',
        'Visual Arts',
        'Music',
        'Performing Arts',
        'Skating & Wheels',
        'Gymnastics & Movement',
        'Camps',
        'STEM & Education',
        'Fitness & Wellness',
        'Outdoor & Adventure',
        'Culinary Arts',
        'Language & Culture',
        'Special Needs Programs',
        'Multi-Sport',
        'Life Skills & Leadership',
        'Early Development'
      ];
    }
  }

}

export default ActivityService;