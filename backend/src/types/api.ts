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
  ageMin?: number;
  ageMax?: number;
  costMin?: number;
  costMax?: number;
  location?: string;
  locationId?: string; // Single location ID for exact matching
  locations?: string[]; // Multiple location IDs
  daysOfWeek?: string[];
  startDateAfter?: string;
  startDateBefore?: string;
  hideClosedActivities?: boolean;
  hideFullActivities?: boolean;
  sortBy?: 'cost' | 'dateStart' | 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}