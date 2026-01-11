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
  waitlistCapacity?: number;
  waitlistSpotsAvailable?: number;
  registrationUrl?: string;
  courseId?: string;
  eventId?: string; // PerfectMind GUID used in registration URLs
  programName?: string; // Parent program name (e.g., "Private Swim Lessons")
  imageUrl?: string; // Activity/program image URL
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

  // Sponsored partner fields
  isFeatured?: boolean;
  featuredTier?: 'gold' | 'silver' | 'bronze';
  featuredStartDate?: Date | string;
  featuredEndDate?: Date | string;

  // Multi-child location matching
  matchingChildIds?: string[]; // Children whose preferences this activity matches

  // PerfectMind eventInfo fields
  formattedDates?: string; // Pre-formatted date range (e.g., "Sep 21, 2025 - Dec 14, 2025")
  formattedTimeRange?: string; // Pre-formatted time (e.g., "11:30 am - 12:00 pm")
  ageRestrictions?: string; // Pre-formatted age string (e.g., "6 to 13")
  orgName?: string; // Organization name (e.g., "City of Maple Ridge")
  orgLogo?: string; // Organization logo URL
  onlineRegistration?: boolean; // Whether online registration is available
  canBook?: boolean; // Whether booking is currently possible
  hasExtras?: boolean; // Whether activity has add-on items/equipment
  hasRequiredExtras?: boolean; // Whether activity has required add-ons
  isSingleOccurrence?: boolean; // Whether it's a single-session event
  allDayEvent?: boolean; // Whether it's an all-day event
  contactEmail?: string; // Facility supervisor/contact email
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