/**
 * Contextual Filter Types
 *
 * These types define temporary/contextual filters used within result screens.
 * Unlike UserPreferences (persisted globally), contextual filters:
 * - Are NOT persisted to storage
 * - Reset when leaving the screen
 * - Reduce results within a specific context (e.g., "Recommended for You")
 * - Work alongside child preferences (primary filter) not replace them
 */

import { Aggregations } from './aggregations';

/**
 * Contextual filters that can be applied within result screens
 * These filter down results that already have child preferences applied
 */
export interface ContextualFilters {
  // Activity type filtering
  activityTypes?: string[];

  // Age range filtering (overrides child-based age if set)
  ageRange?: {
    min: number;
    max: number;
  };

  // Price range filtering
  priceRange?: {
    min: number;
    max: number;
  };

  // Day of week filtering
  daysOfWeek?: string[];

  // Time of day filtering
  timeOfDay?: ('morning' | 'afternoon' | 'evening')[];

  // Indoor/outdoor preference
  environment?: 'all' | 'indoor' | 'outdoor';

  // Note: Location/distance are NOT included here
  // They come from child preferences or map bounds
}

/**
 * Filter mode determines how FiltersScreen behaves
 */
export type FilterMode = 'contextual' | 'search' | 'preferences';

/**
 * Route params for FiltersScreen navigation
 */
export interface FiltersRouteParams {
  // Operating mode
  mode: FilterMode;

  // Initial filters (for contextual mode)
  initialFilters?: ContextualFilters;

  // Aggregations from parent screen (for showing counts)
  aggregations?: Aggregations;

  // Sections to hide (e.g., 'locations', 'distance', 'activityTypes')
  hiddenSections?: string[];

  // Callback identifier for returning filters
  returnKey?: string;
}

/**
 * Result of applying contextual filters
 */
export interface ContextualFilterResult {
  filters: ContextualFilters;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

/**
 * Helper to check if contextual filters have any active values
 */
export function hasActiveContextualFilters(filters: ContextualFilters): boolean {
  if (filters.activityTypes && filters.activityTypes.length > 0) return true;
  if (filters.ageRange && (filters.ageRange.min > 0 || filters.ageRange.max < 18)) return true;
  if (filters.priceRange && (filters.priceRange.min > 0 || filters.priceRange.max < 1000)) return true;
  if (filters.daysOfWeek && filters.daysOfWeek.length > 0) return true;
  if (filters.timeOfDay && filters.timeOfDay.length > 0) return true;
  if (filters.environment && filters.environment !== 'all') return true;
  return false;
}

/**
 * Count number of active contextual filters
 */
export function countActiveContextualFilters(filters: ContextualFilters): number {
  let count = 0;
  if (filters.activityTypes && filters.activityTypes.length > 0) count++;
  if (filters.ageRange && (filters.ageRange.min > 0 || filters.ageRange.max < 18)) count++;
  if (filters.priceRange && (filters.priceRange.min > 0 || filters.priceRange.max < 1000)) count++;
  if (filters.daysOfWeek && filters.daysOfWeek.length > 0) count++;
  if (filters.timeOfDay && filters.timeOfDay.length > 0) count++;
  if (filters.environment && filters.environment !== 'all') count++;
  return count;
}

/**
 * Create empty contextual filters
 */
export function createEmptyContextualFilters(): ContextualFilters {
  return {
    activityTypes: [],
    ageRange: undefined,
    priceRange: undefined,
    daysOfWeek: [],
    timeOfDay: [],
    environment: 'all',
  };
}

/**
 * Merge contextual filters into API params
 */
export function applyContextualFiltersToParams(
  baseParams: Record<string, any>,
  filters: ContextualFilters
): Record<string, any> {
  const result = { ...baseParams };

  // Activity types
  if (filters.activityTypes && filters.activityTypes.length > 0) {
    result.activityTypes = filters.activityTypes;
  }

  // Age range
  if (filters.ageRange) {
    if (filters.ageRange.min > 0) {
      result.ageMin = filters.ageRange.min;
    }
    if (filters.ageRange.max < 18) {
      result.ageMax = filters.ageRange.max;
    }
  }

  // Price range
  if (filters.priceRange) {
    if (filters.priceRange.min > 0) {
      result.costMin = filters.priceRange.min;
    }
    if (filters.priceRange.max < 1000) {
      result.costMax = filters.priceRange.max;
    }
  }

  // Days of week
  if (filters.daysOfWeek && filters.daysOfWeek.length > 0) {
    result.daysOfWeek = filters.daysOfWeek;
  }

  // Time of day - convert to time ranges if needed
  if (filters.timeOfDay && filters.timeOfDay.length > 0) {
    result.timeOfDay = filters.timeOfDay;
  }

  // Environment
  if (filters.environment && filters.environment !== 'all') {
    result.isIndoor = filters.environment === 'indoor';
  }

  return result;
}
