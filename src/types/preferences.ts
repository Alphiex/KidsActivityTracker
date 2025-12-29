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
  distanceFilterEnabled: boolean; // Whether distance filtering is active
  distanceRadiusKm: number; // Radius in km (5, 10, 25, 50, 100)
  locationSource: 'gps' | 'saved_address'; // Location source preference
  savedAddress?: {
    address: string;
    latitude: number;
    longitude: number;
  };
  locationPermissionAsked: boolean; // Whether we've asked for location permission
  
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

  // Date range filter preferences
  dateFilter: 'any' | 'range'; // 'any' = no date filtering, 'range' = use date range
  dateRange?: {
    start: string; // ISO date string
    end?: string;  // Optional end date (ISO string)
  };
  dateMatchMode: 'partial' | 'full'; // 'partial' = overlap, 'full' = completely within range
  
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