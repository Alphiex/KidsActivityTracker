/**
 * useContextualFilters Hook
 *
 * Manages temporary/contextual filters for result screens.
 * These filters:
 * - Are NOT persisted to PreferencesService
 * - Reset when the component unmounts
 * - Work alongside child preferences (primary filter)
 * - Reduce results within a specific context
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  ContextualFilters,
  createEmptyContextualFilters,
  hasActiveContextualFilters,
  countActiveContextualFilters,
  applyContextualFiltersToParams,
} from '../types/filters';

export interface UseContextualFiltersReturn {
  // Current filter state
  filters: ContextualFilters;

  // Individual filter setters
  setActivityTypes: (types: string[]) => void;
  setAgeRange: (range: { min: number; max: number } | undefined) => void;
  setPriceRange: (range: { min: number; max: number } | undefined) => void;
  setDaysOfWeek: (days: string[]) => void;
  setTimeOfDay: (times: ('morning' | 'afternoon' | 'evening')[]) => void;
  setEnvironment: (env: 'all' | 'indoor' | 'outdoor') => void;

  // Bulk operations
  setFilters: (filters: ContextualFilters) => void;
  updateFilters: (updates: Partial<ContextualFilters>) => void;
  clearFilters: () => void;

  // State queries
  hasActiveFilters: boolean;
  activeFilterCount: number;

  // Apply to API params
  applyToParams: (baseParams: Record<string, any>) => Record<string, any>;

  // Track if filters have been modified since initialization
  isDirty: boolean;

  // Reference to check if filters came from FiltersScreen
  hasVisitedFiltersScreen: boolean;
  markFiltersScreenVisited: () => void;
}

interface UseContextualFiltersOptions {
  // Initial filters to start with
  initialFilters?: ContextualFilters;

  // Callback when filters change
  onFiltersChange?: (filters: ContextualFilters) => void;
}

const useContextualFilters = (
  options: UseContextualFiltersOptions = {}
): UseContextualFiltersReturn => {
  const { initialFilters, onFiltersChange } = options;

  // Main filter state
  const [filters, setFiltersState] = useState<ContextualFilters>(
    initialFilters || createEmptyContextualFilters()
  );

  // Track if filters have been modified
  const [isDirty, setIsDirty] = useState(false);

  // Track if user has visited FiltersScreen
  const [hasVisitedFiltersScreen, setHasVisitedFiltersScreen] = useState(false);

  // Ref to track initial value for comparison
  const initialFiltersRef = useRef(initialFilters);

  // Notify parent when filters change
  useEffect(() => {
    if (onFiltersChange && isDirty) {
      onFiltersChange(filters);
    }
  }, [filters, isDirty, onFiltersChange]);

  // Individual setters
  const setActivityTypes = useCallback((types: string[]) => {
    setFiltersState((prev) => ({ ...prev, activityTypes: types }));
    setIsDirty(true);
  }, []);

  const setAgeRange = useCallback(
    (range: { min: number; max: number } | undefined) => {
      setFiltersState((prev) => ({ ...prev, ageRange: range }));
      setIsDirty(true);
    },
    []
  );

  const setPriceRange = useCallback(
    (range: { min: number; max: number } | undefined) => {
      setFiltersState((prev) => ({ ...prev, priceRange: range }));
      setIsDirty(true);
    },
    []
  );

  const setDaysOfWeek = useCallback((days: string[]) => {
    setFiltersState((prev) => ({ ...prev, daysOfWeek: days }));
    setIsDirty(true);
  }, []);

  const setTimeOfDay = useCallback(
    (times: ('morning' | 'afternoon' | 'evening')[]) => {
      setFiltersState((prev) => ({ ...prev, timeOfDay: times }));
      setIsDirty(true);
    },
    []
  );

  const setEnvironment = useCallback(
    (env: 'all' | 'indoor' | 'outdoor') => {
      setFiltersState((prev) => ({ ...prev, environment: env }));
      setIsDirty(true);
    },
    []
  );

  // Bulk operations
  const setFilters = useCallback((newFilters: ContextualFilters) => {
    setFiltersState(newFilters);
    setIsDirty(true);
  }, []);

  const updateFilters = useCallback((updates: Partial<ContextualFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...updates }));
    setIsDirty(true);
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(createEmptyContextualFilters());
    setIsDirty(true);
  }, []);

  // Mark that user visited FiltersScreen
  const markFiltersScreenVisited = useCallback(() => {
    setHasVisitedFiltersScreen(true);
  }, []);

  // Computed values
  const hasActiveFilters = useMemo(
    () => hasActiveContextualFilters(filters),
    [filters]
  );

  const activeFilterCount = useMemo(
    () => countActiveContextualFilters(filters),
    [filters]
  );

  // Apply to API params
  const applyToParams = useCallback(
    (baseParams: Record<string, any>) =>
      applyContextualFiltersToParams(baseParams, filters),
    [filters]
  );

  return {
    filters,
    setActivityTypes,
    setAgeRange,
    setPriceRange,
    setDaysOfWeek,
    setTimeOfDay,
    setEnvironment,
    setFilters,
    updateFilters,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
    applyToParams,
    isDirty,
    hasVisitedFiltersScreen,
    markFiltersScreenVisited,
  };
};

export default useContextualFilters;

// Also export for named imports
export { useContextualFilters };
