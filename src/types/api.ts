import { Aggregations } from './aggregations';

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  pages: number;
  aggregations?: Aggregations;
}

export interface ActivitySearchParams extends PaginationParams {
  search?: string;
  category?: string;
  activityType?: string; // Single activity type code
  activityTypes?: string[]; // Array of activity type codes (e.g., ['swimming-aquatics', 'team-sports'])
  activitySubtype?: string; // Activity subtype code
  ageMin?: number;
  ageMax?: number;
  ageRange?: { min: number; max: number };
  costMin?: number;
  costMax?: number;
  minCost?: number;
  maxCost?: number;
  location?: string;
  locationId?: string; // Single location ID for exact matching
  locations?: string[]; // Multiple location IDs
  daysOfWeek?: string[];
  startDateAfter?: string;
  startDateBefore?: string;
  dateEndBefore?: string;
  dateEndAfter?: string;
  dateMatchMode?: 'partial' | 'full'; // 'partial' = overlap, 'full' = completely within range
  hideClosedActivities?: boolean;
  hideFullActivities?: boolean;
  timePreferences?: any;
  environmentFilter?: 'all' | 'indoor' | 'outdoor'; // Filter by indoor/outdoor
  sortBy?: 'cost' | 'dateStart' | 'name' | 'createdAt' | 'dateEnd' | string;
  sortOrder?: 'asc' | 'desc';
}