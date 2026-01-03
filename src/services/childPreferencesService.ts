import apiClient from './apiClient';
import { EnhancedAddress } from '../types/preferences';

/**
 * Time preferences for activity scheduling
 */
export interface TimePreferences {
  morning: boolean;   // 6am-12pm
  afternoon: boolean; // 12pm-5pm
  evening: boolean;   // 5pm-9pm
}

/**
 * Day-specific time slots for granular scheduling
 * Each day can have different time slot preferences
 */
export interface DayTimeSlots {
  [day: string]: {
    morning: boolean;
    afternoon: boolean;
    evening: boolean;
  };
}

/**
 * Child-specific activity preferences
 * Each child can have their own location, activity types, schedule, and budget preferences
 */
export interface ChildPreferences {
  id: string;
  childId: string;

  // Location preferences
  locationSource: 'gps' | 'saved_address';
  savedAddress?: EnhancedAddress;
  distanceRadiusKm: number;
  distanceFilterEnabled: boolean;

  // Activity type preferences
  preferredActivityTypes: string[];
  preferredSubtypes: string[];
  excludedCategories: string[];

  // Schedule preferences
  daysOfWeek: string[];
  timePreferences: TimePreferences;
  dayTimeSlots?: DayTimeSlots; // Granular day+time selection

  // Budget preferences
  priceRangeMin: number;
  priceRangeMax: number;
  maxBudgetFriendlyAmount: number;

  // Environment preference
  environmentFilter: 'all' | 'indoor' | 'outdoor';

  createdAt: string;
  updatedAt: string;
}

/**
 * Merged filters for activity filtering when multiple children are selected
 */
export interface MergedChildFilters {
  ageMin: number;
  ageMax: number;
  activityTypes: string[];
  excludedCategories: string[];
  daysOfWeek: string[];
  timePreferences: TimePreferences;
  dayTimeSlots?: DayTimeSlots; // Granular day+time selection
  priceRangeMin: number;
  priceRangeMax: number;
  distanceRadiusKm: number;
  latitude?: number;
  longitude?: number;
  environmentFilter: 'all' | 'indoor' | 'outdoor';
  // Gender filtering: array of genders to show activities for
  // Activities with matching gender OR null (unisex) will be shown
  genders: ('male' | 'female' | null)[];
}

/**
 * Service for managing child-specific activity preferences
 */
class ChildPreferencesService {
  private static instance: ChildPreferencesService;
  private preferencesCache: Map<string, ChildPreferences> = new Map();

  private constructor() {}

  static getInstance(): ChildPreferencesService {
    if (!ChildPreferencesService.instance) {
      ChildPreferencesService.instance = new ChildPreferencesService();
    }
    return ChildPreferencesService.instance;
  }

  /**
   * Get preferences for a child (creates default if not exists)
   */
  async getChildPreferences(childId: string): Promise<ChildPreferences> {
    try {
      const response = await apiClient.get<{ success: boolean; preferences: ChildPreferences }>(
        `/api/children/${childId}/preferences`
      );

      if (response?.preferences) {
        this.preferencesCache.set(childId, response.preferences);
        return response.preferences;
      }

      throw new Error('Failed to get child preferences');
    } catch (error) {
      console.error('[ChildPreferencesService] Error getting preferences:', error);
      throw error;
    }
  }

  /**
   * Update preferences for a child
   */
  async updateChildPreferences(
    childId: string,
    updates: Partial<Omit<ChildPreferences, 'id' | 'childId' | 'createdAt' | 'updatedAt'>>
  ): Promise<ChildPreferences> {
    try {
      const response = await apiClient.put<{ success: boolean; preferences: ChildPreferences }>(
        `/api/children/${childId}/preferences`,
        updates
      );

      if (response?.preferences) {
        this.preferencesCache.set(childId, response.preferences);
        return response.preferences;
      }

      throw new Error('Failed to update child preferences');
    } catch (error) {
      console.error('[ChildPreferencesService] Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Copy preferences from one child to another
   */
  async copyPreferences(sourceChildId: string, targetChildId: string): Promise<ChildPreferences> {
    try {
      const response = await apiClient.post<{ success: boolean; preferences: ChildPreferences }>(
        `/api/children/${targetChildId}/preferences/copy/${sourceChildId}`
      );

      if (response?.preferences) {
        this.preferencesCache.set(targetChildId, response.preferences);
        return response.preferences;
      }

      throw new Error('Failed to copy preferences');
    } catch (error) {
      console.error('[ChildPreferencesService] Error copying preferences:', error);
      throw error;
    }
  }

  /**
   * Initialize preferences for a child from user's current preferences
   * Used during migration from user-level to child-level preferences
   */
  async initializeFromUserPreferences(childId: string): Promise<ChildPreferences> {
    try {
      const response = await apiClient.post<{ success: boolean; preferences: ChildPreferences }>(
        `/api/children/${childId}/preferences/initialize`
      );

      if (response?.preferences) {
        this.preferencesCache.set(childId, response.preferences);
        return response.preferences;
      }

      throw new Error('Failed to initialize preferences');
    } catch (error) {
      console.error('[ChildPreferencesService] Error initializing preferences:', error);
      throw error;
    }
  }

  /**
   * Initialize preferences for all children from user's preferences
   * Used during bulk migration
   */
  async initializeAllChildrenPreferences(): Promise<{
    total: number;
    initialized: number;
    skipped: number;
    errors?: string[];
  }> {
    try {
      const response = await apiClient.post<{
        success: boolean;
        total: number;
        initialized: number;
        skipped: number;
        errors?: string[];
      }>('/api/children/preferences/initialize-all');

      // Clear cache to force refresh
      this.preferencesCache.clear();

      return {
        total: response.total,
        initialized: response.initialized,
        skipped: response.skipped,
        errors: response.errors,
      };
    } catch (error) {
      console.error('[ChildPreferencesService] Error initializing all preferences:', error);
      throw error;
    }
  }

  /**
   * Get cached preferences for a child (returns undefined if not cached)
   */
  getCachedPreferences(childId: string): ChildPreferences | undefined {
    return this.preferencesCache.get(childId);
  }

  /**
   * Clear the preferences cache
   */
  clearCache(): void {
    this.preferencesCache.clear();
  }

  /**
   * Merge preferences from multiple children for activity filtering
   * @param childPreferences Array of child preferences
   * @param childAges Array of child ages (for age filtering)
   * @param childGenders Array of child genders (for gender filtering)
   * @param mode 'or' (any child) or 'and' (all children together)
   */
  getMergedFilters(
    childPreferences: ChildPreferences[],
    childAges: number[],
    childGenders: ('male' | 'female' | null)[] = [],
    mode: 'or' | 'and' = 'or'
  ): MergedChildFilters {
    if (childPreferences.length === 0) {
      // Return default filters
      return {
        ageMin: 0,
        ageMax: 18,
        activityTypes: [],
        excludedCategories: [],
        daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        timePreferences: { morning: true, afternoon: true, evening: true },
        priceRangeMin: 0,
        priceRangeMax: 999999,
        distanceRadiusKm: 25,
        environmentFilter: 'all',
        genders: [], // Empty means show all
      };
    }

    if (mode === 'or') {
      return this.mergeOrMode(childPreferences, childAges, childGenders);
    } else {
      return this.mergeAndMode(childPreferences, childAges, childGenders);
    }
  }

  /**
   * OR mode: Activities suitable for ANY selected child
   * - Age range expands to include all children (min of mins, max of maxes)
   * - Activity types are union of all types
   * - Days are union of all days
   * - Budget is full range
   * - Distance is maximum of all radii
   * - Gender: union of all genders (show activities for any child's gender)
   */
  private mergeOrMode(
    childPreferences: ChildPreferences[],
    childAges: number[],
    childGenders: ('male' | 'female' | null)[]
  ): MergedChildFilters {
    // Age range: expand to cover all children (with 1 year tolerance)
    const ageMin = Math.max(0, Math.min(...childAges) - 1);
    const ageMax = Math.min(18, Math.max(...childAges) + 1);

    // Activity types: union of all, BUT if ANY child has empty array (meaning "all types"),
    // return empty array to not filter by activity type
    let allActivityTypes: string[] = [];
    const anyChildHasNoTypePreference = childPreferences.some(
      p => !p.preferredActivityTypes || p.preferredActivityTypes.length === 0
    );
    if (!anyChildHasNoTypePreference) {
      // All children have specific preferences, so take the union
      const typeSet = new Set<string>();
      childPreferences.forEach(p => {
        p.preferredActivityTypes.forEach(t => typeSet.add(t));
      });
      allActivityTypes = Array.from(typeSet);
    }
    // If any child has no preference, allActivityTypes stays empty (= show all types)

    // Excluded categories: intersection (only exclude if ALL children exclude)
    const excludedCounts = new Map<string, number>();
    childPreferences.forEach(p => {
      p.excludedCategories.forEach(c => {
        excludedCounts.set(c, (excludedCounts.get(c) || 0) + 1);
      });
    });
    const excludedCategories = Array.from(excludedCounts.entries())
      .filter(([_, count]) => count === childPreferences.length)
      .map(([cat, _]) => cat);

    // Days: union of all, BUT if ANY child has all 7 days or empty (meaning "any day"),
    // return all days to not filter by day
    const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    let allDays: string[] = ALL_DAYS;
    const anyChildHasNoDayPreference = childPreferences.some(
      p => !p.daysOfWeek || p.daysOfWeek.length === 0 || p.daysOfWeek.length >= 7
    );
    if (!anyChildHasNoDayPreference) {
      // All children have specific day preferences, so take the union
      const daySet = new Set<string>();
      childPreferences.forEach(p => {
        p.daysOfWeek.forEach(d => daySet.add(d));
      });
      allDays = Array.from(daySet);
    }

    // Time preferences: any true = true
    const timePreferences: TimePreferences = {
      morning: childPreferences.some(p => p.timePreferences?.morning),
      afternoon: childPreferences.some(p => p.timePreferences?.afternoon),
      evening: childPreferences.some(p => p.timePreferences?.evening),
    };

    // Budget: full range
    const priceRangeMin = Math.min(...childPreferences.map(p => p.priceRangeMin));
    const priceRangeMax = Math.max(...childPreferences.map(p => p.priceRangeMax));

    // Distance: maximum radius
    const distanceRadiusKm = Math.max(...childPreferences.map(p => p.distanceRadiusKm));

    // Location: use first child's location
    const firstWithLocation = childPreferences.find(p => p.savedAddress?.latitude);
    const latitude = firstWithLocation?.savedAddress?.latitude;
    const longitude = firstWithLocation?.savedAddress?.longitude;

    // Environment: 'all' if any child prefers 'all', otherwise union
    let environmentFilter: 'all' | 'indoor' | 'outdoor' = 'all';
    const envPrefs = new Set(childPreferences.map(p => p.environmentFilter));
    if (envPrefs.size === 1) {
      environmentFilter = childPreferences[0].environmentFilter;
    }

    // Gender: union of all genders (show activities for any child's gender)
    // Filter out duplicates using Set
    const genders = Array.from(new Set(childGenders)) as ('male' | 'female' | null)[];

    return {
      ageMin,
      ageMax,
      activityTypes: allActivityTypes,
      excludedCategories,
      daysOfWeek: allDays,
      timePreferences,
      priceRangeMin,
      priceRangeMax,
      distanceRadiusKm,
      latitude,
      longitude,
      environmentFilter,
      genders,
    };
  }

  /**
   * AND mode: Activities that ALL selected children can do together
   * - Age range is intersection (must fit all children)
   * - Activity types are intersection (common types)
   * - Days are intersection (common days)
   * - Budget is intersection
   * - Location must be within ALL children's distances
   * - Gender: intersection (only show unisex if different genders)
   */
  private mergeAndMode(
    childPreferences: ChildPreferences[],
    childAges: number[],
    childGenders: ('male' | 'female' | null)[]
  ): MergedChildFilters {
    // Age range: must fit all children
    const ageMin = Math.max(...childAges) - 1; // Activity must accept oldest child
    const ageMax = Math.min(...childAges) + 1; // Activity must accept youngest child

    // Activity types: intersection (common to all)
    let activityTypes = childPreferences[0]?.preferredActivityTypes || [];
    for (let i = 1; i < childPreferences.length; i++) {
      const childTypes = new Set(childPreferences[i].preferredActivityTypes);
      activityTypes = activityTypes.filter(t => childTypes.has(t));
    }

    // Excluded categories: union (exclude if ANY child excludes)
    const excludedCategories = Array.from(
      new Set(childPreferences.flatMap(p => p.excludedCategories))
    );

    // Days: intersection (all must be available)
    let daysOfWeek = childPreferences[0]?.daysOfWeek || [];
    for (let i = 1; i < childPreferences.length; i++) {
      const childDays = new Set(childPreferences[i].daysOfWeek);
      daysOfWeek = daysOfWeek.filter(d => childDays.has(d));
    }

    // Time preferences: all must be true
    const timePreferences: TimePreferences = {
      morning: childPreferences.every(p => p.timePreferences?.morning),
      afternoon: childPreferences.every(p => p.timePreferences?.afternoon),
      evening: childPreferences.every(p => p.timePreferences?.evening),
    };

    // Budget: intersection (range that works for all)
    const priceRangeMin = Math.max(...childPreferences.map(p => p.priceRangeMin));
    const priceRangeMax = Math.min(...childPreferences.map(p => p.priceRangeMax));

    // Distance: minimum radius (must be reachable by all)
    const distanceRadiusKm = Math.min(...childPreferences.map(p => p.distanceRadiusKm));

    // Location: use first child's location (in AND mode, activity must be within this distance for all)
    const firstWithLocation = childPreferences.find(p => p.savedAddress?.latitude);
    const latitude = firstWithLocation?.savedAddress?.latitude;
    const longitude = firstWithLocation?.savedAddress?.longitude;

    // Environment: must match all (intersection)
    let environmentFilter: 'all' | 'indoor' | 'outdoor' = 'all';
    const envPrefs = new Set(childPreferences.map(p => p.environmentFilter));
    if (envPrefs.size === 1 && !envPrefs.has('all')) {
      environmentFilter = childPreferences[0].environmentFilter;
    } else if (envPrefs.has('indoor') && envPrefs.has('outdoor')) {
      // If one wants indoor and another outdoor, no common ground - use 'all' but results may be limited
      environmentFilter = 'all';
    }

    // Gender: intersection - if children have different genders, only show unisex activities (null)
    const uniqueGenders = Array.from(new Set(childGenders.filter(g => g !== null)));
    let genders: ('male' | 'female' | null)[];
    if (uniqueGenders.length === 0) {
      // All children have null gender or no genders provided - show all
      genders = [];
    } else if (uniqueGenders.length === 1) {
      // All children have the same gender - show that gender + unisex
      genders = [uniqueGenders[0] as 'male' | 'female', null];
    } else {
      // Children have different genders - only show unisex activities
      genders = [null];
    }

    return {
      ageMin,
      ageMax,
      activityTypes,
      excludedCategories,
      daysOfWeek,
      timePreferences,
      priceRangeMin,
      priceRangeMax,
      distanceRadiusKm,
      latitude,
      longitude,
      environmentFilter,
      genders,
    };
  }

  /**
   * Update location preferences for a child
   */
  async updateLocationPreferences(
    childId: string,
    locationSource: 'gps' | 'saved_address',
    savedAddress?: EnhancedAddress,
    distanceRadiusKm?: number,
    distanceFilterEnabled?: boolean
  ): Promise<ChildPreferences> {
    const updates: Partial<ChildPreferences> = {
      locationSource,
    };

    if (savedAddress !== undefined) updates.savedAddress = savedAddress;
    if (distanceRadiusKm !== undefined) updates.distanceRadiusKm = distanceRadiusKm;
    if (distanceFilterEnabled !== undefined) updates.distanceFilterEnabled = distanceFilterEnabled;

    return this.updateChildPreferences(childId, updates);
  }

  /**
   * Update activity type preferences for a child
   */
  async updateActivityTypePreferences(
    childId: string,
    preferredActivityTypes: string[],
    preferredSubtypes?: string[],
    excludedCategories?: string[]
  ): Promise<ChildPreferences> {
    const updates: Partial<ChildPreferences> = {
      preferredActivityTypes,
    };

    if (preferredSubtypes !== undefined) updates.preferredSubtypes = preferredSubtypes;
    if (excludedCategories !== undefined) updates.excludedCategories = excludedCategories;

    return this.updateChildPreferences(childId, updates);
  }

  /**
   * Update schedule preferences for a child
   */
  async updateSchedulePreferences(
    childId: string,
    daysOfWeek: string[],
    timePreferences?: TimePreferences
  ): Promise<ChildPreferences> {
    const updates: Partial<ChildPreferences> = {
      daysOfWeek,
    };

    if (timePreferences !== undefined) updates.timePreferences = timePreferences;

    return this.updateChildPreferences(childId, updates);
  }

  /**
   * Update budget preferences for a child
   */
  async updateBudgetPreferences(
    childId: string,
    priceRangeMin: number,
    priceRangeMax: number,
    maxBudgetFriendlyAmount?: number
  ): Promise<ChildPreferences> {
    const updates: Partial<ChildPreferences> = {
      priceRangeMin,
      priceRangeMax,
    };

    if (maxBudgetFriendlyAmount !== undefined) updates.maxBudgetFriendlyAmount = maxBudgetFriendlyAmount;

    return this.updateChildPreferences(childId, updates);
  }
}

export default ChildPreferencesService.getInstance();
