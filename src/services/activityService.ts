import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import DebugLogger from '../utils/debugLogger';
import DiagnosticInterceptor from '../utils/diagnosticInterceptor';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import { Activity, Filter } from '../types';
import { API_CONFIG } from '../config/api';
import { PaginatedResponse, ActivitySearchParams } from '../types/api';
import * as SecureStore from '../utils/secureStorage';
import { locationService } from './locationService';
import { MergedChildFilters } from './childPreferencesService';
import { ChildWithPreferences } from '../store/slices/childrenSlice';

/**
 * Child-based filter parameters that can be passed to search methods
 */
export interface ChildBasedFilterParams {
  selectedChildIds?: string[];
  filterMode?: 'or' | 'and';
  mergedFilters?: MergedChildFilters;
  children?: ChildWithPreferences[];  // Pass children for per-child location search
  usePerChildLocation?: boolean;       // Enable per-child location search when children are in different cities
}

/**
 * Result from searching for a single child's location
 */
interface PerChildSearchResult {
  activities: Activity[];
  childId: string;
}

/**
 * Sort activities with sponsored activities at the top, ordered by tier (gold > silver > bronze)
 * Non-sponsored activities maintain their original relative order
 */
function sortWithSponsoredFirst(activities: Activity[]): Activity[] {
  const tierOrder: Record<string, number> = { gold: 0, silver: 1, bronze: 2 };

  return [...activities].sort((a, b) => {
    // Sponsored activities come first
    const aSponsored = a.isFeatured ? 1 : 0;
    const bSponsored = b.isFeatured ? 1 : 0;

    if (aSponsored !== bSponsored) {
      return bSponsored - aSponsored; // Sponsored first
    }

    // If both are sponsored, sort by tier
    if (a.isFeatured && b.isFeatured) {
      const aTier = (a.featuredTier?.toLowerCase() || 'bronze');
      const bTier = (b.featuredTier?.toLowerCase() || 'bronze');
      return (tierOrder[aTier] ?? 3) - (tierOrder[bTier] ?? 3);
    }

    // Non-sponsored activities maintain original order
    return 0;
  });
}

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

    DebugLogger.pref('ActivityService.getGlobalFilterParams', 'Loading preferences', {
      hideClosedOrFull: preferences.hideClosedOrFull,
      hideClosedActivities: preferences.hideClosedActivities,
      hideFullActivities: preferences.hideFullActivities,
      dateFilter: preferences.dateFilter,
      dateRange: preferences.dateRange,
      dateMatchMode: preferences.dateMatchMode,
      preferencesLoaded: !!preferences
    });

    console.log('🔍 [ActivityService] Getting global filter params:', {
      hideClosedOrFull: preferences.hideClosedOrFull,
      hideClosedActivities: preferences.hideClosedActivities,
      hideFullActivities: preferences.hideFullActivities,
      dateFilter: preferences.dateFilter,
      dateRange: preferences.dateRange,
      dateMatchMode: preferences.dateMatchMode,
      preferencesLoaded: !!preferences
    });

    const params: any = {};

    // Apply the global hideClosedOrFull preference
    // The backend DOES support hideClosedOrFull directly!
    // IMPORTANT: Always send the parameter explicitly, even when false
    params.hideClosedOrFull = preferences.hideClosedOrFull || false;

    // Also apply individual preferences (kept for backward compatibility)
    if (preferences.hideClosedActivities) {
      params.hideClosedActivities = true;
    }
    if (preferences.hideFullActivities) {
      params.hideFullActivities = true;
    }

    // Apply date range filter from preferences (only if dateFilter is 'range')
    if (preferences.dateFilter === 'range' && preferences.dateRange?.start) {
      params.startDate = preferences.dateRange.start;
      if (preferences.dateRange.end) {
        params.endDate = preferences.dateRange.end;
      }
      // Always send dateMatchMode when date range is enabled
      params.dateMatchMode = preferences.dateMatchMode || 'partial';
    }

    console.log('🔍 [ActivityService] Global filter params to send:', params);
    DebugLogger.pref('ActivityService.getGlobalFilterParams', 'Final params to send', params);
    return params;
  }

  /**
   * Get distance filter parameters asynchronously
   * Returns userLat, userLon, radiusKm if distance filtering is enabled and location is available
   */
  private async getDistanceParams(): Promise<{ userLat?: number; userLon?: number; radiusKm?: number }> {
    try {
      const distanceParams = await locationService.getDistanceFilterParams();
      if (distanceParams.userLat && distanceParams.userLon && distanceParams.radiusKm) {
        console.log('📍 [ActivityService] Distance params:', distanceParams);
        return distanceParams;
      }
    } catch (error) {
      console.warn('[ActivityService] Error getting distance params:', error);
    }
    return {};
  }

  /**
   * Get GPS location as fallback when no child location is available
   * This is Priority 3 in the location fallback chain
   */
  private async getGPSLocationFallback(): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const coords = await locationService.getCurrentLocation();
      if (coords && coords.latitude && coords.longitude) {
        return coords;
      }
    } catch (error) {
      console.warn('[ActivityService] GPS fallback failed:', error);
    }
    return null;
  }

  /**
   * Check if children are in different cities AND have valid coordinates
   * (requiring per-child location search)
   */
  private areChildrenInDifferentCities(children: ChildWithPreferences[]): boolean {
    const cityCoordMap = new Map<string, boolean>(); // city -> has coordinates

    for (const child of children) {
      const savedAddress = child.preferences?.savedAddress;
      // Handle savedAddress that might be a JSON string
      let addr = savedAddress;
      if (typeof savedAddress === 'string') {
        try {
          addr = JSON.parse(savedAddress);
        } catch (e) { /* ignore */ }
      }

      const city = (addr as any)?.city;
      const hasCoords = !!(addr as any)?.latitude && !!(addr as any)?.longitude;

      // Only count cities that have coordinates (needed for per-child search)
      if (city && hasCoords) {
        cityCoordMap.set(city.toLowerCase().trim(), true);
      }
    }

    // More than one unique city with coordinates means children are in different locations
    return cityCoordMap.size > 1;
  }

  /**
   * Search for activities near each child's location with their individual preferences.
   * Used when children are in different locations.
   */
  async searchActivitiesPerChild(
    children: ChildWithPreferences[],
    baseParams: any,
    defaultRadiusKm: number = 25
  ): Promise<{ activities: Activity[]; activityChildMap: Map<string, string[]> }> {
    // Filter to children with valid locations
    const childrenWithLocations = children.filter(child => {
      const savedAddress = child.preferences?.savedAddress;
      let addr = savedAddress;
      if (typeof savedAddress === 'string') {
        try {
          addr = JSON.parse(savedAddress);
        } catch (e) { /* ignore */ }
      }
      return (addr as any)?.latitude && (addr as any)?.longitude;
    });

    if (childrenWithLocations.length === 0) {
      console.log('📍 [PerChildSearch] No children with valid locations');
      return { activities: [], activityChildMap: new Map() };
    }

    console.log(`📍 [PerChildSearch] Searching for ${childrenWithLocations.length} children with locations`);

    // Make parallel API calls for each child
    const searchPromises = childrenWithLocations.map(child =>
      this.searchForSingleChild(child, baseParams, defaultRadiusKm)
    );

    const results = await Promise.all(searchPromises);

    // Merge activities and track which children they match
    const activityChildMap = new Map<string, string[]>();
    const allActivities: Activity[] = [];
    const seenIds = new Set<string>();

    results.forEach(({ activities, childId }) => {
      console.log(`📍 [PerChildSearch] Child ${childId}: ${activities.length} activities found`);
      activities.forEach(activity => {
        if (!seenIds.has(activity.id)) {
          seenIds.add(activity.id);
          allActivities.push(activity);
          activityChildMap.set(activity.id, []);
        }
        activityChildMap.get(activity.id)!.push(childId);
      });
    });

    // Tag activities with matchingChildIds
    const taggedActivities = allActivities.map(activity => ({
      ...activity,
      matchingChildIds: activityChildMap.get(activity.id) || [],
    }));

    console.log(`📍 [PerChildSearch] Total: ${taggedActivities.length} unique activities from ${childrenWithLocations.length} locations`);

    return { activities: taggedActivities, activityChildMap };
  }

  /**
   * Search for activities near a single child's location with their preferences
   */
  private async searchForSingleChild(
    child: ChildWithPreferences,
    baseParams: any,
    defaultRadiusKm: number
  ): Promise<PerChildSearchResult> {
    // Get saved address (handle JSON string)
    let savedAddress = child.preferences?.savedAddress;
    if (typeof savedAddress === 'string') {
      try {
        savedAddress = JSON.parse(savedAddress);
      } catch (e) { /* ignore */ }
    }

    const addr = savedAddress as any;
    if (!addr?.latitude || !addr?.longitude) {
      return { activities: [], childId: child.id };
    }

    // Calculate child's age
    const birthDate = new Date(child.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Build search params with THIS child's location and preferences
    const params: any = {
      ...baseParams,
      userLat: addr.latitude,
      userLon: addr.longitude,
      radiusKm: child.preferences?.distanceRadiusKm || defaultRadiusKm,
      ageMin: Math.max(0, age - 1),
      ageMax: age + 1,
    };

    // Add child's preferred activity types (if set)
    if (child.preferences?.preferredActivityTypes?.length) {
      params.categories = child.preferences.preferredActivityTypes.join(',');
    }

    // Add child's days of week (if set)
    if (child.preferences?.daysOfWeek?.length) {
      params.dayOfWeek = child.preferences.daysOfWeek;
    }

    // Add child's price range (if set)
    if (child.preferences?.priceRangeMin !== undefined) {
      params.costMin = child.preferences.priceRangeMin;
    }
    if (child.preferences?.priceRangeMax !== undefined && child.preferences.priceRangeMax < 999999) {
      params.costMax = child.preferences.priceRangeMax;
    }

    console.log(`📍 [PerChildSearch] Searching for ${child.name} (age ${age}) near ${addr.city || 'unknown city'}`);

    try {
      // Make direct API call without recursive child filters
      const response = await this.api.get(API_CONFIG.ENDPOINTS.ACTIVITIES, { params });

      if (response.data.success) {
        const activities = (response.data.activities || []).map((activity: any) => ({
          ...activity,
          activityType: [activity.category],
        }));
        return { activities, childId: child.id };
      }
      return { activities: [], childId: child.id };
    } catch (error) {
      console.error(`[PerChildSearch] Error searching for ${child.name}:`, error);
      return { activities: [], childId: child.id };
    }
  }

  /**
   * Apply child-based filters to API parameters
   * When mergedFilters are provided, they override user-level preferences
   */
  private applyChildFilters(params: any, childFilters?: ChildBasedFilterParams): any {
    if (!childFilters?.mergedFilters) {
      return params;
    }

    const merged = childFilters.mergedFilters;
    const updatedParams = { ...params };

    console.log('👶 [ActivityService] Applying child-based filters:', {
      filterMode: childFilters.filterMode,
      ageRange: `${merged.ageMin}-${merged.ageMax}`,
      activityTypes: merged.activityTypes?.length || 0,
      distanceKm: merged.distanceRadiusKm
    });

    // Age range from merged child preferences
    if (merged.ageMin !== undefined) {
      updatedParams.ageMin = merged.ageMin;
    }
    if (merged.ageMax !== undefined) {
      updatedParams.ageMax = merged.ageMax;
    }

    // Activity types from merged preferences (union in OR mode, intersection in AND mode)
    if (merged.activityTypes && merged.activityTypes.length > 0) {
      updatedParams.categories = merged.activityTypes.join(',');
    }

    // Price range from merged preferences
    if (merged.priceRangeMin !== undefined) {
      updatedParams.costMin = merged.priceRangeMin;
    }
    if (merged.priceRangeMax !== undefined && merged.priceRangeMax < 999999) {
      updatedParams.costMax = merged.priceRangeMax;
    }

    // Days of week from merged preferences
    if (merged.daysOfWeek && merged.daysOfWeek.length > 0 && merged.daysOfWeek.length < 7) {
      updatedParams.dayOfWeek = merged.daysOfWeek;
    }

    // LOCATION FALLBACK CHAIN:
    // Priority 1: Child's saved coordinates (lat/lng + radius) - most precise
    if (merged.latitude && merged.longitude) {
      updatedParams.userLat = merged.latitude;
      updatedParams.userLon = merged.longitude;
      updatedParams.radiusKm = merged.distanceRadiusKm || 25; // Default 25km if not set
      console.log('📍 [Location Fallback] Using child coordinates:', {
        lat: merged.latitude,
        lng: merged.longitude,
        radius: updatedParams.radiusKm
      });
    }
    // Priority 2: Child's city/province (fallback when no coordinates)
    else if (merged.city || merged.province) {
      if (merged.city) {
        updatedParams.city = merged.city;
      }
      if (merged.province) {
        updatedParams.province = merged.province;
      }
      console.log('📍 [Location Fallback] Using child city/province:', {
        city: merged.city,
        province: merged.province
      });
    }
    // Priority 3 (GPS) and Priority 4 (no location) are handled in searchActivitiesPaginated

    // Environment filter
    if (merged.environmentFilter && merged.environmentFilter !== 'all') {
      updatedParams.environment = merged.environmentFilter;
    }

    return updatedParams;
  }

  private constructor() {
    // Setup diagnostic interceptors in development
    if (__DEV__) {
      DiagnosticInterceptor.setupInterceptors();
    }

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
    // Note: Using synchronous interceptor to avoid potential async issues
    this.api.interceptors.request.use(
      (config) => {
        // Auth token is handled by api.ts middleware on the server side
        // Skip async token retrieval here to avoid potential hanging issues

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

  static resetInstance(): void {
    ActivityService.instance = null as any;
  }


  /**
   * Check network connectivity
   * Note: On iOS simulators, NetInfo can incorrectly report no connection
   */
  private async checkConnectivity(): Promise<boolean> {
    // In development mode, skip the check since iOS simulator NetInfo is unreliable
    if (__DEV__) {
      console.log('[ActivityService] Skipping connectivity check in dev mode');
      return true;
    }

    try {
      const state = await NetInfo.fetch();
      if (!state.isConnected) {
        console.error('No internet connection detected');
        return false;
      }
      return true;
    } catch (error) {
      console.warn('[ActivityService] NetInfo check failed, assuming connected:', error);
      return true; // Assume connected if check fails
    }
  }

  /**
   * Search activities with filters
   * @param filters Filter criteria
   * @param childFilters Optional child-based filters for multi-child selection
   */
  async searchActivities(filters: Filter = {}, childFilters?: ChildBasedFilterParams): Promise<Activity[]> {
    try {
      // Check network connectivity first
      const isConnected = await this.checkConnectivity();
      if (!isConnected) {
        console.error('No network connection available');
        return [];
      }

      // Get global filters from preferences
      const globalFilters = this.getGlobalFilterParams();

      // Get distance filter params (async) - only if not provided by child filters
      let distanceParams: { userLat?: number; userLon?: number; radiusKm?: number } = {};
      if (!childFilters?.mergedFilters?.latitude) {
        distanceParams = await this.getDistanceParams();
      }

      let params: any = { ...globalFilters, ...distanceParams };

      // Apply child-based filters (these override user-level preferences)
      params = this.applyChildFilters(params, childFilters);

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
      // Add dateMatchMode if specified - 'partial' = overlap, 'full' = completely within range
      if (filters.dateMatchMode) {
        params.dateMatchMode = filters.dateMatchMode;
      }
      
      // Add limit - use filter limit or default to 50
      params.limit = filters.limit || 50;

      // Add hasCoordinates filter for map view
      if (filters.hasCoordinates === true) {
        params.hasCoordinates = true;
      }

      console.log('Searching activities with params:', params);
      console.log('Full URL will be:', this.api.defaults.baseURL + API_CONFIG.ENDPOINTS.ACTIVITIES);

      const response = await this.api.get(API_CONFIG.ENDPOINTS.ACTIVITIES, { params });

      // Log the raw response
      console.log('🔍 API Response Status:', response.status);
      console.log('🔍 API Response Data:', JSON.stringify(response.data).substring(0, 500));
      console.log('🔍 API Response Success:', response.data?.success);
      console.log('🔍 API Response Activities Count:', response.data?.activities?.length);

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
      const mappedActivities = activities.map((activity: any) => ({
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

      // Sort with sponsored activities at the top, ordered by tier
      return sortWithSponsoredFirst(mappedActivities);
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
   * @param params Search parameters
   * @param childFilters Optional child-based filters for multi-child selection
   */
  async searchActivitiesPaginated(
    params: ActivitySearchParams,
    childFilters?: ChildBasedFilterParams
  ): Promise<PaginatedResponse<Activity>> {
    try {
      // Skip connectivity check in dev mode (unreliable on iOS simulator)
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

      // Check if we need per-child location search (children in different cities with coordinates)
      if (childFilters?.usePerChildLocation && childFilters?.children && childFilters.children.length > 1) {
        const locationsAreDistinct = this.areChildrenInDifferentCities(childFilters.children);

        if (locationsAreDistinct) {
          console.log('📍 [searchActivitiesPaginated] Multi-location detected, using per-child search');

          // Get global filters to pass to per-child search
          const globalFiltersForPerChild = this.getGlobalFilterParams();
          const baseParams = { ...params, ...globalFiltersForPerChild };

          const result = await this.searchActivitiesPerChild(
            childFilters.children,
            baseParams,
            childFilters.mergedFilters?.distanceRadiusKm || 25
          );

          // Only use per-child results if we got activities; otherwise fall through to normal search
          if (result.activities.length > 0) {
            return {
              items: result.activities,
              total: result.activities.length,
              limit: params.limit || 50,
              offset: params.offset || 0,
              hasMore: false,
              pages: 1
            };
          } else {
            console.log('📍 [searchActivitiesPaginated] Per-child search returned no results, falling through to normal search');
          }
        }
      }

      // Merge with global filters from preferences
      const globalFilters = this.getGlobalFilterParams();

      console.log('📤 [searchActivitiesPaginated] Input params:', params);
      console.log('📤 [searchActivitiesPaginated] Global filters:', globalFilters);
      console.log('📤 [searchActivitiesPaginated] Child filters:', childFilters ? 'provided' : 'none');

      // Convert parameters to match backend API - merge with global filters
      let apiParams = { ...params, ...globalFilters };

      // Apply child-based filters (includes location fallback: lat/lng → city/province)
      apiParams = this.applyChildFilters(apiParams, childFilters);

      // LOCATION FALLBACK CHAIN - Priority 3: GPS fallback
      // If no child location was applied (neither coordinates nor city), try GPS
      const hasChildLocation = apiParams.userLat || apiParams.city;
      if (!hasChildLocation) {
        const gpsLocation = await this.getGPSLocationFallback();
        if (gpsLocation) {
          apiParams.userLat = gpsLocation.latitude;
          apiParams.userLon = gpsLocation.longitude;
          apiParams.radiusKm = 25; // Default 25km radius for GPS fallback
          console.log('📍 [Location Fallback] Using GPS:', {
            lat: gpsLocation.latitude,
            lng: gpsLocation.longitude,
            radius: 25
          });
        } else {
          // Priority 4: No location - results will be unfiltered by location
          console.log('📍 [Location Fallback] No location available - returning unfiltered results');
        }
      }

      console.log('📤 [searchActivitiesPaginated] Final API params:', apiParams);
      
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
      
      // Build query string for the API call
      const queryString = Object.entries(apiParams)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => {
          // Handle arrays (like dayOfWeek)
          if (Array.isArray(v)) {
            return v.map(item => `${k}=${encodeURIComponent(String(item))}`).join('&');
          }
          return `${k}=${encodeURIComponent(String(v))}`;
        })
        .join('&');

      const fullUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ACTIVITIES}?${queryString}`;
      console.log('🚀 [searchActivitiesPaginated] Fetching:', fullUrl);

      // Use native fetch instead of axios for better React Native compatibility
      const fetchResponse = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      const responseData = await fetchResponse.json();

      console.log('📥 [searchActivitiesPaginated] Response status:', fetchResponse.status);
      console.log('📥 [searchActivitiesPaginated] Response success:', responseData?.success);
      console.log('📥 [searchActivitiesPaginated] Activities returned:', responseData?.activities?.length);

      if (responseData?.success && Array.isArray(responseData.activities)) {
        const response = { data: responseData }; // Wrap for compatibility with existing code
        const activities = response.data.activities.map((activity: any) => ({
          ...activity,
          // Keep the activityType object from the API response as-is
          // activityType is already an object with id, name, code, etc.
          dateRange: activity?.dateStart && activity?.dateEnd ? {
            start: new Date(activity.dateStart),
            end: new Date(activity.dateEnd),
          } : null,
          ageRange: {
            min: activity?.ageMin ?? 0,
            max: activity?.ageMax ?? 18
          },
          scrapedAt: new Date(activity?.updatedAt || activity?.createdAt || Date.now()),
          provider: activity?.provider?.name || 'NVRC',
          isFavorite: (activity?._count?.favorites ?? 0) > 0,
          cost: activity?.cost ?? 0,
          location: activity?.location || 'Unknown',
          // Include all enhanced fields
          registrationStatus: activity?.registrationStatus,
          registrationButtonText: activity?.registrationButtonText,
          detailUrl: activity?.detailUrl,
          fullDescription: activity?.fullDescription,
          instructor: activity?.instructor,
          prerequisites: activity?.prerequisites,
          whatToBring: activity?.whatToBring,
          fullAddress: activity?.fullAddress,
          latitude: activity?.latitude,
          longitude: activity?.longitude,
          directRegistrationUrl: activity?.directRegistrationUrl,
          contactInfo: activity?.contactInfo,
          totalSpots: activity?.totalSpots,
          // New fields for sessions and prerequisites
          hasMultipleSessions: activity?.hasMultipleSessions,
          sessionCount: activity?.sessionCount,
          sessions: activity?.sessions,
          hasPrerequisites: activity?.hasPrerequisites
        }));
        
        // The backend returns the total in pagination.total
        const total = response.data.pagination?.total || response.data.total || activities.length;
        const limit = response.data.pagination?.limit || params.limit || 50;
        const offset = response.data.pagination?.offset ?? params.offset ?? 0;
        const totalPages = response.data.pagination?.pages || Math.ceil(total / limit);

        // Use hasMore directly from API response (correctly calculated using offset-based pagination)
        // Fallback: calculate based on offset if API doesn't provide it
        const hasMore = response.data.hasMore ?? (offset + activities.length < total);

        // Sort with sponsored activities at the top, ordered by tier
        const sortedActivities = sortWithSponsoredFirst(activities);

        return {
          items: sortedActivities,
          total: total,  // This is the FULL count regardless of pagination
          limit: limit,
          offset: offset,
          hasMore: hasMore,
          pages: totalPages
        };
      }
      
      // Response was not successful or had invalid format
      console.error('❌ [searchActivitiesPaginated] Invalid response:', responseData);
      throw new Error(responseData?.message || 'Invalid response format');
    } catch (error: any) {
      console.error('❌ [searchActivitiesPaginated] Error:', error.message);

      DebugLogger.error('searchActivitiesPaginated', 'API call failed', {
        message: error.message,
      });

      throw new Error(error.message || 'Failed to search activities');
    }
  }

  /**
   * Get all activities (no filters)
   */
  async getAllActivities(): Promise<Activity[]> {
    return this.searchActivities({});
  }

  /**
   * Search activities within map bounds
   * Used by map screen for viewport-based queries
   */
  async searchActivitiesByBounds(params: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
    limit?: number;
    activityType?: string;
    activitySubtype?: string;
    ageMin?: number;
    ageMax?: number;
    costMin?: number;
    costMax?: number;
    dayOfWeek?: string[];
    hideClosedOrFull?: boolean;
    hideClosedActivities?: boolean;
    hideFullActivities?: boolean;
  }): Promise<{ activities: Activity[]; total: number }> {
    try {
      const response = await this.api.get('/api/v1/activities/bounds', { params });

      if (response.data.success) {
        const activities = (response.data.activities || []).map((activity: any) => ({
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
        }));

        return {
          activities,
          total: response.data.total || activities.length,
        };
      }

      return { activities: [], total: 0 };
    } catch (error: any) {
      console.error('Error searching activities by bounds:', error);
      return { activities: [], total: 0 };
    }
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

      if (response.data?.success && Array.isArray(response.data.favorites)) {
        const favorites = response.data.favorites
          .filter((fav: any) => fav?.activity) // Only process favorites with valid activity
          .map((fav: any) => ({
            ...fav.activity,
            activityType: [fav.activity?.category || 'Other'],
            dateRange: fav.activity?.dateStart && fav.activity?.dateEnd ? {
              start: new Date(fav.activity.dateStart),
              end: new Date(fav.activity.dateEnd),
            } : null,
            ageRange: {
              min: fav.activity?.ageMin ?? 0,
              max: fav.activity?.ageMax ?? 18
            },
            scrapedAt: new Date(fav.activity?.updatedAt || fav.activity?.createdAt || Date.now()),
            provider: fav.activity?.provider?.name || 'NVRC',
            isFavorite: true,
            favoriteNotes: fav?.notes
          }));

        // Sort with sponsored activities at the top, ordered by tier
        return sortWithSponsoredFirst(favorites);
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

  async getActivityTypesWithCounts(includeFilters: boolean = true): Promise<Array<{ code: string; name: string; iconName?: string; activityCount: number }>> {
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

  async getCities(): Promise<any[]> {
    try {
      const response = await this.api.get('/api/v1/cities');
      return response.data.success ? response.data.data : [];
    } catch (error) {
      console.error('Error fetching cities:', error);
      return [];
    }
  }

  async getCitiesWithCounts(includeEmpty: boolean = true): Promise<Array<{city: string; state: string; count: number}>> {
    try {
      const response = await this.api.get('/api/v1/cities', {
        params: { includeEmpty: includeEmpty ? 'true' : 'false' }
      });
      if (response.data?.success && Array.isArray(response.data.data)) {
        return response.data.data.map((city: any) => ({
          city: city?.city || 'Unknown',
          state: city?.province || 'BC',
          count: city?.activityCount ?? 0
        }));
      }
      return [];
    } catch (error) {
      console.error('Error fetching cities with counts:', error);
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
        const limit = response.data.pagination?.limit || params.limit || 50;
        const offset = response.data.pagination?.offset ?? params.offset ?? 0;
        const totalPages = response.data.pagination?.pages || Math.ceil(total / limit);

        // Use hasMore directly from API response (correctly calculated using offset-based pagination)
        const hasMore = response.data.hasMore ?? (offset + activities.length < total);

        // Sort with sponsored activities at the top, ordered by tier
        const sortedActivities = sortWithSponsoredFirst(activities);

        console.log(`✅ Venue API returned ${sortedActivities.length} activities out of ${total} total, hasMore: ${hasMore}`);

        return {
          items: sortedActivities,
          total: total,
          limit: limit,
          offset: offset,
          hasMore: hasMore,
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

  /**
   * Get age groups for filtering
   */
  async getAgeGroups(): Promise<Array<{ code: string; label: string; minAge: number; maxAge: number }>> {
    try {
      const response = await this.api.get(API_CONFIG.ENDPOINTS.AGE_GROUPS);

      if (response.data && response.data.success) {
        return response.data.data || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching age groups:', error);
      // Return default age groups if API fails
      return [
        { code: 'baby', label: 'Baby (0-2)', minAge: 0, maxAge: 2 },
        { code: 'toddler', label: 'Toddler (2-4)', minAge: 2, maxAge: 4 },
        { code: 'preschool', label: 'Preschool (4-6)', minAge: 4, maxAge: 6 },
        { code: 'school-age', label: 'School Age (6-12)', minAge: 6, maxAge: 12 },
        { code: 'teen', label: 'Teen (12-18)', minAge: 12, maxAge: 18 },
      ];
    }
  }

}

export default ActivityService;