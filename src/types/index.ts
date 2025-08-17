export interface Activity {
  id: string;
  name: string;
  provider: string;
  description: string;
  activityType: ActivityType[];
  ageRange: {
    min: number;
    max: number;
  };
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
  startTime?: string;
  endTime?: string;
  location?: string;
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
  activityTypes?: ActivityType[];
  ageRange?: {
    min: number;
    max: number;
  };
  dateRange?: {
    start: Date;
    end: Date;
  };
  locations?: string[];
  maxCost?: number;
  providers?: string[];
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