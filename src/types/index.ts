// API response format for activity type (object with name)
export interface ActivityTypeInfo {
  id?: string;
  code?: string;
  name: string;
  iconName?: string;
}

export interface Activity {
  id: string;
  name: string;
  provider: string;
  description: string;
  activityType: ActivityType[] | ActivityTypeInfo | ActivityTypeInfo[];
  ageRange: {
    min: number;
    max: number;
  };
  gender?: string | null; // 'male', 'female', or null for all genders
  dateRange?: {
    start: Date;
    end: Date;
  } | null;
  schedule: Schedule | string;
  location: Location | string;
  cost: number;
  spotsAvailable?: number;
  totalSpots?: number;
  registrationUrl: string;
  imageUrl?: string;
  scrapedAt: Date;
  isFavorite?: boolean;

  // Time fields (can be at activity level or in sessions)
  startTime?: string;
  endTime?: string;

  // Enhanced fields from detailed scraping
  registrationStatus?: string;
  registrationButtonText?: string;
  detailUrl?: string;
  fullDescription?: string;
  instructor?: string;
  prerequisites?: string | ActivityPrerequisite[];
  whatToBring?: string;
  fullAddress?: string;
  latitude?: number;
  longitude?: number;
  directRegistrationUrl?: string;
  contactInfo?: string;
  courseId?: string;
  locationName?: string;
  dates?: string;
  category?: string;
  subcategory?: string;

  // Additional metadata
  updatedAt?: Date;
  costIncludesTax?: boolean;
  requiredExtras?: Array<{ name: string; cost: string }> | string[];
  facility?: string;
  organization?: string;
  sourceUrl?: string;
  address?: string;
  city?: string;

  // Subtype support
  activitySubtype?: ActivityTypeInfo;

  // Date fields (alternative to dateRange)
  startDate?: Date | string;
  endDate?: Date | string;
  dateStart?: Date | string;
  dateEnd?: Date | string;

  // Age fields (alternative to ageRange)
  ageMin?: number;
  ageMax?: number;

  // Price field (alternative to cost)
  price?: number;

  // Status flags
  isNew?: boolean;
  isActive?: boolean;

  // Created timestamp
  createdAt?: Date | string;

  // Featured partner support
  featuredTier?: 'gold' | 'silver' | 'bronze' | string | null;
  isFeatured?: boolean;

  // Alias for spotsAvailable (used by some components)
  spotsLeft?: number;

  // Support for multiple sessions
  hasMultipleSessions?: boolean;
  sessionCount?: number;
  sessions?: ActivitySession[];
  hasPrerequisites?: boolean;
}

export interface Schedule {
  days: string[];
  startTime: string;
  endTime: string;
}

export interface ActivitySession {
  id?: string;
  sessionNumber?: number;
  date?: string;
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  subLocation?: string;
  instructor?: string;
  notes?: string;
}

export interface ActivityPrerequisite {
  id?: string;
  name: string;
  description?: string;
  url?: string;
  courseId?: string;
  isRequired?: boolean;
}

export interface Location {
  name: string;
  address: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export enum ActivityType {
  CAMPS = 'camps',
  SPORTS = 'sports',
  ARTS = 'arts',
  SWIMMING = 'swimming',
  EDUCATION = 'education',
  GENERAL = 'general',
}

export interface User {
  id: string;
  email: string;
  name: string;
  children: Child[];
  preferences: UserPreferences;
  siteAccounts: SiteAccount[];
}

export interface Child {
  id: string;
  name: string;
  dateOfBirth: Date;
  allergies?: string[];
  medicalInfo?: string;
}

export interface UserPreferences {
  activityTypes: ActivityType[];
  locations: string[];
  maxCost?: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
  notifications: NotificationPreferences;
}

export interface NotificationPreferences {
  enabled: boolean;
  newCamps: boolean;
  spotsAvailable: boolean;
  priceDrops: boolean;
}

export interface SiteAccount {
  id: string;
  provider: string;
  username: string;
  password: string; // Will be encrypted
  isActive: boolean;
}

export interface Filter {
  activityTypes?: ActivityType[] | string[];
  activityType?: string;
  activitySubtype?: string;
  category?: string;
  ageRange?: {
    min: number;
    max: number;
  };
  gender?: string; // 'male' or 'female' - filters out gender-specific activities that don't match
  dateRange?: {
    start: Date;
    end: Date;
  };
  startDateAfter?: string; // ISO date string for date range start
  startDateBefore?: string; // ISO date string for date range end
  dateMatchMode?: 'partial' | 'full'; // 'partial' = overlap, 'full' = completely within range
  locationId?: string; // Single location ID for exact matching
  locations?: string[];
  maxCost?: number;
  providers?: string[];
  categories?: string;
  search?: string;
  subcategory?: string;
  hideClosedActivities?: boolean;
  hideFullActivities?: boolean;
  hasCoordinates?: boolean; // Only return activities with lat/lng for map view
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: string;
  createdAfter?: string;
  updatedAfter?: string;
}

export interface ScraperConfig {
  provider: string;
  baseUrl: string;
  selectors: {
    campList: string;
    campName: string;
    campDescription: string;
    campPrice: string;
    campSchedule: string;
    campLocation: string;
    campSpots?: string;
    nextPage?: string;
  };
}