import DebugLogger from '../utils/debugLogger';
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
  total?: number;           // Total count from API response for pagination
  apiStatus?: number;       // HTTP status from API response
  apiSuccess?: boolean;     // Whether API returned success=true
  apiMsg?: string;          // Error message from API if success=false
  paramKeys?: string[];     // Keys of params sent to API (for debugging)
  queryString?: string;     // Full query string sent to API (for debugging)
  error?: string;           // Error message if request failed
}

/**
 * Compute aggregations from an array of activities client-side
 * Used when server doesn't return aggregations (e.g., per-child search)
 */
function computeAggregationsFromActivities(activities: Activity[]): any {
  // Activity Types aggregation
  const activityTypeMap = new Map<string, { code: string; name: string; iconName: string; count: number }>();

  // Debug: Log first few activities to see activityType structure
  if (activities.length > 0) {
    console.log('📊 [computeAggregations] Sample activity.activityType:', {
      first: activities[0]?.activityType,
      second: activities[1]?.activityType,
      third: activities[2]?.activityType,
    });
  }

  for (const activity of activities) {
    const type = activity.activityType as any;
    if (type) {
      const key = type.code || type.id || type.name;
      if (key) {
        const existing = activityTypeMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          activityTypeMap.set(key, {
            code: type.code || key,
            name: type.name || key || 'Unknown',
            iconName: type.iconName || 'tag',
            count: 1
          });
        }
      }
    }
  }
  const activityTypes = Array.from(activityTypeMap.values())
    .filter(t => t.count > 0)
    .sort((a, b) => b.count - a.count);

  console.log('📊 [computeAggregations] Activity types found:', activityTypes.length, activityTypes.slice(0, 5).map(t => `${t.name}(${t.count})`));

  // Age brackets
  const AGE_BRACKETS = [
    { label: '0-3 years', min: 0, max: 3 },
    { label: '4-6 years', min: 4, max: 6 },
    { label: '7-9 years', min: 7, max: 9 },
    { label: '10-12 years', min: 10, max: 12 },
    { label: '13-15 years', min: 13, max: 15 },
    { label: '16-18 years', min: 16, max: 18 },
  ];
  const ageGroups = AGE_BRACKETS.map(bracket => {
    const count = activities.filter(activity => {
      // Handle both ageRange object and direct ageMin/ageMax properties
      const actAny = activity as any;
      const ageMin = activity.ageRange?.min ?? actAny.ageMin ?? 0;
      const ageMax = activity.ageRange?.max ?? actAny.ageMax ?? 99;
      return ageMin <= bracket.max && ageMax >= bracket.min;
    }).length;
    return { ...bracket, count };
  });

  // Cost brackets
  const COST_BRACKETS = [
    { label: 'Free', min: 0, max: 0 },
    { label: '$1-25', min: 1, max: 25 },
    { label: '$26-50', min: 26, max: 50 },
    { label: '$51-100', min: 51, max: 100 },
    { label: '$101-200', min: 101, max: 200 },
    { label: '$200+', min: 201, max: 999999 },
  ];
  const costBrackets = COST_BRACKETS.map(bracket => {
    const count = activities.filter(activity => {
      const cost = activity.cost;
      if (bracket.min === 0 && bracket.max === 0) {
        return cost === 0 || cost === null || cost === undefined;
      } else if (bracket.max === 999999) {
        return cost !== null && cost !== undefined && cost > 200;
      } else {
        return cost !== null && cost !== undefined && cost >= bracket.min && cost <= bracket.max;
      }
    }).length;
    return { ...bracket, count };
  });

  // Days of week
  const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const DAY_NAME_MAP: Record<string, string> = {
    'Monday': 'Mon', 'Tuesday': 'Tue', 'Wednesday': 'Wed', 'Thursday': 'Thu',
    'Friday': 'Fri', 'Saturday': 'Sat', 'Sunday': 'Sun',
  };
  const daysOfWeek = DAYS_OF_WEEK.map(day => {
    const abbreviatedDay = DAY_NAME_MAP[day];
    const count = activities.filter(activity => {
      // Check Activity.dayOfWeek array
      const activityDays = (activity as any).dayOfWeek;
      if (activityDays && Array.isArray(activityDays)) {
        if (activityDays.includes(abbreviatedDay)) return true;
      }
      // Also check sessions table (consistent with server-side aggregation)
      const sessions = (activity as any).sessions;
      if (sessions && Array.isArray(sessions)) {
        if (sessions.some((s: any) => s.dayOfWeek === abbreviatedDay)) return true;
      }
      return false;
    }).length;
    return { day, count };
  });

  // Environments
  const indoorCount = activities.filter(a => (a as any).isIndoor === true).length;
  const outdoorCount = activities.filter(a => (a as any).isIndoor === false).length;
  const environments = [
    { type: 'indoor', count: indoorCount },
    { type: 'outdoor', count: outdoorCount },
  ];

  // Cities
  const cityMap = new Map<string, { city: string; province: string; count: number }>();
  for (const activity of activities) {
    const loc = activity.location as any;
    const city = loc?.city;
    const province = loc?.province;
    if (city) {
      const key = `${city.toLowerCase()}|${(province || '').toLowerCase()}`;
      const existing = cityMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        cityMap.set(key, { city, province: province || '', count: 1 });
      }
    }
  }
  const cities = Array.from(cityMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  return {
    activityTypes,
    ageGroups,
    costBrackets,
    daysOfWeek,
    environments,
    cities,
  };
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
   * Extract location from a single child's savedAddress
   */
  private parseSavedAddressFromChild(child: ChildWithPreferences): { latitude?: number; longitude?: number; city?: string; province?: string; radiusKm?: number } | null {
    const savedAddress = child.preferences?.savedAddress;
    if (!savedAddress) return null;

    // Handle savedAddress that might be a JSON string
    let addr = savedAddress;
    if (typeof savedAddress === 'string') {
      try {
        addr = JSON.parse(savedAddress);
      } catch (e) {
        return null;
      }
    }

    const addrObj = addr as any;
    if (!addrObj) return null;

    return {
      latitude: addrObj.latitude,
      longitude: addrObj.longitude,
      city: addrObj.city,
      province: addrObj.state || addrObj.province,
      radiusKm: child.preferences?.distanceRadiusKm,
    };
  }

  /**
   * Extract location from children array (first child with valid location)
   * This is a fallback when getMergedFilters doesn't return location
   */
  private extractLocationFromChildren(children: ChildWithPreferences[]): { latitude?: number; longitude?: number; city?: string; province?: string; radiusKm?: number } {
    console.log('📍 [Location Fallback] Extracting location from', children.length, 'children');

    for (const child of children) {
      const location = this.parseSavedAddressFromChild(child);
      console.log('📍 [Location Fallback] Child:', child.name, '- parsed location:', {
        hasPreferences: !!child.preferences,
        hasSavedAddress: !!child.preferences?.savedAddress,
        savedAddressType: typeof child.preferences?.savedAddress,
        parsedLat: location?.latitude,
        parsedLng: location?.longitude,
        parsedCity: location?.city,
      });
      if (location?.latitude && location?.longitude) {
        console.log('📍 [Location Fallback] ✅ Found coordinates from child:', child.name);
        return location;
      }
    }
    // Try city-only fallback
    for (const child of children) {
      const location = this.parseSavedAddressFromChild(child);
      if (location?.city) {
        console.log('📍 [Location Fallback] ✅ Found city from child:', child.name, '-', location.city);
        return location;
      }
    }
    console.log('📍 [Location Fallback] ❌ No location found from any child!');
    return {};
  }

  /**
   * Apply child location as fallback when mergedFilters is not available
   */
  private applyChildLocationFallback(params: any, children: ChildWithPreferences[]): any {
    const location = this.extractLocationFromChildren(children);
    const updatedParams = { ...params };

    if (location.latitude && location.longitude) {
      updatedParams.userLat = location.latitude;
      updatedParams.userLon = location.longitude;
      updatedParams.radiusKm = location.radiusKm || 25;
      console.log('📍 [Location Fallback] Applied coordinates:', {
        lat: location.latitude,
        lng: location.longitude,
        radius: updatedParams.radiusKm
      });
    }
    if (location.city) {
      updatedParams.city = location.city;
      if (location.province) {
        updatedParams.province = location.province;
      }
      console.log('📍 [Location Fallback] Applied city:', location.city);
    }

    return updatedParams;
  }

  /**
   * Check if children are in different cities AND have valid coordinates
   * (requiring per-child location search)
   */
  private areChildrenInDifferentCities(children: ChildWithPreferences[]): boolean {
    const citySet = new Set<string>();

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

      console.log(`📍 [areChildrenInDifferentCities] ${child.name}: city="${city}", hasCoords=${hasCoords}`);

      // Count any city that has a name (we can search by city name even without coordinates)
      if (city) {
        citySet.add(city.toLowerCase().trim());
      }
    }

    const uniqueCities = Array.from(citySet);
    console.log(`📍 [areChildrenInDifferentCities] Unique cities: [${uniqueCities.join(', ')}], different=${citySet.size > 1}`);

    // More than one unique city means children are in different locations
    return citySet.size > 1;
  }

  /**
   * Search for activities near each child's location with their individual preferences.
   * Used when children are in different locations.
   */
  async searchActivitiesPerChild(
    children: ChildWithPreferences[],
    baseParams: any,
    defaultRadiusKm: number = 25
  ): Promise<{ activities: Activity[]; activityChildMap: Map<string, string[]>; totalCount: number }> {
    // Filter to children with valid locations (coordinates OR city name)
    const childrenWithLocations = children.filter(child => {
      const savedAddress = child.preferences?.savedAddress;
      let addr = savedAddress;
      if (typeof savedAddress === 'string') {
        try {
          addr = JSON.parse(savedAddress);
        } catch (e) { /* ignore */ }
      }
      const hasCoords = !!(addr as any)?.latitude && !!(addr as any)?.longitude;
      const hasCity = !!(addr as any)?.city;
      return hasCoords || hasCity;
    });

    if (childrenWithLocations.length === 0) {
      console.log('📍 [PerChildSearch] No children with valid locations (need coords or city)');
      return { activities: [], activityChildMap: new Map(), totalCount: 0 };
    }

    console.log(`📍 [PerChildSearch] Searching for ${childrenWithLocations.length} children with locations`);

    // Make parallel API calls for each child and capture debug info
    const perChildDebugResults: any[] = [];
    const searchPromises = childrenWithLocations.map(async child => {
      const result = await this.searchForSingleChild(child, baseParams, defaultRadiusKm);
      const savedAddress = child.preferences?.savedAddress;
      let addr: any = savedAddress;
      if (typeof savedAddress === 'string') {
        try { addr = JSON.parse(savedAddress); } catch (e) {}
      }
      // Calculate age for debug
      let age: number | string = 'N/A';
      if (child.dateOfBirth) {
        const birthDate = new Date(child.dateOfBirth);
        if (!isNaN(birthDate.getTime())) {
          const today = new Date();
          age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            (age as number)--;
          }
        }
      }
      // Get the actual categories sent to API
      let sentCategories = 'NONE';
      if (child.preferences?.preferredActivityTypes?.length) {
        sentCategories = child.preferences.preferredActivityTypes.join(',');
      }
      const hasCoords = !!(addr?.latitude && addr?.longitude);
      perChildDebugResults.push({
        name: child.name,
        count: result.activities.length,
        apiTotal: (result as any).total || 0,
        actTypes: child.preferences?.preferredActivityTypes || [],
        sentCats: sentCategories,
        city: addr?.city || 'NONE',
        hasCoords,
        lat: addr?.latitude?.toFixed(2),
        age,
        apiStatus: (result as any).apiStatus,
        apiSuccess: (result as any).apiSuccess,
        apiMsg: (result as any).apiMsg,
        paramKeys: (result as any).paramKeys || [],
        qs: (result as any).queryString || '',
        error: (result as any).error || null,
      });
      return result;
    });

    const results = await Promise.all(searchPromises);

    // Store debug info on class for later retrieval
    (this as any)._lastPerChildDebug = perChildDebugResults;

    // Merge activities and track which children they match
    const activityChildMap = new Map<string, string[]>();
    const allActivities: Activity[] = [];
    const seenIds = new Set<string>();
    let combinedTotal = 0;

    results.forEach(({ activities, childId, total }) => {
      console.log(`📍 [PerChildSearch] Child ${childId}: ${activities.length} activities found (total: ${total || 'unknown'})`);
      // Track the total count from each child's API response
      if (total) {
        combinedTotal += total;
      }
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

    // Sort activities with sponsored placement and distance-based ordering:
    // 1. Top 3 sponsored activities (sorted by tier: gold > silver > bronze)
    // 2. Non-sponsored activities sorted by distance (closest first)
    // 3. Remaining sponsored activities mixed randomly throughout

    const tierOrder: Record<string, number> = { gold: 0, silver: 1, bronze: 2 };

    // Separate sponsored and non-sponsored activities
    const sponsoredActivities = taggedActivities.filter(a => a.isFeatured);
    const nonSponsoredActivities = taggedActivities.filter(a => !a.isFeatured);

    // Sort sponsored by tier
    sponsoredActivities.sort((a, b) => {
      const aTier = (a.featuredTier?.toLowerCase() || 'bronze');
      const bTier = (b.featuredTier?.toLowerCase() || 'bronze');
      return (tierOrder[aTier] ?? 3) - (tierOrder[bTier] ?? 3);
    });

    // Take top 3 sponsored for the header
    const topSponsored = sponsoredActivities.slice(0, 3);
    const remainingSponsored = sponsoredActivities.slice(3);

    // Sort non-sponsored by distance (API returns distance field when searching with coordinates)
    nonSponsoredActivities.sort((a, b) => {
      const distA = (a as any).distance ?? Infinity;
      const distB = (b as any).distance ?? Infinity;
      return distA - distB;
    });

    // Mix remaining sponsored activities randomly into non-sponsored results
    // Insert each remaining sponsored activity at a random position
    const mixedNonSponsored = [...nonSponsoredActivities];
    remainingSponsored.forEach(sponsored => {
      // Insert at random position (but not at the very beginning to keep distance ordering)
      const minPos = Math.min(10, Math.floor(mixedNonSponsored.length * 0.1)); // At least 10% down
      const randomPos = minPos + Math.floor(Math.random() * (mixedNonSponsored.length - minPos + 1));
      mixedNonSponsored.splice(randomPos, 0, sponsored);
    });

    // Combine: top 3 sponsored first, then distance-sorted with mixed sponsored
    const sortedActivities = [...topSponsored, ...mixedNonSponsored];

    console.log(`📍 [PerChildSearch] Total: ${sortedActivities.length} unique activities (${topSponsored.length} top sponsored, ${remainingSponsored.length} mixed sponsored, ${nonSponsoredActivities.length} by distance), combinedTotal: ${combinedTotal}`);

    return { activities: sortedActivities, activityChildMap, totalCount: combinedTotal };
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
    const hasCoords = !!(addr?.latitude && addr?.longitude);
    const hasCity = !!addr?.city;

    // Need either coordinates or city to search
    if (!hasCoords && !hasCity) {
      console.log(`📍 [PerChildSearch] ${child.name}: No location data, skipping`);
      return { activities: [], childId: child.id };
    }

    // Calculate child's age
    let age: number | null = null;
    if (child.dateOfBirth) {
      const birthDate = new Date(child.dateOfBirth);
      if (!isNaN(birthDate.getTime())) {
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }
    }

    console.log(`📍 [PerChildSearch] ${child.name}: dateOfBirth=${child.dateOfBirth}, calculated age=${age}`);

    // Build search params with THIS child's location and preferences
    // Contextual filters (from baseParams) take precedence over child preferences
    const params: any = {
      ...baseParams,
    };

    // Add location - prefer coordinates, fall back to city name
    if (hasCoords) {
      params.userLat = addr.latitude;
      params.userLon = addr.longitude;
      params.radiusKm = child.preferences?.distanceRadiusKm || defaultRadiusKm;
    } else if (hasCity) {
      params.city = addr.city;
      // Note: Province is intentionally NOT sent - the API filters by city name alone
      // and province values like "British Columbia" vs "BC" cause mismatches
    }

    // For per-child search, use child's preferences:
    // - Location (city or coordinates)
    // - Activity types (from child's preferences)
    // - Age range (from child's age)
    // User can further filter the results using the filter panel

    // Age range: use child's age ± 1 year to find age-appropriate activities
    if (age !== null) {
      params.ageMin = Math.max(0, age - 1);
      params.ageMax = age + 1;
    }

    // Add THIS child's preferred activity types
    if (child.preferences?.preferredActivityTypes?.length) {
      params.categories = child.preferences.preferredActivityTypes.join(',');
      console.log(`📍 [PerChildSearch] ${child.name}: Using activity types:`, params.categories);
    }

    console.log(`📍 [PerChildSearch] ${child.name} FINAL params:`, {
      city: params.city,
      userLat: params.userLat,
      userLon: params.userLon,
      categories: params.categories,
      ageMin: params.ageMin,
      ageMax: params.ageMax,
      limit: params.limit,
    });

    // Log ALL params being sent
    const paramKeys = Object.keys(params).filter(k => params[k] !== undefined && params[k] !== null);
    console.log(`📍 [PerChildSearch] ${child.name} ALL params:`, params);
    console.log(`📍 [PerChildSearch] ${child.name} param keys:`, paramKeys);

    try {
      // Build URL manually to capture for debug
      const filteredParams: Record<string, string> = {};
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            filteredParams[key] = value.join(',');
          } else {
            filteredParams[key] = String(value);
          }
        }
      }
      const queryString = new URLSearchParams(filteredParams).toString();
      const debugUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ACTIVITIES}?${queryString}`;
      console.log(`📍 [PerChildSearch] ${child.name} URL:`, debugUrl);

      // Make direct API call without recursive child filters (using native fetch)
      const response = await this.nativeFetch(API_CONFIG.ENDPOINTS.ACTIVITIES, { params });

      console.log(`📍 [PerChildSearch] ${child.name} response:`, {
        status: response.status,
        success: response.data?.success,
        activitiesCount: response.data?.activities?.length || 0,
        total: response.data?.total || 0,
        errorMessage: response.data?.message || 'NONE',
      });

      if (response.data.success) {
        // Keep activityType as-is from API (object with code, name, iconName)
        // Don't override it - needed for aggregations to work correctly
        const activities = response.data.activities || [];
        return { activities, childId: child.id, apiStatus: response.status, apiSuccess: true, paramKeys, total: response.data?.total, queryString };
      }
      // API returned success=false
      console.log(`📍 [PerChildSearch] ${child.name} API returned success=false:`, response.data);
      return { activities: [], childId: child.id, apiStatus: response.status, apiSuccess: false, apiMsg: response.data?.message, paramKeys, queryString };
    } catch (error: any) {
      console.error(`[PerChildSearch] Error searching for ${child.name}:`, error?.message || error);
      return { activities: [], childId: child.id, error: error?.message, paramKeys };
    }
  }

  /**
   * Apply child-based filters to API parameters
   * When mergedFilters are provided, they override user-level preferences
   */
  private applyChildFilters(params: any, childFilters?: ChildBasedFilterParams): any {
    if (!childFilters?.mergedFilters) {
      // Even without mergedFilters, try to extract location from children directly
      if (childFilters?.children && childFilters.children.length > 0) {
        return this.applyChildLocationFallback(params, childFilters.children);
      }
      return params;
    }

    const merged = childFilters.mergedFilters;
    const updatedParams = { ...params };

    console.log('👶 [ActivityService] Applying child-based filters:', {
      filterMode: childFilters.filterMode,
      ageRange: `${merged.ageMin}-${merged.ageMax}`,
      activityTypesCount: merged.activityTypes?.length || 0,
      activityTypesRaw: merged.activityTypes,
      distanceKm: merged.distanceRadiusKm,
      hasLocationInMerged: !!(merged.latitude && merged.longitude),
      hasCity: !!merged.city,
      existingCategories: params.categories,
    });

    // Age range from merged child preferences
    // Only apply child age if contextual filters didn't set it (contextual takes precedence)
    if (merged.ageMin !== undefined && params.ageMin === undefined) {
      updatedParams.ageMin = merged.ageMin;
    }
    if (merged.ageMax !== undefined && params.ageMax === undefined) {
      updatedParams.ageMax = merged.ageMax;
    }

    // Activity types from merged preferences (only if contextual didn't set)
    if (merged.activityTypes && merged.activityTypes.length > 0 && !params.categories) {
      updatedParams.categories = merged.activityTypes.join(',');
      console.log('👶 [ActivityService] ✅ Applied activity types filter:', updatedParams.categories);
    } else {
      console.log('👶 [ActivityService] ❌ Activity types NOT applied:', {
        hasActivityTypes: !!merged.activityTypes,
        activityTypesLength: merged.activityTypes?.length || 0,
        existingCategories: params.categories,
      });
    }

    // Price range from merged preferences (only if contextual didn't set)
    if (merged.priceRangeMin !== undefined && params.costMin === undefined) {
      updatedParams.costMin = merged.priceRangeMin;
    }
    if (merged.priceRangeMax !== undefined && merged.priceRangeMax < 999999 && params.costMax === undefined && params.maxCost === undefined) {
      updatedParams.costMax = merged.priceRangeMax;
    }

    // Days of week from merged preferences (only if contextual didn't set)
    if (merged.daysOfWeek && merged.daysOfWeek.length > 0 && merged.daysOfWeek.length < 7 && !params.dayOfWeek) {
      updatedParams.dayOfWeek = merged.daysOfWeek;
    }

    // LOCATION FILTERING:
    // Use child's saved coordinates (lat/lng + radius) for geographic filtering
    if (merged.latitude && merged.longitude) {
      updatedParams.userLat = merged.latitude;
      updatedParams.userLon = merged.longitude;
      updatedParams.radiusKm = merged.distanceRadiusKm || 25; // Use child's preference, default 25km
      console.log('📍 [Location] Using child coordinates from merged:', {
        lat: merged.latitude,
        lng: merged.longitude,
        radius: updatedParams.radiusKm
      });
    } else if (childFilters?.children && childFilters.children.length > 0) {
      // FALLBACK: Extract location directly from children if not in mergedFilters
      // This handles cases where getMergedFilters didn't extract location properly
      const locationFromChildren = this.extractLocationFromChildren(childFilters.children);
      if (locationFromChildren.latitude && locationFromChildren.longitude) {
        updatedParams.userLat = locationFromChildren.latitude;
        updatedParams.userLon = locationFromChildren.longitude;
        updatedParams.radiusKm = locationFromChildren.radiusKm || 25;
        console.log('📍 [Location] Using fallback coordinates from children:', {
          lat: locationFromChildren.latitude,
          lng: locationFromChildren.longitude,
          radius: updatedParams.radiusKm
        });
      }
      // Also apply city if available from fallback
      if (!merged.city && locationFromChildren.city) {
        updatedParams.city = locationFromChildren.city;
        if (locationFromChildren.province) {
          updatedParams.province = locationFromChildren.province;
        }
        console.log('📍 [Location] Using fallback city from children:', locationFromChildren.city);
      }
    }

    // ALWAYS send city for same-city prioritization (even when we have coordinates)
    // This allows the server to prioritize activities in the child's city first
    if (merged.city && !updatedParams.city) {
      updatedParams.city = merged.city;
      console.log('📍 [Location] Using child city for prioritization:', merged.city);
    }
    if (merged.province && !updatedParams.province) {
      updatedParams.province = merged.province;
    }
    // GPS fallback is handled in searchActivitiesPaginated if no child location

    // Environment filter (only if contextual didn't set)
    if (merged.environmentFilter && merged.environmentFilter !== 'all' && !params.environment) {
      updatedParams.environment = merged.environmentFilter;
    }

    return updatedParams;
  }

  private constructor() {
    // Log the API configuration
    if (__DEV__) {
      console.log('=== ActivityService Configuration ===');
      console.log('API Base URL:', API_CONFIG.BASE_URL);
      console.log('Platform:', Platform.OS);
      console.log('Using native fetch (not axios)');
      console.log('=================================');
    }
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
   * Native fetch helper - more reliable than axios in React Native
   */
  private async nativeFetch<T = any>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      params?: Record<string, any>;
      body?: any;
    } = {}
  ): Promise<{ data: T; status: number }> {
    const { method = 'GET', params, body } = options;

    // Build URL with query params for GET requests
    let url = endpoint.startsWith('http') ? endpoint : `${API_CONFIG.BASE_URL}${endpoint}`;
    if (params && Object.keys(params).length > 0) {
      const filteredParams: Record<string, string> = {};
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            filteredParams[key] = value.join(',');
          } else {
            filteredParams[key] = String(value);
          }
        }
      }
      const queryString = new URLSearchParams(filteredParams).toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
      // Debug: Log the final URL with all params
      console.log('🌐 [nativeFetch] Final URL:', url);
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      fetchOptions.body = JSON.stringify(body);
    }

    // Add timeout to prevent hanging forever (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await response.json();
      return { data, status: response.status };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timed out after 30 seconds');
      }
      throw fetchError;
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
      console.log('Full URL will be:', API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.ACTIVITIES);

      const response = await this.nativeFetch(API_CONFIG.ENDPOINTS.ACTIVITIES, { params });

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
   * @param options Optional options including includeAggregations and skipLocationFallback
   */
  async searchActivitiesPaginated(
    params: ActivitySearchParams,
    childFilters?: ChildBasedFilterParams,
    options?: { includeAggregations?: boolean; skipLocationFallback?: boolean }
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
      // Build debug info to return in response
      const debugInfo: any = {
        usePerChildLoc: !!childFilters?.usePerChildLocation,
        childrenLen: childFilters?.children?.length || 0,
        childPrefsStatus: childFilters?.children?.map(c => {
          const addr = c.preferences?.savedAddress;
          let parsed: any = addr;
          if (typeof addr === 'string') {
            try { parsed = JSON.parse(addr); } catch (e) {}
          }
          return {
            name: c.name,
            hasPrefs: !!c.preferences,
            addrType: typeof addr,
            city: (parsed as any)?.city || 'NONE',
          };
        }) || [],
      };
      console.log('📍 [searchActivitiesPaginated] Per-child check:', debugInfo);

      if (childFilters?.usePerChildLocation && childFilters?.children && childFilters.children.length > 1) {
        const locationsAreDistinct = this.areChildrenInDifferentCities(childFilters.children);
        debugInfo.locationsAreDistinct = locationsAreDistinct;
        console.log('📍 [searchActivitiesPaginated] Multi-location check:', {
          childrenCount: childFilters.children.length,
          locationsAreDistinct,
        });

        if (locationsAreDistinct) {
          console.log('📍 [searchActivitiesPaginated] Multi-location detected, using per-child search');
          console.log('📍 [searchActivitiesPaginated] Each child will use their OWN location + activity types');

          // Get global filters to pass to per-child search
          // IMPORTANT: For per-child search, ONLY keep non-child-specific params
          // Child-specific params (location, age, categories, days, cost) come from each child's preferences
          const globalFiltersForPerChild = this.getGlobalFilterParams();

          // Start fresh with only the essential non-child-specific params
          // Use a high limit to fetch all matching activities for accurate count
          // (each child's search uses this limit, results are merged and deduplicated)
          const perChildLimit = 5000;  // High limit to get all matching activities
          const baseParams: any = {
            limit: perChildLimit,
            offset: 0,  // Always start from 0 for per-child search (no pagination)
            sortBy: params.sortBy,
            sortOrder: params.sortOrder,
            // Global user preferences (not child-specific)
            hideClosedOrFull: globalFiltersForPerChild.hideClosedOrFull,
            hideClosedActivities: globalFiltersForPerChild.hideClosedActivities,
            hideFullActivities: globalFiltersForPerChild.hideFullActivities,
          };

          console.log('📍 [searchActivitiesPaginated] Per-child baseParams (cleaned):', baseParams);

          debugInfo.perChildSearchAttempted = true;
          debugInfo.perChildBaseParams = {
            limit: baseParams.limit,
            sortBy: baseParams.sortBy,
            categories: baseParams.categories || 'NONE'
          };

          const result = await this.searchActivitiesPerChild(
            childFilters.children,
            baseParams,
            childFilters.mergedFilters?.distanceRadiusKm || 25
          );

          debugInfo.perChildResultCount = result.activities.length;
          debugInfo.perChildDetails = (this as any)._lastPerChildDebug || [];

          // Only use per-child results if we got activities; otherwise fall through to normal search
          if (result.activities.length > 0) {
            // Compute aggregations client-side since per-child search doesn't use the API aggregations
            const aggregations = computeAggregationsFromActivities(result.activities);
            const limit = params.limit || 50;
            const offset = params.offset || 0;

            // For per-child search, use the actual unique count of activities we fetched
            // Note: result.totalCount is the sum of each child's API total, which double-counts
            // activities that match multiple children and includes unfetched results.
            // The accurate count is the deduplicated activities we actually have.
            const uniqueActivitiesCount = result.activities.length;

            console.log('📊 [searchActivitiesPaginated] Per-child search result:', {
              uniqueActivities: uniqueActivitiesCount,
              combinedApiTotal: result.totalCount,
              activityTypesInAggregations: aggregations.activityTypes?.length || 0,
              activityTypesSample: aggregations.activityTypes?.slice(0, 5).map((t: any) => t.name) || [],
            });

            return {
              items: result.activities,
              total: uniqueActivitiesCount,
              limit: limit,
              offset: offset,
              hasMore: false,  // Per-child search fetches all at once, no pagination
              pages: 1,
              aggregations, // Include computed aggregations
            };
          } else {
            console.log('📍 [searchActivitiesPaginated] Per-child search returned no results, falling through to normal search');
          }
        }
      }

      // Merge with global filters from preferences
      const globalFilters = this.getGlobalFilterParams();

      console.log('📤 [searchActivitiesPaginated] Input params:', params);
      console.log('📤 [searchActivitiesPaginated] Child filters:', childFilters ? 'provided' : 'none');

      // Convert parameters to match backend API - merge with global filters
      let apiParams = { ...params, ...globalFilters };

      // Apply child-based filters (includes location fallback: lat/lng → city/province)
      apiParams = this.applyChildFilters(apiParams, childFilters);

      console.log('🔍 [searchActivitiesPaginated] After applyChildFilters:', {
        userLat: apiParams.userLat,
        userLon: apiParams.userLon,
        city: apiParams.city,
        radiusKm: apiParams.radiusKm,
        ageMin: apiParams.ageMin,
        ageMax: apiParams.ageMax,
        categories: apiParams.categories,
        hasLocationApplied: !!(apiParams.userLat || apiParams.city),
        hasCategoriesApplied: !!apiParams.categories,
      });

      // CRITICAL: Verify location is applied - log warning if missing
      if (!apiParams.userLat && !apiParams.city) {
        console.warn('⚠️ [searchActivitiesPaginated] NO LOCATION FILTER APPLIED - results may be unfiltered!');
        console.warn('⚠️ [searchActivitiesPaginated] childFilters:', {
          exists: !!childFilters,
          mergedFiltersExists: !!childFilters?.mergedFilters,
          mergedLat: childFilters?.mergedFilters?.latitude,
          mergedCity: childFilters?.mergedFilters?.city,
          childrenCount: childFilters?.children?.length || 0,
        });
      }

      // LOCATION FALLBACK CHAIN - Priority 3: GPS fallback
      // If no child location was applied (neither coordinates nor city), try GPS
      // Skip location fallback if explicitly requested (e.g., for recommended/new screens)
      const hasChildLocation = apiParams.userLat || apiParams.city;
      if (!hasChildLocation && !options?.skipLocationFallback) {
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
      } else if (options?.skipLocationFallback) {
        console.log('📍 [Location Fallback] Skipped - returning results without location filter');
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

      // Handle environment filter - client sends 'environment', server expects 'environmentFilter'
      if (params.environment && params.environment !== 'all') {
        apiParams.environmentFilter = params.environment;
        delete apiParams.environment;
      }

      // Add includeAggregations if requested
      if (options?.includeAggregations) {
        apiParams.includeAggregations = 'true';
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
          pages: totalPages,
          // Include aggregations if present in response
          aggregations: responseData.aggregations,
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
      const response = await this.nativeFetch('/api/v1/activities/bounds', { params });

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
      const response = await this.nativeFetch(`${API_CONFIG.ENDPOINTS.ACTIVITY_DETAILS}/${activityId}`);

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
      const response = await this.nativeFetch(API_CONFIG.ENDPOINTS.FAVORITES);

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
      await this.nativeFetch(API_CONFIG.ENDPOINTS.FAVORITES, {
        method: 'POST',
        body: { activityId }
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
      await this.nativeFetch(`${API_CONFIG.ENDPOINTS.FAVORITES}/${activityId}`, { method: 'DELETE' });
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
      const response = await this.nativeFetch(API_CONFIG.ENDPOINTS.CATEGORIES, { params });

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
      const response = await this.nativeFetch(API_CONFIG.ENDPOINTS.ACTIVITY_TYPES, { params });

      if (response.data?.success) {
        if (__DEV__) {
          console.log('[ActivityService] Activity types loaded:', response.data.data?.length || 0);
        }
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
      const response = await this.nativeFetch('/api/v1/cities');
      return response.data.success ? response.data.data : [];
    } catch (error) {
      console.error('Error fetching cities:', error);
      return [];
    }
  }

  async getCitiesWithCounts(includeEmpty: boolean = true): Promise<Array<{city: string; state: string; count: number}>> {
    try {
      const response = await this.nativeFetch('/api/v1/cities', {
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
      const params = this.getGlobalFilterParams();
      const response = await this.nativeFetch(`/api/v1/cities/${encodeURIComponent(city)}/locations`, { params });

      if (response.data?.success && response.data?.data?.locations) {
        if (__DEV__) console.log(`Found ${response.data.data.locations.length} locations for ${city}`);
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
      const response = await this.nativeFetch(API_CONFIG.ENDPOINTS.LOCATIONS);
      return response.data.success ? response.data.locations : [];
    } catch (error) {
      console.error('Error fetching locations:', error);
      return [];
    }
  }

  async getProviders(): Promise<any[]> {
    try {
      const response = await this.nativeFetch(API_CONFIG.ENDPOINTS.PROVIDERS);
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
      const response = await this.nativeFetch(API_CONFIG.ENDPOINTS.ACTIVITY_STATS);
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
      const response = await this.nativeFetch(`${API_CONFIG.ENDPOINTS.ACTIVITY_TYPES}/${activityTypeCode}`, { params });

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

      const response = await this.nativeFetch(`/api/v1/locations/${venueId}/activities`, { params: apiParams });

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
      const response = await this.nativeFetch('/api/v1/preferences/activity-types');

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
      const response = await this.nativeFetch(API_CONFIG.ENDPOINTS.AGE_GROUPS);

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