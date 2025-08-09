// Enhanced Activity types with database fields

export interface Activity {
  id: string;
  name: string;
  description?: string;
  activityType: string[];
  category?: string;
  subcategory?: string;
  schedule: string;
  dates?: string;
  location: string;
  locationName?: string;
  facility?: string;
  ageRange: {
    min: number;
    max: number;
  };
  cost: number;
  spotsAvailable: number;
  totalSpots?: number;
  registrationUrl?: string;
  courseId?: string;
  provider: string;
  scrapedAt: Date;
  dateRange?: {
    start: Date;
    end: Date;
  };
  registrationDate?: Date | string;
  alert?: string;
  
  // Enhanced detail fields
  registrationStatus?: string;
  registrationButtonText?: string;
  detailUrl?: string;
  fullDescription?: string;
  instructor?: string;
  prerequisites?: string;
  whatToBring?: string;
  fullAddress?: string;
  latitude?: number;
  longitude?: number;
  directRegistrationUrl?: string;
  contactInfo?: string;
  
  // New fields for enhanced features
  isFavorite?: boolean;
  favoriteNotes?: string;
  isRecommended?: boolean;
  popularityCount?: number;
  createdAt?: Date | string;
}

export interface Location {
  id: string;
  name: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  facility?: string;
  _count?: {
    activities: number;
  };
}

export interface Provider {
  id: string;
  name: string;
  website: string;
  isActive: boolean;
  _count?: {
    activities: number;
    scrapeJobs: number;
  };
}

export interface Filter {
  activityTypes?: string[];
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
  search?: string;
  limit?: number;
  page?: number;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  preferences?: UserPreferences;
  favorites?: Favorite[];
}

export interface UserPreferences {
  ageRange?: {
    min: number;
    max: number;
  };
  preferredCategories?: string[];
  maxCost?: number;
  preferredLocations?: string[];
}

export interface Favorite {
  id: string;
  userId: string;
  activityId: string;
  notes?: string;
  createdAt: Date;
  activity?: Activity;
}