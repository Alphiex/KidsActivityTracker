// Hierarchical location filter types
export interface HierarchicalLocation {
  id: string;
  name: string;
  city: string;
  province: string;
  address?: string;
  fullAddress?: string;
  activityCount: number;
}

export interface HierarchicalCity {
  name: string;
  province: string;
  locations: HierarchicalLocation[];
  locationCount: number;
  activityCount: number;
  expanded: boolean;
}

export interface HierarchicalProvince {
  name: string;
  cities: HierarchicalCity[];
  cityCount: number;
  locationCount: number;
  activityCount: number;
  expanded: boolean;
}

export type CheckboxState = 'unchecked' | 'checked' | 'indeterminate';

// Enhanced address structure for full address storage
export interface EnhancedAddress {
  // Display
  formattedAddress: string;        // Full formatted address from Google
  displayName?: string;            // User-friendly short name

  // Coordinates (required)
  latitude: number;
  longitude: number;

  // Address Components (all optional)
  streetAddress?: string;          // Combined street address
  streetNumber?: string;
  streetName?: string;
  neighborhood?: string;
  city?: string;
  state?: string;                  // Province/State
  postalCode?: string;
  country?: string;
  countryCode?: string;            // 2-letter ISO code

  // Google Places metadata
  placeId?: string;                // Google Place ID for future lookups
  types?: string[];                // Place types from Google

  // Timestamps
  updatedAt: string;
}

// Legacy address format for backward compatibility
export interface LegacyAddress {
  address: string;
  latitude: number;
  longitude: number;
}

// Helper type guard
export function isEnhancedAddress(address: any): address is EnhancedAddress {
  return address && 'formattedAddress' in address && 'latitude' in address;
}

export function isLegacyAddress(address: any): address is LegacyAddress {
  return address && 'address' in address && !('formattedAddress' in address);
}

export interface UserPreferences {
  // Basic preferences
  id: string;
  name?: string;

  // Location preferences
  locations: string[]; // DEPRECATED - kept for migration (location names)
  locationIds: string[]; // NEW - primary storage (location UUIDs)
  maxDistance?: number; // DEPRECATED - use distanceRadiusKm instead
  preferredLocation?: string; // For onboarding

  // Distance-based filtering preferences
  // DEPRECATED: These are now managed per-child via ChildPreferences
  // Kept for backward compatibility but not used in filtering logic
  /** @deprecated Use child preferences instead */
  distanceFilterEnabled: boolean;
  /** @deprecated Use child preferences instead */
  distanceRadiusKm: number;
  /** @deprecated Use child preferences instead */
  locationSource: 'gps' | 'saved_address';
  /** @deprecated Use child preferences instead */
  savedAddress?: EnhancedAddress | LegacyAddress;
  /** @deprecated Use child preferences instead */
  locationPermissionAsked: boolean;
  
  // Age preferences
  ageRanges: {
    min: number;
    max: number;
  }[];
  ageRange?: { min?: number; max?: number };
  preferredAgeGroups?: string[];
  
  // Price preferences
  priceRange: {
    min: number;
    max: number;
  };
  
  // Schedule preferences
  daysOfWeek: string[]; // ['Monday', 'Tuesday', etc.]
  timePreferences: {
    morning: boolean; // 6am-12pm
    afternoon: boolean; // 12pm-5pm
    evening: boolean; // 5pm-9pm
  };
  expandedTimePreferences?: string[]; // ['earlyMorning', 'morning', 'afternoon', 'lateAfternoon', 'evening']
  
  // Category preferences (DEPRECATED - use preferredActivityTypes)
  preferredCategories: string[];
  excludedCategories: string[];
  
  // Activity type preferences
  preferredActivityTypes: string[];
  preferredSubtypes: string[]; // Activity subtype codes
  
  // Environment preference (indoor/outdoor)
  environmentFilter: 'all' | 'indoor' | 'outdoor'; // Filter by activity environment
  
  // Notification preferences
  notifications: {
    enabled: boolean;
    newActivities: boolean;
    favoriteCapacity: boolean;
    capacityThreshold: number; // notify when X spots left
    priceDrops: boolean;
    weeklyDigest: boolean;
    spotsAvailable?: boolean;
    reminders?: boolean;
  };
  
  // Display preferences
  theme: 'light' | 'dark' | 'auto';
  viewType: 'card' | 'list' | 'compact';
  
  // Activity filtering preferences
  hideClosedActivities: boolean;
  hideFullActivities: boolean;
  hideClosedOrFull: boolean; // Global filter to hide closed OR full activities
  maxBudgetFriendlyAmount: number;
  useMapPreferencesFilter: boolean; // Whether map screen applies user preferences by default

  // Global active filters - applied across all screens (map, search results, recommendations, etc.)
  activeFilters?: {
    search?: string;
    activityTypes?: string[];
    ageMin?: number;
    ageMax?: number;
    costMin?: number;
    costMax?: number;
    locations?: string[];
    daysOfWeek?: string[];
    startDateAfter?: string;
    startDateBefore?: string;
    hideClosedActivities?: boolean;
    hideFullActivities?: boolean;
  };

  // Date range filter preferences
  dateFilter: 'any' | 'range'; // 'any' = no date filtering, 'range' = use date range
  dateRange?: {
    start: string; // ISO date string
    end?: string;  // Optional end date (ISO string)
  };
  dateMatchMode: 'partial' | 'full'; // 'partial' = overlap, 'full' = completely within range

  // School break date preferences (for Weekly Planner)
  // Custom dates override defaults. Dates are ISO strings (YYYY-MM-DD).
  schoolBreaks?: {
    summerStart?: string;  // Default: June 28
    summerEnd?: string;    // Default: September 1
    springBreakStart?: string;  // Default: March 10
    springBreakEnd?: string;    // Default: March 21
  };

  // Onboarding
  hasCompletedOnboarding: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: Partial<UserPreferences>;
  isDefault: boolean;
}