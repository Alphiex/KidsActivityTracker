export interface Camp {
  id: string;
  name: string;
  provider: string;
  description: string;
  activityType: ActivityType[];
  ageRange: {
    min: number;
    max: number;
  };
  dateRange: {
    start: Date;
    end: Date;
  };
  schedule: Schedule;
  location: Location;
  cost: number;
  spotsAvailable?: number;
  totalSpots?: number;
  registrationUrl: string;
  imageUrl?: string;
  scrapedAt: Date;
}

export interface Schedule {
  days: string[];
  startTime: string;
  endTime: string;
}

export interface Location {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export enum ActivityType {
  CAMPS = 'camps',
  SWIMMING = 'swimming',
  MARTIAL_ARTS = 'martial_arts',
  DANCE = 'dance',
  VISUAL_ARTS = 'visual_arts',
  LEARN_AND_PLAY = 'learn_and_play',
  EARLY_YEARS = 'early_years',
  SPORTS = 'sports',
  MUSIC = 'music',
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