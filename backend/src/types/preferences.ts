export interface UserPreferences {
  // Basic preferences
  id: string;
  name?: string;
  
  // Location preferences
  locations: string[];
  maxDistance?: number; // in km
  
  // Age preferences
  ageRanges: {
    min: number;
    max: number;
  }[];
  
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
  
  // Notification preferences
  notifications: {
    enabled: boolean;
    newActivities: boolean;
    favoriteCapacity: boolean;
    capacityThreshold: number; // notify when X spots left
    priceDrops: boolean;
    weeklyDigest: boolean;
  };
  
  // Display preferences
  theme: 'light' | 'dark' | 'auto';
  viewType: 'card' | 'list' | 'compact';
  
  // Activity filtering preferences
  hideClosedActivities: boolean;
  hideFullActivities: boolean;
  maxBudgetFriendlyAmount: number;
  
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