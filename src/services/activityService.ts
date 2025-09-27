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
  
  /**
   * Get global filter parameters from user preferences
   */
  private getGlobalFilterParams(): any {
    const PreferencesService = require('./preferencesService').default;
    const preferencesService = PreferencesService.getInstance();
    const preferences = preferencesService.getPreferences();

    const params: any = {};

    // Apply the global hideClosedOrFull preference
    if (preferences.hideClosedOrFull) {
      params.hideClosedOrFull = true;
    }

    // Legacy individual preferences (kept for backward compatibility)
    if (preferences.hideClosedActivities) {
      params.hideClosedActivities = true;
    }
    if (preferences.hideFullActivities) {
      params.hideFullActivities = true;
    }
    return params;
  }

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

      // Get global filters from preferences
      const globalFilters = this.getGlobalFilterParams();
      const params: any = { ...globalFilters };

      // Convert filter to API params - match backend parameter names
      if (filters.ageRange) {
        params.ageMin = filters.ageRange.min;
        params.ageMax = filters.ageRange.max;
      }
      if (filters.maxCost !== undefined) {
        params.costMax = filters.maxCost;
      }
      if (filters.activityTypes && filters.activityTypes.length > 0) {
        params.categories = filters.activityTypes.join(','); // Send as comma-separated list for backend 'categories' parameter
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
      if (filters.locationId) {
        params.locationId = filters.locationId; // Direct location ID for exact matching
      } else if (filters.locations && filters.locations.length > 0) {
        // Send locations as individual query parameters (locations[]=id1&locations[]=id2)
        // This is the standard way to send arrays in HTTP query parameters
        params.locations = filters.locations;
      }
      if (filters.search) {
        params.search = filters.search; // Backend expects 'search' not 'q'
      }
      
      // Add closed activities filter if specified - use backend parameter name
      if (filters.hideClosedActivities === true) {
        params.hideClosedActivities = true;
      }
      
      // Add full activities filter if specified - use backend parameter name
      if (filters.hideFullActivities === true) {
        params.hideFullActivities = true;
      }
      
      // Add date filters for API-level filtering - use camelCase for backend
      if (filters.createdAfter) {
        params.createdAfter = filters.createdAfter;
      }
      if (filters.updatedAfter) {
        params.updatedAfter = filters.updatedAfter;
      }
      if (filters.startDateAfter) {
        params.startDate = filters.startDateAfter; // Backend expects startDate
      }
      if (filters.startDateBefore) {
        params.endDate = filters.startDateBefore; // Backend expects endDate
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
        // Keep the activityType object from the API response as-is
        // activityType is already an object with id, name, code, etc.
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
        // Use normalized location structure
        location: activity.location?.name || activity.locationName || 'Unknown',
        locationAddress: activity.location?.fullAddress || activity.fullAddress || null,
        locationCity: activity.location?.city?.name || null,
        mapUrl: activity.location?.mapUrl || null,
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

      // Merge with global filters from preferences
      const globalFilters = this.getGlobalFilterParams();
      
      // Convert parameters to match backend API - merge with global filters
      const apiParams = { ...params, ...globalFilters };
      
      // Ensure activitySubtype is a string, not an object
      if (params.activitySubtype && typeof params.activitySubtype === 'object') {
        // If it's an object with a name property, use that
        apiParams.activitySubtype = (params.activitySubtype as any).name || '';
      }
      
      // Keep daysOfWeek as array - backend handles arrays
      if (params.daysOfWeek && Array.isArray(params.daysOfWeek)) {
        apiParams.dayOfWeek = params.daysOfWeek; // Backend expects dayOfWeek
        delete apiParams.daysOfWeek;
      }
      
      // Convert date filters to match backend (camelCase)
      if (params.startDateAfter) {
        apiParams.startDate = params.startDateAfter; // Backend expects startDate
        delete apiParams.startDateAfter;
      }
      
      if (params.startDateBefore) {
        apiParams.endDate = params.startDateBefore; // Backend expects endDate
        delete apiParams.startDateBefore;
      }
      
      // Pass hide filters directly to backend (backend now supports these)
      if (params.hideClosedActivities) {
        apiParams.hideClosedActivities = true;
      }
      
      if (params.hideFullActivities) {
        apiParams.hideFullActivities = true;
      }
      
      // Convert age range filter
      if (params.ageRange) {
        apiParams.ageMin = params.ageRange.min;
        apiParams.ageMax = params.ageRange.max;
        delete apiParams.ageRange;
      }
      
      // Convert cost filters
      // Handle both maxCost and costMax parameter names
      if (params.maxCost !== undefined) {
        apiParams.costMax = params.maxCost;
        delete apiParams.maxCost;
      }
      if (params.minCost !== undefined) {
        apiParams.costMin = params.minCost;
        delete apiParams.minCost;
      }
      
      // Handle locationId - direct location ID for exact matching  
      if (params.locationId) {
        apiParams.locationId = params.locationId;
      } else if (params.locations && Array.isArray(params.locations)) {
        // Handle locations array - convert to comma-separated string for API
        apiParams.locations = params.locations.join(',');
      }
      
      // Handle activityTypes array - convert to comma-separated string for API
      if (params.activityTypes && Array.isArray(params.activityTypes)) {
        apiParams.categories = params.activityTypes.join(',');
        delete apiParams.activityTypes;
      }
      
      console.log('Searching activities with pagination:', apiParams);
      
      const response = await this.api.get(API_CONFIG.ENDPOINTS.ACTIVITIES, { params: apiParams });
      
      if (response.data && response.data.success) {
        const activities = response.data.activities.map((activity: any) => ({
          ...activity,
          // Keep the activityType object from the API response as-is
          // activityType is already an object with id, name, code, etc.
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
      const params = this.getGlobalFilterParams();
      const response = await this.api.get(API_CONFIG.ENDPOINTS.CATEGORIES, { params });
      
      // API returns data field, not categories
      return response.data.success ? response.data.data : [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  }

  async getActivityTypesWithCounts(includeFilters: boolean = true): Promise<Array<{ code: string; name: string; activityCount: number }>> {
    try {
      // Always apply global filters unless explicitly disabled
      const params = includeFilters !== false ? this.getGlobalFilterParams() : {};
      const response = await this.api.get(API_CONFIG.ENDPOINTS.ACTIVITY_TYPES, { params });
      
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
      const url = `/api/v1/cities/${encodeURIComponent(city)}/locations`;
      console.log('Fetching city locations from:', url);
      
      // Add global filters to ensure count consistency
      const globalFilters = this.getGlobalFilterParams();
      const response = await this.api.get(url, { params: globalFilters });
      console.log('City locations response:', response.data);
      
      if (response.data && response.data.success && response.data.data && response.data.data.locations) {
        console.log(`Found ${response.data.data.locations.length} locations for ${city}`);
        return response.data.data.locations;
      } else {
        console.error('Unexpected response structure:', response.data);
        return [];
      }
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
      const params = this.getGlobalFilterParams();
      const response = await this.api.get(`${API_CONFIG.ENDPOINTS.ACTIVITY_TYPES}/${activityTypeCode}`, { params });
      
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
   * Get activities for a specific venue using the dedicated venue endpoint
   */
  async getVenueActivities(venueId: string, params: { limit?: number; offset?: number; hideClosedActivities?: boolean; hideFullActivities?: boolean } = {}): Promise<PaginatedResponse<Activity>> {
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

      // Merge with global filters from preferences
      const globalFilters = this.getGlobalFilterParams();
      const apiParams = { ...params, ...globalFilters };
      
      console.log(`🎯 Calling venue-specific API: /api/v1/locations/${venueId}/activities with params:`, apiParams);
      
      const response = await this.api.get(`/api/v1/locations/${venueId}/activities`, { params: apiParams });
      
      console.log(`📨 Venue API response status:`, response.status);
      console.log(`📨 Venue API response success:`, response.data?.success);
      console.log(`📨 Venue API response activities count:`, response.data?.activities?.length);
      console.log(`📨 Venue API response total:`, response.data?.pagination?.total);
      
      if (response.data && response.data.success) {
        const activities = response.data.activities.map((activity: any) => ({
          ...activity,
          // Keep the activityType object from the API response as-is
          dateRange: activity.dateStart && activity.dateEnd ? {
            start: new Date(activity.dateStart),
            end: new Date(activity.dateEnd),
          } : null,
          ageRange: {
            min: activity.ageMin || 0,
            max: activity.ageMax || 18
          },
          scrapedAt: new Date(activity.updatedAt || activity.createdAt || Date.now()),
          provider: activity.provider?.name || 'Unknown',
          isFavorite: activity._count?.favorites > 0 || false,
          cost: activity.cost || 0,
          location: activity.location?.name || activity.locationName || 'Unknown',
          // Include all enhanced fields
          registrationStatus: activity.registrationStatus,
          registrationButtonText: activity.registrationButtonText,
          detailUrl: activity.detailUrl,
          fullDescription: activity.fullDescription,
          instructor: activity.instructor,
          prerequisites: activity.prerequisites,
          whatToBring: activity.whatToBring,
          fullAddress: activity.location?.fullAddress || activity.fullAddress,
          latitude: activity.location?.latitude || activity.latitude,
          longitude: activity.location?.longitude || activity.longitude,
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
        
        console.log(`✅ Venue API returned ${activities.length} activities out of ${total} total`);
        
        return {
          items: activities,
          total: total,
          limit: limit,
          offset: params.offset || 0,
          hasMore: currentPage < totalPages,
          pages: totalPages
        };
      }
      
      throw new Error('Invalid response format');
    } catch (error: any) {
      console.error('Error fetching venue activities:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch venue activities');
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