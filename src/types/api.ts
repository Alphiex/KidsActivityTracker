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
}

export interface ActivitySearchParams extends PaginationParams {
  search?: string;
  category?: string;
  activityTypes?: string[]; // Array of activity type codes (e.g., ['swimming-aquatics', 'team-sports'])
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
  dateMatchMode?: 'partial' | 'full'; // 'partial' = overlap, 'full' = completely within range
  hideClosedActivities?: boolean;
  hideFullActivities?: boolean;
  sortBy?: 'cost' | 'dateStart' | 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}