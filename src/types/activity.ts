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
  gender?: string | null; // 'male', 'female', or null for all genders
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
  prerequisites?: string | Array<{name: string; url?: string; courseId?: string}>;
  whatToBring?: string;
  fullAddress?: string;
  latitude?: number;
  longitude?: number;
  directRegistrationUrl?: string;
  contactInfo?: string;
  
  // New comprehensive detail fields
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  dayOfWeek?: string[]; // Array of day names like ["Monday", "Wednesday"]
  dateStart?: string | Date; // From server Activity model
  dateEnd?: string | Date;   // From server Activity model
  registrationEndDate?: string;
  registrationEndTime?: string;
  costIncludesTax?: boolean;
  taxAmount?: number;
  courseDetails?: string;
  sessions?: Array<{
    sessionNumber: number;
    date: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    location?: string;
    subLocation?: string;
    instructor?: string;
    notes?: string;
  }>;
  requiredExtras?: Array<{
    name: string;
    cost: string;
    required: boolean;
  }>;
  
  // New fields for enhanced features
  isFavorite?: boolean;
  favoriteNotes?: string;
  isRecommended?: boolean;
  popularityCount?: number;
  createdAt?: Date | string;

  // Featured partner fields
  isFeatured?: boolean;
  featuredTier?: 'gold' | 'silver' | 'bronze';
  featuredStartDate?: Date | string;
  featuredEndDate?: Date | string;
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
  gender?: string; // 'male' or 'female' - filters out gender-specific activities that don't match
  dateRange?: {
    start: Date;
    end: Date;
  };
  locationId?: string; // Single location ID for exact matching
  locations?: string[];
  maxCost?: number;
  providers?: string[];
  categories?: string;
  subcategory?: string;
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